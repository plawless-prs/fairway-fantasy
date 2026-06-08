import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const { error } = await supabase
    .from('keep_alive')
    .select({ last_ping: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
  return res.status(200).json({ ok: true, pinged: new Date().toISOString() });
}