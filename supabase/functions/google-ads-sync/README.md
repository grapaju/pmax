# Google Ads Sync Edge Function

Esta Edge Function conecta com a Google Ads API para sincronizar dados de campanhas.

## Requisitos

1. **Credenciais configuradas na tabela `google_ads_credentials`:**
   - `client_id_val`: Client ID do Google Cloud Console
   - `client_secret`: Client Secret
   - `developer_token`: Token de desenvolvedor do Google Ads
   - `refresh_token`: Token de refresh OAuth2

2. **Access Token válido:**
   - A função precisa implementar refresh token flow para obter access_token
   - Ver: https://developers.google.com/identity/protocols/oauth2/web-server#offline

## Fluxo OAuth2 para obter Refresh Token

### Passo 1: Gerar URL de autorização
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=http://localhost:3000/oauth/callback&
  response_type=code&
  scope=https://www.googleapis.com/auth/adwords&
  access_type=offline&
  prompt=consent
```

### Passo 2: Trocar código por tokens
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d code=AUTHORIZATION_CODE \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d redirect_uri=http://localhost:3000/oauth/callback \
  -d grant_type=authorization_code
```

Resposta:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

Salve o `refresh_token` na tabela `google_ads_credentials`.

### Passo 3: Implementar refresh na Edge Function

Adicione esta função antes da chamada à API:

```typescript
async function getAccessToken(credentials: any): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id_val,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token'
    })
  })
  
  const data = await response.json()
  return data.access_token
}
```

## Deploy

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref YOUR_PROJECT_REF

# Deploy
supabase functions deploy google-ads-sync

# Definir secrets
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

## Teste Local

```bash
supabase functions serve google-ads-sync
```

Fazer chamada de teste:
```bash
curl -X POST http://localhost:54321/functions/v1/google-ads-sync \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"123","googleAdsId":"123-456-7890"}'
```

## Recursos

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [OAuth2 Flow](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
