// Diagnóstico local para Google Ads (Node)
// Execute: node tools/google-ads-doctor.js

import 'dotenv/config';

const baseUrl = process.env.GOOGLE_ADS_NODE_URL || `http://localhost:${process.env.PORT || 3001}`;

async function main() {
  console.log('Google Ads Doctor');
  console.log('Base URL:', baseUrl);

  const res = await fetch(`${baseUrl}/api/google-ads/doctor`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Doctor falhou:', data);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));

  console.log('\nDica: Para testar conexão real, rode no app e pegue o clientId, depois:');
  console.log('  Invoke-RestMethod -Uri "http://localhost:3001/api/google-ads/test-connection" -Method Post -ContentType "application/json" -Body ("{`"clientId`":`"SEU_UUID`"}" )');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
