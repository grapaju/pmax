# Deploy no Render (Frontend + Backend)

Este projeto já tem backend **Node.js + Express** (server.js) e frontend **Vite + React**.
A recomendação no Render é subir **2 serviços**:

- **Web Service (Node/Express)**: recebe ingest do Google Ads Script e expõe APIs REST.
- **Static Site (Vite)**: hospeda o frontend.

## 1) Backend (Web Service)

### 1.1 Criar serviço
1. Render → **New** → **Web Service**
2. Conecte o repositório
3. **Root Directory**: deixe vazio (raiz do repo)

### 1.2 Build/Start
- **Build Command**: `npm install`
- **Start Command**: `npm run server`

> O Render injeta `PORT` automaticamente. O server já usa `process.env.PORT`.

### 1.3 Variáveis de ambiente (Environment)
Configure no Render (aba *Environment*):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

- `GOOGLE_ADS_SCRIPT_IMPORT_KEY` (segredo usado pelo Google Ads Script no header `x-import-key`)

- `PUBLIC_BASE_URL` = URL pública do backend no Render (ex.: `https://seu-backend.onrender.com`)
- `CORS_ORIGIN` = URL do frontend (pode ser lista separada por vírgula)
  - Ex.: `https://seu-frontend.onrender.com`
  - Ex.: `https://a.com,https://b.com`

Notas importantes:
- `CORS_ORIGIN` só afeta requisições do navegador (frontend). O Google Ads Script (UrlFetchApp) normalmente não envia header `Origin`, então não é bloqueado pelo CORS.
- Se você deixar `CORS_ORIGIN` vazio, o backend aceita qualquer origem (útil em dev; em produção prefira configurar).

Opcional:
- `DEBUG=false`

### 1.4 Health check
Depois do deploy:
- `GET /health` deve retornar `{ status: "ok" }`

### 1.5 Teste do ingest (sem Google Ads)
Você pode testar o endpoint com um POST manual (isso valida token + JSON + escrita no Supabase).

PowerShell (troque `SEU_TOKEN` e `CLIENT_UUID`):
```powershell
Invoke-RestMethod -Method Post -Uri "https://SEU_BACKEND.onrender.com/api/google-ads/script-ingest/bulk" `
  -Headers @{ "x-import-key" = "SEU_TOKEN" } `
  -ContentType "application/json" `
  -Body (@{
    clientId = "CLIENT_UUID"
    scriptName = "manual-test"
    reportName = "PMax test"
    start = "2025-12-01"
    end = "2025-12-01"
    campaignsRows = @(@{ campaign_id = "123"; campaign_name = "Campanha Teste"; campaign_status = "ENABLED" })
    metricsRows = @(@{ campaign_id = "123"; campaign_name = "Campanha Teste"; date = "2025-12-01"; impressions = 10; clicks = 1; cost = 2.5; conversions = 0; conversion_value = 0 })
    adsRows = @()
    assetsRows = @()
  } | ConvertTo-Json -Depth 10)
```

## 2) Frontend (Static Site)

### 2.1 Criar serviço
1. Render → **New** → **Static Site**
2. Conecte o mesmo repositório

### 2.2 Build/Publish
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

> Se o build falhar por causa de scripts extras, alternativa: `npm install && vite build`.

### 2.3 Variáveis de ambiente do Frontend
Se o frontend precisa apontar para o backend via variável Vite, use `VITE_*`.

Exemplo (se existir no seu app):
- `VITE_API_BASE_URL=https://seu-backend.onrender.com`

## 3) Google Ads Script → Backend

Use a URL do backend no Render:
- `https://seu-backend.onrender.com/api/google-ads/script-ingest/bulk`

E envie o header:
- `x-import-key: <GOOGLE_ADS_SCRIPT_IMPORT_KEY>`

## 4) Checklist final
- Rodou as migrations no Supabase (tabelas + RLS)
- Backend online responde `/health`
- `CORS_ORIGIN` aponta para o domínio do frontend
- Google Ads Script consegue fazer `UrlFetchApp.fetch(...)` para o endpoint

Se você quiser, eu gero um exemplo completo de Google Ads Script (MCC) que envia `campaignsRows/metricsRows/adsRows/assetsRows` no formato do endpoint.
