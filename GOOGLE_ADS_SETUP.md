# Configuração Google Ads API - Guia Completo

## 📋 Visão Geral

Para sincronizar dados do Google Ads, você precisa:
1. Criar projeto no Google Cloud Console
2. Ativar Google Ads API
3. Configurar OAuth 2.0
4. Obter Developer Token do Google Ads
5. Fazer autenticação e obter refresh token
6. Configurar Edge Function no Supabase

---

## 🔧 Passo 1: Google Cloud Console

### 1.1 Criar Projeto
1. Acesse: https://console.cloud.google.com/
2. Clique em "Criar Projeto"
3. Nome: "Gerenciador PMax"
4. Clique em "Criar"

### 1.2 Ativar Google Ads API
1. No menu lateral: **APIs e Serviços > Biblioteca**
2. Pesquise: "Google Ads API"
3. Clique em "Ativar"

### 1.3 Configurar OAuth 2.0
1. No menu lateral: **APIs e Serviços > Credenciais**
2. Clique em **Criar Credenciais > ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: "Gerenciador PMax Web Client"
5. URIs de redirecionamento autorizados:
   - `http://localhost:3000/oauth/callback` (desenvolvimento)
   - `https://seu-dominio.com/oauth/callback` (produção)
6. Clique em **Criar**
7. **IMPORTANTE**: Copie o **Client ID** e **Client Secret**

---

## 🎯 Passo 2: Google Ads - Developer Token

### 2.1 Acessar Conta de Gerenciamento
1. Acesse: https://ads.google.com/
2. Use uma conta de **administrador do Google Ads**
3. No menu superior: **Ferramentas e Configurações > Configuração > Central de API**

### 2.2 Solicitar Developer Token
1. Clique em **Solicitar Acesso à API**
2. Preencha o formulário:
   - Nome da empresa
   - Propósito: "Gerenciamento interno de campanhas"
   - Descrição: "Sincronização de dados para dashboard interno"
3. Aguarde aprovação (pode levar alguns dias)
4. **IMPORTANTE**: Copie o **Developer Token**

**Nota**: Para testes, você pode usar o token em modo "Test Account" antes da aprovação.

---

## 🔐 Passo 3: Autenticação OAuth (Obter Refresh Token)

### 3.1 Gerar URL de Autorização

Substitua `YOUR_CLIENT_ID` pelo Client ID obtido no passo 1.3:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
```

### 3.2 Autorizar e Obter Código
1. Abra a URL no navegador
2. Faça login com a conta Google Ads
3. Autorize o aplicativo
4. Você será redirecionado para: `http://localhost:3000/oauth/callback?code=CODIGO_AQUI`
5. **COPIE O CÓDIGO** da URL

### 3.3 Trocar Código por Tokens

No terminal, execute (substitua os valores):

```powershell
$body = @{
    code = "SEU_CODIGO_AQUI"
    client_id = "SEU_CLIENT_ID"
    client_secret = "SEU_CLIENT_SECRET"
    redirect_uri = "http://localhost:3000/oauth/callback"
    grant_type = "authorization_code"
}

$response = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method Post -Body $body
$response | ConvertTo-Json
```

**Resposta esperada:**
```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0g...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "https://www.googleapis.com/auth/adwords"
}
```

**IMPORTANTE**: Salve o `refresh_token` - ele será usado para sempre obter novos access tokens.

---

## 💾 Passo 4: Salvar Credenciais no Supabase

### 4.1 Executar SQL no Supabase

```sql
-- Verificar se a tabela existe
SELECT * FROM google_ads_credentials LIMIT 1;

-- Inserir ou atualizar credenciais (use seu user_id)
INSERT INTO google_ads_credentials (
    user_id,
    client_id_val,
    client_secret,
    developer_token,
    refresh_token
) VALUES (
    'SEU_USER_ID_AQUI',  -- UUID do gestor
    'SEU_CLIENT_ID_AQUI',
    'SEU_CLIENT_SECRET_AQUI',
    'SEU_DEVELOPER_TOKEN_AQUI',
    'SEU_REFRESH_TOKEN_AQUI'
)
ON CONFLICT (user_id) 
DO UPDATE SET
    client_id_val = EXCLUDED.client_id_val,
    client_secret = EXCLUDED.client_secret,
    developer_token = EXCLUDED.developer_token,
    refresh_token = EXCLUDED.refresh_token,
    updated_at = NOW();
```

### 4.2 Verificar Salvamento

```sql
SELECT 
    user_id,
    client_id_val,
    developer_token,
    created_at,
    updated_at
FROM google_ads_credentials;
```

---

## 🚀 Passo 5: Configurar Customer IDs dos Clientes

Cada cliente precisa ter seu **Customer ID** do Google Ads:

```sql
-- Exemplo: Atualizar cliente com Customer ID
UPDATE clients 
SET google_ads_customer_id = '123-456-7890'
WHERE id = 'UUID_DO_CLIENTE';

-- Verificar
SELECT client_name, google_ads_customer_id 
FROM clients 
WHERE owner_id = 'SEU_USER_ID';
```

**Como encontrar Customer ID:**
1. Acesse Google Ads: https://ads.google.com/
2. Selecione a conta do cliente
3. No canto superior direito, veja o número (formato: 123-456-7890)

---

## 🌐 Passo 6: Deploy da Edge Function

### 6.1 Instalar Supabase CLI

```powershell
# Via npm
npm install -g supabase

# Ou via Scoop (Windows)
scoop install supabase
```

### 6.2 Login e Link

```powershell
# Login
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF
```

**Onde encontrar Project Ref:**
- Dashboard Supabase → Settings → General → Reference ID

### 6.3 Deploy

```powershell
# Deploy da função
supabase functions deploy google-ads-sync

# Configurar secrets
supabase secrets set SUPABASE_URL="https://SEU-PROJETO.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SEU_SERVICE_ROLE_KEY"
```

**Onde encontrar Service Role Key:**
- Dashboard Supabase → Settings → API → Service Role Key (secret)

---

## ✅ Passo 7: Testar Sincronização

### 7.1 Via Interface
1. No dashboard do gestor
2. Selecione um cliente
3. Clique em "Sincronizar com Google Ads"
4. Verifique se os dados foram importados

### 7.2 Verificar Dados Salvos

```sql
-- Ver dados da campanha
SELECT 
    c.name,
    c.data,
    c.updated_at
FROM campaigns c
JOIN clients cl ON c.client_id = cl.id
WHERE cl.google_ads_customer_id = '123-456-7890';
```

---

## 🐛 Troubleshooting

### Erro: "Google Ads credentials not found"
- Execute o SQL do Passo 4.1 para salvar credenciais
- Verifique se o `user_id` está correto

### Erro: "Invalid refresh token"
- Refaça o fluxo OAuth (Passo 3)
- Verifique se usou `access_type=offline&prompt=consent`

### Erro: "Developer token not approved"
- Use uma conta de teste do Google Ads
- Ou aguarde aprovação do token de produção

### Erro: "Customer ID not found"
- Execute o SQL do Passo 5 para configurar Customer ID
- Verifique o formato: 123-456-7890 (com hífens)

---

## 📚 Recursos Adicionais

- [Google Ads API - Quick Start](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Ads API Reference](https://developers.google.com/google-ads/api/reference/rpc)

---

## 🔄 Manutenção

### Renovar Access Token (automático)
A Edge Function renova automaticamente usando o refresh token.

### Atualizar Credenciais
Execute novamente o SQL do Passo 4.1.

### Adicionar Novos Clientes
Execute o SQL do Passo 5 para cada novo cliente.
