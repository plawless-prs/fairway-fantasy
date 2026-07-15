/**
 * Client helpers for triggering server-side notifications.
 * These call our own Vercel serverless functions in api/.
 */

/**
 * Ask the backend to email the league commissioner about a new waiver claim.
 * Fire-and-forget: failures are logged but never surfaced to the claimer, since
 * the claim itself already succeeded and the email is a side effect.
 */
export async function notifyWaiverClaim(claimId) {
  try {
    const res = await fetch('/api/notify-waiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('notify-waiver failed:', res.status, body?.error);
    }
  } catch (err) {
    console.error('notifyWaiverClaim error:', err);
  }
}
