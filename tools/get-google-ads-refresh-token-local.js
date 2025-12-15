// Obtém refresh_token do Google Ads via OAuth2 local (porta configurável)
// Uso:
//   node tools/get-google-ads-refresh-token-local.js --port 3007
//   node tools/get-google-ads-refresh-token-local.js --clientId ... --clientSecret ...
// Env (opcional): GOOGLE_ADS_OAUTH_CLIENT_ID, GOOGLE_ADS_OAUTH_CLIENT_SECRET

import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import http from 'node:http';
import url from 'node:url';
import open from 'open';
import readline from 'node:readline';

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
  console.log(`\n🔐 Google Ads - Obter Refresh Token (local)\n\nUso:\n  node tools/get-google-ads-refresh-token-local.js [opções]\n\nOpções:\n  --port <n>          Porta do callback local (default: 3007)\n  --clientId <id>     OAuth Client ID (ou use env GOOGLE_ADS_OAUTH_CLIENT_ID)\n  --clientSecret <s>  OAuth Client Secret (ou env GOOGLE_ADS_OAUTH_CLIENT_SECRET)\n  --no-open           Não abre o navegador automaticamente\n  --timeoutSec <n>    Timeout em segundos (default: 300)\n  --help              Ajuda\n\nObs: você PRECISA cadastrar a Redirect URI no Google Cloud Console:\n  http://localhost:<port>/oauth2callback\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

dotenv.config();

const port = Number(args.port || process.env.GOOGLE_ADS_REFRESH_TOKEN_PORT || 3007);
const redirectUri = `http://localhost:${port}/oauth2callback`;
const timeoutSec = Number(args.timeoutSec || 300);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  try {
    console.log('\n🔐 Google Ads API - Obter Refresh Token (local)\n');
    console.log('1) Google Cloud Console → APIs & Services → Credentials');
    console.log('2) Edite seu OAuth 2.0 Client ID');
    console.log('3) Em "Authorized redirect URIs", adicione exatamente:');
    console.log(`   ${redirectUri}\n`);

    const clientId = String(args.clientId || process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || '').trim() ||
      (await question('Client ID: ')).trim();
    const clientSecret = String(args.clientSecret || process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || '').trim() ||
      (await question('Client Secret: ')).trim();

    if (!clientId || !clientSecret) {
      console.error('\n❌ Client ID e Client Secret são obrigatórios.');
      process.exitCode = 1;
      return;
    }

    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/adwords',
      prompt: 'consent',
    });

    console.log(`\n✅ Subindo callback local em ${redirectUri}`);

    const server = http.createServer(async (req, res) => {
      try {
        const parsed = url.parse(req.url, true);
        if (!parsed.pathname?.startsWith('/oauth2callback')) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const code = String(parsed.query.code || '').trim();
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>❌ Erro: código OAuth não recebido</h1>');
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>✅ OK</h1><p>Volte para o terminal — refresh_token gerado.</p>');

        console.log('\n✅ Tokens obtidos.');
        if (!tokens.refresh_token) {
          console.log('⚠️  Não veio refresh_token. Tente de novo com prompt=consent e uma conta que ainda não autorizou este client_id.');
          process.exitCode = 2;
        } else {
          console.log('\nREFRESH_TOKEN (guarde com segurança):');
          console.log(tokens.refresh_token);
          console.log('\nDica: salvar no Supabase:');
          console.log(`  node tools/set-google-ads-refresh-token.js --clientId <UUID_DO_CLIENTE> --refreshToken "${tokens.refresh_token}"`);
        }

        setTimeout(() => {
          server.close();
          rl.close();
          process.exit(process.exitCode || 0);
        }, 200);
      } catch (err) {
        console.error('\n❌ Erro no callback:', err?.message || err);
        try {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Erro: ${err?.message || err}`);
        } catch {
          // ignore
        }
        setTimeout(() => {
          server.close();
          rl.close();
          process.exit(1);
        }, 200);
      }
    });

    server.listen(port, () => {
      console.log('\n🌐 Abra a URL para autorizar:');
      console.log(authorizeUrl);
      console.log('');

      if (!args['no-open']) {
        open(authorizeUrl).catch(() => {
          console.log('⚠️  Não consegui abrir o navegador automaticamente. Cole a URL acima no browser.');
        });
      }
    });

    setTimeout(() => {
      console.error(`\n❌ Timeout: sem callback em ${timeoutSec}s.`);
      server.close();
      rl.close();
      process.exit(1);
    }, timeoutSec * 1000);
  } catch (err) {
    console.error('\n❌ Erro:', err?.message || err);
    rl.close();
    process.exit(1);
  }
}

main();
