/**
 * Emails the league commissioner when a waiver claim is submitted.
 *
 * Called (fire-and-forget) from the client after a claim row is inserted — see
 * src/lib/notify.js. Given just the claim id, this looks up the full claim,
 * team, golfers and the commissioner's email server-side, then sends via Resend.
 *
 * Requires these environment variables (set in Vercel project settings):
 *   VITE_SUPABASE_URL           - already used by the app
 *   SUPABASE_SERVICE_ROLE_KEY   - service role key; needed to read auth.users
 *                                 (the commissioner's email) and bypass RLS
 *   RESEND_API_KEY              - Resend API key
 *   RESEND_FROM                 - verified sender, e.g. "Fairway Fantasy <noreply@yourdomain.com>"
 *                                 (defaults to Resend's onboarding@resend.dev sandbox sender)
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Vercel parses JSON bodies automatically, but guard against a raw string too.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const claimId = body?.claimId;
  if (!claimId) {
    return res.status(400).json({ ok: false, error: 'Missing claimId' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceKey || !resendKey) {
    return res.status(500).json({
      ok: false,
      error: 'Server missing SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY',
    });
  }

  try {
    // Service role bypasses RLS and can read auth.users.
    const supabase = createClient(process.env.VITE_SUPABASE_URL, serviceKey);

    const { data: claim, error: claimErr } = await supabase
      .from('waiver_claims')
      .select(
        `id, created_at, faab_bid,
         member:league_members(team_name),
         add_golfer:golfers!waiver_claims_add_golfer_id_fkey(name, owgr_rank),
         drop_golfer:golfers!waiver_claims_drop_golfer_id_fkey(name, owgr_rank),
         league:leagues(name, commissioner_id)`
      )
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ ok: false, error: claimErr?.message || 'Claim not found' });
    }

    const commissionerId = claim.league?.commissioner_id;
    if (!commissionerId) {
      return res.status(404).json({ ok: false, error: 'League has no commissioner' });
    }

    const { data: commish, error: userErr } = await supabase.auth.admin.getUserById(commissionerId);
    const email = commish?.user?.email;
    if (userErr || !email) {
      return res.status(404).json({ ok: false, error: userErr?.message || 'Commissioner email not found' });
    }

    const teamName = claim.member?.team_name || 'A team';
    const addName = claim.add_golfer?.name || 'a golfer';
    const dropName = claim.drop_golfer?.name || null;
    const leagueName = claim.league?.name || 'your league';

    const subject = `New waiver claim in ${leagueName}: ${teamName} → ${addName}`;
    const html = `
      <div style="font-family: system-ui, sans-serif; color: #1a1a1a;">
        <h2 style="margin:0 0 8px;">New waiver claim</h2>
        <p style="margin:0 0 16px; color:#555;">${leagueName}</p>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:4px 12px 4px 0; color:#888;">Team</td><td style="padding:4px 0;"><strong>${teamName}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#888;">Claiming</td><td style="padding:4px 0;"><strong>${addName}</strong>${claim.add_golfer?.owgr_rank ? ` <span style="color:#999;">(#${claim.add_golfer.owgr_rank})</span>` : ''}</td></tr>
          ${dropName ? `<tr><td style="padding:4px 12px 4px 0; color:#888;">Dropping</td><td style="padding:4px 0;">${dropName}</td></tr>` : ''}
          ${claim.faab_bid ? `<tr><td style="padding:4px 12px 4px 0; color:#888;">FAAB bid</td><td style="padding:4px 0;">$${claim.faab_bid}</td></tr>` : ''}
        </table>
        <p style="margin:16px 0 0; color:#888; font-size:13px;">Review pending waiver claims in the Commissioner panel.</p>
      </div>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Fairway Fantasy <onboarding@resend.dev>',
        to: [email],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}));
      return res.status(502).json({ ok: false, error: errBody?.message || `Resend error ${emailRes.status}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-waiver error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
