// Salva refresh_token (e opcionalmente customer_id/login_customer_id) no Supabase para um cliente
// Uso:
//   node tools/set-google-ads-refresh-token.js --clientId <uuid> --refreshToken <token>
//   node tools/set-google-ads-refresh-token.js --clientId <uuid> --refreshToken <token> --customerId 477-857-0213
//   node tools/set-google-ads-refresh-token.js --clientId <uuid> --refreshToken <token> --loginCustomerId 123-456-7890

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function printHelp() {
  console.log(`\nUso:\n  node tools/set-google-ads-refresh-token.js --clientId <uuid> --refreshToken <token> [--customerId <id>] [--loginCustomerId <id>]\n\nRequer no .env:\n  SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const clientId = String(args.clientId || '').trim();
const refreshToken = String(args.refreshToken || '').trim();
const customerId = args.customerId ? String(args.customerId).trim() : null;
const loginCustomerId = args.loginCustomerId ? String(args.loginCustomerId).trim() : null;

if (!clientId || !refreshToken) {
  printHelp();
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const update = { google_ads_refresh_token: refreshToken };
if (customerId) update.google_ads_customer_id = customerId;
if (loginCustomerId) update.google_ads_login_customer_id = loginCustomerId;

const { data, error } = await supabase
  .from('clients')
  .update(update)
  .eq('id', clientId)
  .select('id, client_name, google_ads_customer_id, google_ads_login_customer_id, google_ads_refresh_token')
  .single();

if (error) {
  console.error('❌ Falha ao atualizar cliente:', error.message || error);
  process.exit(1);
}

console.log('✅ Atualizado com sucesso:');
console.log({
  id: data.id,
  client_name: data.client_name,
  google_ads_customer_id: data.google_ads_customer_id,
  google_ads_login_customer_id: data.google_ads_login_customer_id,
  google_ads_refresh_token: data.google_ads_refresh_token ? 'set' : null,
});
