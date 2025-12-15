// Script para obter Refresh Token do Google Ads
// Execute: node tools/get-google-ads-refresh-token.js

import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import open from 'open';
import readline from 'readline';

console.log('\n🔐 Google Ads API - Obter Refresh Token\n');

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const PORT = 3000;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  try {
    // Solicitar credenciais
    console.log('🔧 CONFIGURAÇÃO IMPORTANTE:');
    console.log('\n1. Acesse Google Cloud Console:');
    console.log('   https://console.cloud.google.com/apis/credentials');
    console.log('\n2. Edite seu OAuth 2.0 Client ID');
    console.log('\n3. Em "Authorized redirect URIs", adicione:');
    console.log(`   ${REDIRECT_URI}`);
    console.log('\n4. Clique em "SAVE"\n');
    
    await question('Pressione ENTER após configurar a redirect URI... ');
    
    console.log('\n📝 Agora preencha as credenciais:\n');
    
    const clientId = await question('Client ID: ');
    const clientSecret = await question('Client Secret: ');

    if (!clientId || !clientSecret) {
      console.error('\n❌ Client ID e Client Secret são obrigatórios!');
      rl.close();
      process.exit(1);
    }

    // Criar OAuth2 client
    const oauth2Client = new OAuth2Client(
      clientId.trim(),
      clientSecret.trim(),
      REDIRECT_URI
    );

    // Gerar URL de autorização
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/adwords',
      prompt: 'consent', // Força mostrar tela de consentimento
    });

    console.log('\n📋 Iniciando servidor local na porta', PORT, '...\n');

    // Criar servidor HTTP para receber o callback
    const server = http.createServer(async (req, res) => {
      try {
        const queryObject = url.parse(req.url, true).query;

        if (req.url.startsWith('/oauth2callback')) {
          const code = queryObject.code;

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ Erro: Código não recebido</h1>');
            return;
          }

          console.log('✅ Código de autorização recebido!');
          console.log('⏳ Obtendo tokens...\n');

          // Trocar código por tokens
          const { tokens } = await oauth2Client.getToken(code);

          // Responder ao navegador
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Autenticação Concluída</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .success { color: #28a745; }
                .box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <h1 class="success">✅ Autenticação Concluída!</h1>
              <p>O Refresh Token foi gerado com sucesso.</p>
              <p>Volte para o terminal para ver as informações.</p>
              <p>Você pode fechar esta janela.</p>
            </body>
            </html>
          `);

          // Mostrar tokens no terminal
          console.log('✅ Tokens obtidos com sucesso!\n');
          console.log('━'.repeat(70));
          console.log('\n📝 GUARDE ESTAS INFORMAÇÕES COM SEGURANÇA:\n');
          console.log('Refresh Token:');
          console.log(tokens.refresh_token);
          console.log('\nAccess Token (temporário - expira em 1 hora):');
          console.log(tokens.access_token);
          console.log('\n━'.repeat(70));
          console.log('\n💡 Use o Refresh Token na configuração do Gerenciador PMax');
          console.log('   (copie apenas o Refresh Token)\n');

          // Fechar servidor e readline
          setTimeout(() => {
            server.close();
            rl.close();
            process.exit(0);
          }, 1000);
        }
      } catch (error) {
        console.error('\n❌ Erro ao processar callback:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>❌ Erro: ${error.message}</h1>`);
        
        setTimeout(() => {
          server.close();
          rl.close();
          process.exit(1);
        }, 1000);
      }
    });

    server.listen(PORT, () => {
      console.log(`✅ Servidor rodando em http://localhost:${PORT}\n`);
      console.log('🌐 Abrindo navegador para autorização...\n');
      console.log('Se o navegador não abrir automaticamente, copie esta URL:\n');
      console.log(authorizeUrl);
      console.log('\n');
      
      // Abrir navegador automaticamente
      open(authorizeUrl).catch(() => {
        console.log('⚠️  Não foi possível abrir o navegador automaticamente.');
        console.log('   Por favor, abra a URL acima manualmente.\n');
      });
    });

    // Timeout de 5 minutos
    setTimeout(() => {
      console.error('\n❌ Timeout: Nenhuma autorização recebida em 5 minutos.');
      server.close();
      rl.close();
      process.exit(1);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
