# Google Ads Scripts (MCC) → Gerenciador PMax

Este diretório contém scripts do **Google Ads Scripts** (rodando em um **MCC**) para enviar dados para o backend Express.

## Endpoint (Render)
- Backend: `https://pmax.onrender.com`
- Ingest: `POST https://pmax.onrender.com/api/google-ads/script-ingest/bulk`
- Header obrigatório: `x-import-key: <GOOGLE_ADS_SCRIPT_IMPORT_KEY>`

## 1) Configure o segredo (IMPORT KEY)
1. No Render (serviço do backend) defina `GOOGLE_ADS_SCRIPT_IMPORT_KEY`.
2. No script, cole o mesmo valor na constante `IMPORT_KEY`.

## 2) Configure o mapeamento de conta → cliente (Supabase)
No script, ajuste:
- `SUPABASE_CLIENT_ID` (UUID do cliente na tabela `clients` do Supabase)
- `ACCOUNT_CUSTOMER_ID` (Customer ID da conta do Google Ads, com ou sem hífens)

> Por enquanto, o script está preparado para **uma conta**.

## 3) Agendamento
No Google Ads Scripts:
- Rode manualmente primeiro para validar
- Depois agende (ex.: diário)

## 4) Verificação
- Backend: `GET https://pmax.onrender.com/health`
- Logs no Supabase: tabela `google_ads_activity_log` com `action='script_ingest'`
- Auditoria do bruto: `google_ads_raw_imports` / `google_ads_raw_import_rows`

Arquivos:
- `mcc-pmax-export.gs` → script principal
