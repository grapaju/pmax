-- ================================================================
-- MIGRAÇÃO: Correção de Foreign Keys para usar UUID
-- Data: 2025-12-13
-- Descrição: Corrige as FKs de campaigns e tickets que estavam
--            usando TEXT (client_id customizado) para UUID
-- ================================================================

-- ===== 1. BACKUP DAS TABELAS =====
-- Antes de fazer qualquer alteração, faça backup!
-- No Supabase Dashboard: Database > Backups

-- ===== 2. VERIFICAR ESTRUTURA ATUAL =====
-- Execute estas queries para ver a estrutura atual:

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('clients', 'campaigns', 'tickets')
ORDER BY table_name, ordinal_position;

-- Ver Foreign Keys existentes:
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('campaigns', 'tickets');

-- ===== 3. OPÇÃO A: Se a FK de campaigns está em TEXT =====
-- (Execute SOMENTE se confirmado que client_id em campaigns é TEXT)

BEGIN;

-- 3.1. Adicionar nova coluna UUID
ALTER TABLE campaigns 
ADD COLUMN client_uuid UUID;

-- 3.2. Preencher com o UUID correspondente
UPDATE campaigns 
SET client_uuid = clients.id 
FROM clients 
WHERE campaigns.client_id = clients.client_id;

-- 3.3. Verificar se todos os registros foram migrados
SELECT COUNT(*) as total_campaigns, 
       COUNT(client_uuid) as migrated_campaigns 
FROM campaigns;
-- Se total_campaigns = migrated_campaigns, tudo OK!

-- 3.4. Remover constraint antiga (se existir)
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_client_id_fkey;

-- 3.5. Remover coluna antiga
ALTER TABLE campaigns 
DROP COLUMN client_id;

-- 3.6. Renomear nova coluna
ALTER TABLE campaigns 
RENAME COLUMN client_uuid TO client_id;

-- 3.7. Adicionar nova FK constraint
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;

-- 3.8. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id 
ON campaigns(client_id);

COMMIT;

-- ===== 4. OPÇÃO B: Se campaigns.client_id JÁ é UUID =====
-- (Execute esta verificação primeiro)

SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name = 'client_id';

-- Se retornar 'uuid', a tabela campaigns está OK!
-- Apenas garanta que a FK existe:

ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_client_id_fkey;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;

-- ===== 5. CORRIGIR TABELA TICKETS (mesmo processo) =====

BEGIN;

-- Verificar estrutura atual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' AND column_name = 'client_id';

-- Se client_id for TEXT, executar migração:
ALTER TABLE tickets ADD COLUMN client_uuid UUID;

UPDATE tickets 
SET client_uuid = clients.id 
FROM clients 
WHERE tickets.client_id = clients.client_id;

-- Verificar migração
SELECT COUNT(*) as total_tickets, 
       COUNT(client_uuid) as migrated_tickets 
FROM tickets;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_client_id_fkey;
ALTER TABLE tickets DROP COLUMN client_id;
ALTER TABLE tickets RENAME COLUMN client_uuid TO client_id;

ALTER TABLE tickets 
ADD CONSTRAINT tickets_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tickets_client_id 
ON tickets(client_id);

COMMIT;

-- ===== 6. VERIFICAÇÃO FINAL =====

-- Verificar FKs criadas corretamente
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('campaigns', 'tickets');

-- Deve retornar:
-- campaigns | client_id | clients | id
-- tickets   | client_id | clients | id

-- ===== 7. TESTAR QUERIES =====

-- Testar join automático do Supabase
SELECT 
    clients.id,
    clients.client_name,
    campaigns.id as campaign_id,
    campaigns.name as campaign_name
FROM clients
LEFT JOIN campaigns ON campaigns.client_id = clients.id
LIMIT 5;

-- ===== 8. CONFIGURAR RLS (Row Level Security) =====
-- Execute após confirmar que as FKs estão corretas

-- Habilitar RLS em todas as tabelas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_credentials ENABLE ROW LEVEL SECURITY;

-- ===== Policies para CLIENTS =====

-- Manager pode ver todos os seus clientes
CREATE POLICY "Managers can view their own clients" ON clients
FOR SELECT USING (
    auth.uid() = owner_id
);

-- Clients podem ver apenas seu próprio registro
CREATE POLICY "Clients can view their own data" ON clients
FOR SELECT USING (
    auth.jwt() ->> 'email' = email
);

-- Manager pode inserir clientes
CREATE POLICY "Managers can insert clients" ON clients
FOR INSERT WITH CHECK (
    auth.uid() = owner_id
);

-- ===== Policies para CAMPAIGNS =====

-- Manager pode ver campaigns dos seus clientes
CREATE POLICY "Managers can view campaigns" ON campaigns
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);

-- Clients podem ver suas próprias campaigns
CREATE POLICY "Clients can view their campaigns" ON campaigns
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.email = (auth.jwt() ->> 'email')
    )
);

-- Manager pode atualizar campaigns
CREATE POLICY "Managers can update campaigns" ON campaigns
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);

-- ===== Policies para TICKETS =====

-- Todos podem ver tickets relacionados a eles
CREATE POLICY "Users can view related tickets" ON tickets
FOR SELECT USING (
    created_by = (auth.jwt() ->> 'email')
    OR assigned_to = (auth.jwt() ->> 'email')
    OR EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = tickets.client_id 
        AND (clients.owner_id = auth.uid() OR clients.email = (auth.jwt() ->> 'email'))
    )
);

-- Todos podem criar tickets
CREATE POLICY "Users can create tickets" ON tickets
FOR INSERT WITH CHECK (true);

-- Todos podem atualizar tickets relacionados
CREATE POLICY "Users can update related tickets" ON tickets
FOR UPDATE USING (
    created_by = (auth.jwt() ->> 'email')
    OR assigned_to = (auth.jwt() ->> 'email')
);

-- ===== Policies para TICKET_MESSAGES =====

CREATE POLICY "Users can view related ticket messages" ON ticket_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM tickets 
        WHERE tickets.id = ticket_messages.ticket_id 
        AND (
            tickets.created_by = (auth.jwt() ->> 'email')
            OR tickets.assigned_to = (auth.jwt() ->> 'email')
        )
    )
);

CREATE POLICY "Users can insert ticket messages" ON ticket_messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets 
        WHERE tickets.id = ticket_messages.ticket_id 
        AND (
            tickets.created_by = (auth.jwt() ->> 'email')
            OR tickets.assigned_to = (auth.jwt() ->> 'email')
        )
    )
);

-- ===== NOTAS IMPORTANTES =====
-- 1. Faça backup antes de executar qualquer migração
-- 2. Teste em ambiente de desenvolvimento primeiro
-- 3. Execute cada seção separadamente e verifique os resultados
-- 4. As policies RLS podem ser ajustadas conforme necessidades específicas
-- 5. Monitore os logs do Supabase após aplicar as mudanças
