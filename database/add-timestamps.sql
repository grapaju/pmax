-- ================================================================
-- CORREÇÃO: Adicionar colunas de timestamp (created_at, updated_at)
-- Data: 13/12/2025
-- ================================================================

-- Adicionar colunas à tabela campaigns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Adicionar colunas à tabela tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Criar trigger para atualizar updated_at automaticamente em campaigns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para campaigns
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para tickets
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar resultado
SELECT 
    'campaigns' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name IN ('created_at', 'updated_at')
UNION ALL
SELECT 
    'tickets' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('created_at', 'updated_at')
ORDER BY table_name, column_name;
