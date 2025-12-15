-- ================================================================
-- CORREÇÃO: Adicionar coluna google_ads_customer_id à tabela clients
-- Data: 13/12/2025
-- ================================================================

-- Adicionar coluna google_ads_customer_id (ID da conta do cliente no Google Ads)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;

-- Verificar resultado
SELECT 
    client_name,
    client_id,
    google_ads_customer_id
FROM clients
LIMIT 5;

-- ================================================================
-- NOTA: 
-- - google_ads_customer_id = ID da conta do cliente (ex: 123-456-7890)
-- - Credenciais da API ficam em google_ads_credentials (manager)
-- ================================================================
