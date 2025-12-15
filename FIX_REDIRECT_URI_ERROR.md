# 🔧 CORREÇÃO: Erro 400 redirect_uri_mismatch

## ❌ O Problema

Você viu este erro:
```
Erro 400: redirect_uri_mismatch
```

**Causa:** A redirect URI não está configurada corretamente no Google Cloud Console.

---

## ✅ SOLUÇÃO (5 minutos)

### PASSO 1: Configurar Redirect URI

1. **Acesse:** https://console.cloud.google.com/apis/credentials

2. **Encontre** seu OAuth 2.0 Client ID na lista

3. **Clique** no nome do Client ID (ou no ícone de editar ✏️)

4. Na seção **"Authorized redirect URIs"** adicione **o URI do método que você vai usar**:

   **A) OAuth oficial via Node (recomendado):**
   - `http://localhost:3001/api/google-ads/oauth/callback`

   **B) Script local (legado):**
   - `http://localhost:3000/oauth2callback`

   Depois clique em **"SAVE"**

5. **Aguarde 10-30 segundos** para a mudança propagar

### PASSO 2: Executar Script Novamente

```powershell
node tools/get-google-ads-refresh-token.js

Se você estiver usando o fluxo oficial via Node (recomendado), suba o servidor e use o botão **"Conectar via OAuth"** dentro do sistema.
```

O script agora irá:
- ✅ Iniciar servidor local na porta 3000
- ✅ Abrir navegador automaticamente
- ✅ Receber o código de autorização via redirect
- ✅ Exibir o Refresh Token no terminal

---

## 📋 Checklist Visual

```
Google Cloud Console
└── APIs & Services
    └── Credentials
        └── OAuth 2.0 Client IDs
            └── [SEU CLIENT ID]
                └── Authorized redirect URIs
                    └── ✅ http://localhost:3000/oauth2callback
```

---

## 🎯 Exemplo de Tela no Google Cloud Console

Você deve ver algo assim:

```
Authorized redirect URIs
┌────────────────────────────────────────────────┐
│ http://localhost:3000/oauth2callback    [❌ X] │
└────────────────────────────────────────────────┘
                    [+ ADD URI]

                   [SAVE]  [CANCEL]
```

---

## ⚠️ Erros Comuns

### Erro: "Port 3000 already in use"
**Solução:** Feche qualquer aplicação usando a porta 3000, ou mude a porta no script.

### Erro: "Cannot GET /oauth2callback"
**Solução:** Você acessou localhost:3000 diretamente. Execute o script e use a URL gerada.

### Navegador não abre automaticamente
**Solução:** Copie a URL exibida no terminal e cole no navegador manualmente.

---

## 🚀 Testando

Após configurar, execute:

```powershell
node tools/get-google-ads-refresh-token.js
```

**Saída esperada:**
```
🔐 Google Ads API - Obter Refresh Token

🔧 CONFIGURAÇÃO IMPORTANTE:

1. Acesse Google Cloud Console:
   https://console.cloud.google.com/apis/credentials

2. Edite seu OAuth 2.0 Client ID

3. Em "Authorized redirect URIs", adicione:
   http://localhost:3000/oauth2callback

4. Clique em "SAVE"

Pressione ENTER após configurar a redirect URI... 

📝 Agora preencha as credenciais:

Client ID: [SEU_CLIENT_ID]
Client Secret: [SEU_CLIENT_SECRET]

📋 Iniciando servidor local na porta 3000 ...

✅ Servidor rodando em http://localhost:3000

🌐 Abrindo navegador para autorização...

✅ Código de autorização recebido!
⏳ Obtendo tokens...

✅ Tokens obtidos com sucesso!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 GUARDE ESTAS INFORMAÇÕES COM SEGURANÇA:

Refresh Token:
1//0gHZ...muito...longo...token

Access Token (temporário - expira em 1 hora):
ya29.a0A...outro...token...longo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Use o Refresh Token na configuração do Gerenciador PMax
   (copie apenas o Refresh Token)
```

---

## 🎉 Sucesso!

Se você viu a mensagem acima, **copie apenas o Refresh Token** (a linha que começa com `1//...`) e use na configuração do Gerenciador PMax.

**NÃO** copie o Access Token - ele expira em 1 hora e não serve para uso permanente.

---

## 📞 Ainda com Problemas?

### Verifique:
1. ✅ Redirect URI está **exatamente** como: `http://localhost:3000/oauth2callback`
2. ✅ Clicou em **SAVE** no Google Cloud Console
3. ✅ Aguardou pelo menos 30 segundos após salvar
4. ✅ Está usando a conta Google correta (que tem acesso ao Google Ads)
5. ✅ Porta 3000 está livre (nenhum outro app usando)

### Logs úteis:
- Console do navegador (F12)
- Saída do terminal onde rodou o script
- Verificar se o servidor iniciou corretamente

---

**Feito isso, execute o script novamente e deve funcionar! 🚀**
