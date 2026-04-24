const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const url = envFile.match(/REACT_APP_SUPABASE_URL=(.*)/)[1];
const key = envFile.match(/REACT_APP_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('salaries_ledger').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}
check();
