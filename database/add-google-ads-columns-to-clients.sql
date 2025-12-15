-- =====================================================
-- ADICIONAR COLUNAS GOOGLE ADS NA TABELA CLIENTS
-- =====================================================

-- Adicionar colunas para credenciais do Google Ads
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_login_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_developer_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_client_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_client_secret TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT;

-- Criar índice para busca rápida por customer_id
CREATE INDEX IF NOT EXISTS idx_clients_google_ads_customer 
ON clients(google_ads_customer_id) 
WHERE google_ads_customer_id IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN clients.google_ads_customer_id IS 'ID do cliente no Google Ads (formato: 123-456-7890)';
COMMENT ON COLUMN clients.google_ads_login_customer_id IS 'Login Customer ID (MCC) para acesso via conta de gerenciamento (opcional)';
COMMENT ON COLUMN clients.google_ads_developer_token IS 'Developer Token do Google Ads API';
COMMENT ON COLUMN clients.google_ads_client_id IS 'OAuth 2.0 Client ID';
COMMENT ON COLUMN clients.google_ads_client_secret IS 'OAuth 2.0 Client Secret';
COMMENT ON COLUMN clients.google_ads_refresh_token IS 'OAuth 2.0 Refresh Token para autenticação';
