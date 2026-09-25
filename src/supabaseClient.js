import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error('Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});
