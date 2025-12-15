-- ================================================================
-- MIGRAÇÃO FINAL - Foreign Keys para UUID
-- Data: 13/12/2025
-- Projeto: Gerenciador PMax
-- ================================================================
-- IMPORTANTE: Execute cada seção separadamente e verifique os resultados!
-- ================================================================

-- ================================================================
-- SEÇÃO 1: BACKUP E VERIFICAÇÃO INICIAL
-- ================================================================

-- 1.1 Ver quantos registros temos (para estimar tempo de migração)
SELECT 
    'clients' as tabela, 
    COUNT(*) as total_registros 
FROM clients

UNION ALL

SELECT 
    'campaigns' as tabela, 
    COUNT(*) as total_registros 
FROM campaigns

UNION ALL

SELECT 
    'tickets' as tabela, 
    COUNT(*) as total_registros 
FROM tickets;

-- AGUARDE O RESULTADO ANTES DE CONTINUAR!
-- Se tiver mais de 10.000 registros, me avise antes de continuar.


-- ================================================================
-- SEÇÃO 2: MIGRAR TABELA CAMPAIGNS
-- ================================================================

-- 2.1 Iniciar transação (tudo ou nada!)
BEGIN;

-- 2.2 Remover a FK antiga (TEXT → TEXT)
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_client_id_fkey;

-- 2.3 Adicionar nova coluna UUID temporária
ALTER TABLE campaigns 
ADD COLUMN client_uuid UUID;

-- 2.4 Preencher com o UUID correspondente
UPDATE campaigns 
SET client_uuid = clients.id 
FROM clients 
WHERE campaigns.client_id = clients.client_id;

-- 2.5 VERIFICAÇÃO CRÍTICA: Confirmar que todos os registros foram migrados
SELECT 
    COUNT(*) as total_campaigns, 
    COUNT(client_uuid) as migrated_campaigns,
    COUNT(*) - COUNT(client_uuid) as failed_migrations
FROM campaigns;

-- ⚠️ IMPORTANTE: Se failed_migrations > 0, execute ROLLBACK; e me avise!
-- Se failed_migrations = 0, continue:

-- 2.6 Remover policies antigas que dependem de client_id
DROP POLICY IF EXISTS "Managers manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Clients view own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers manage history" ON campaign_history;
DROP POLICY IF EXISTS "Clients view own history" ON campaign_history;
DROP POLICY IF EXISTS "Managers can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Clients can view their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers can insert campaigns" ON campaigns;

-- 2.7 Remover coluna TEXT antiga
ALTER TABLE campaigns 
DROP COLUMN client_id;

-- 2.8 Renomear coluna UUID para client_id
ALTER TABLE campaigns 
RENAME COLUMN client_uuid TO client_id;

-- 2.9 Criar nova FK (UUID → UUID)
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;

-- 2.10 Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id 
ON campaigns(client_id);

-- 2.11 Tornar coluna NOT NULL (boa prática)
ALTER TABLE campaigns 
ALTER COLUMN client_id SET NOT NULL;

-- 2.12 Finalizar transação
COMMIT;

-- ✅ Pronto! Tabela campaigns migrada com sucesso!


-- ================================================================
-- SEÇÃO 3: VERIFICAR MIGRAÇÃO DE CAMPAIGNS
-- ================================================================

-- 3.1 Ver estrutura nova
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name = 'client_id';

-- Deve retornar: client_id | uuid | NO

-- 3.2 Ver FK criada
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
  AND tc.table_name = 'campaigns';

-- Deve retornar: campaigns | client_id | clients | id

-- 3.3 Testar JOIN
SELECT 
    c.client_name,
    c.id as client_uuid,
    c.client_id as client_display_id,
    camp.name as campaign_name,
    camp.client_id as campaign_fk
FROM clients c
LEFT JOIN campaigns camp ON camp.client_id = c.id
LIMIT 5;

-- ✅ Se retornar dados corretamente, tudo OK!


-- ================================================================
-- SEÇÃO 4: MIGRAR TABELA TICKETS
-- ================================================================

-- 4.1 Iniciar transação
BEGIN;

-- 4.2 Remover FK antiga se existir
ALTER TABLE tickets 
DROP CONSTRAINT IF EXISTS tickets_client_id_fkey;

-- 4.3 Adicionar coluna UUID temporária
ALTER TABLE tickets 
ADD COLUMN client_uuid UUID;

-- 4.4 Preencher com UUID correspondente
UPDATE tickets 
SET client_uuid = clients.id 
FROM clients 
WHERE tickets.client_id = clients.client_id;

-- 4.5 VERIFICAÇÃO CRÍTICA
SELECT 
    COUNT(*) as total_tickets, 
    COUNT(client_uuid) as migrated_tickets,
    COUNT(*) - COUNT(client_uuid) as failed_migrations
FROM tickets;

-- ⚠️ Se failed_migrations > 0, execute ROLLBACK; e me avise!
-- Se = 0, continue:

-- 4.6 Remover policies antigas que dependem de client_id
DROP POLICY IF EXISTS "Clients access own tickets" ON tickets;
DROP POLICY IF EXISTS "Users access messages for their tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can view related tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update related tickets" ON tickets;

-- 4.7 Remover coluna TEXT antiga
ALTER TABLE tickets 
DROP COLUMN client_id;

-- 4.8 Renomear para client_id
ALTER TABLE tickets 
RENAME COLUMN client_uuid TO client_id;

-- 4.9 Criar FK
ALTER TABLE tickets 
ADD CONSTRAINT tickets_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;

-- 4.10 Criar índice
CREATE INDEX IF NOT EXISTS idx_tickets_client_id 
ON tickets(client_id);

-- 4.11 NOT NULL (permitir NULL já que pode não ter tickets ainda)
-- Comentado porque tabela está vazia
-- ALTER TABLE tickets 
-- ALTER COLUMN client_id SET NOT NULL;

-- 4.12 Finalizar transação
COMMIT;

-- ✅ Tabela tickets migrada!


-- ================================================================
-- SEÇÃO 5: VERIFICAÇÃO FINAL
-- ================================================================

-- 5.1 Ver todas as FKs
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
  AND tc.table_name IN ('campaigns', 'tickets')
ORDER BY tc.table_name;

-- Deve retornar:
-- campaigns | client_id | clients | id
-- tickets   | client_id | clients | id

-- 5.2 Testar integridade referencial
-- Tentar inserir campanha com client_id inválido (DEVE FALHAR!)
INSERT INTO campaigns (name, client_id, budget, status, data)
VALUES ('Teste', '00000000-0000-0000-0000-000000000000', 1000, 'test', '{}');

-- ❌ Se der erro "violates foreign key constraint" = PERFEITO!
-- ✅ Isso significa que a FK está funcionando!


-- ================================================================
-- SEÇÃO 6: CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ================================================================

-- 6.1 Habilitar RLS em todas as tabelas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- 6.2 Remover policies antigas (se existirem)
DROP POLICY IF EXISTS "Managers can view their own clients" ON clients;
DROP POLICY IF EXISTS "Clients can view their own data" ON clients;
DROP POLICY IF EXISTS "Managers can insert clients" ON clients;
DROP POLICY IF EXISTS "Managers can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Clients can view their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers can update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers can insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can view related tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update related tickets" ON tickets;

-- 6.3 POLICIES PARA CLIENTS
CREATE POLICY "Managers can view their own clients" ON clients
FOR SELECT USING (
    auth.uid() = owner_id
);

CREATE POLICY "Clients can view their own data" ON clients
FOR SELECT USING (
    auth.jwt() ->> 'email' = email
);

CREATE POLICY "Managers can insert clients" ON clients
FOR INSERT WITH CHECK (
    auth.uid() = owner_id
);

CREATE POLICY "Managers can update their clients" ON clients
FOR UPDATE USING (
    auth.uid() = owner_id
);

-- 6.4 POLICIES PARA CAMPAIGNS
CREATE POLICY "Managers can view campaigns" ON campaigns
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);

CREATE POLICY "Clients can view their campaigns" ON campaigns
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.email = (auth.jwt() ->> 'email')
    )
);

CREATE POLICY "Managers can update campaigns" ON campaigns
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);

CREATE POLICY "Managers can insert campaigns" ON campaigns
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);

-- 6.5 POLICIES PARA TICKETS
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

CREATE POLICY "Users can create tickets" ON tickets
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update related tickets" ON tickets
FOR UPDATE USING (
    created_by = (auth.jwt() ->> 'email')
    OR assigned_to = (auth.jwt() ->> 'email')
);

-- 6.6 POLICIES PARA CAMPAIGN_HISTORY
CREATE POLICY "Users can view related campaign history" ON campaign_history
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM campaigns
        JOIN clients ON clients.id = campaigns.client_id
        WHERE campaigns.id = campaign_history.campaign_id
        AND (clients.owner_id = auth.uid() OR clients.email = (auth.jwt() ->> 'email'))
    )
);

CREATE POLICY "Managers can insert campaign history" ON campaign_history
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM campaigns
        JOIN clients ON clients.id = campaigns.client_id
        WHERE campaigns.id = campaign_history.campaign_id
        AND clients.owner_id = auth.uid()
    )
);

-- ✅ RLS configurado!


-- ================================================================
-- SEÇÃO 7: TESTE FINAL COMPLETO
-- ================================================================

-- 7.1 Ver estrutura final de todas as tabelas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('clients', 'campaigns', 'tickets')
  AND column_name IN ('id', 'client_id')
ORDER BY table_name, column_name;

-- Esperado:
-- campaigns | client_id | uuid | NO
-- campaigns | id        | uuid | NO
-- clients   | client_id | text | YES
-- clients   | id        | uuid | NO
-- tickets   | client_id | uuid | NO
-- tickets   | id        | uuid | NO

-- 7.2 Testar query que antes falhava
SELECT 
    c.id,
    c.client_id as display_id,
    c.client_name,
    COUNT(camp.id) as total_campaigns,
    COUNT(t.id) as total_tickets
FROM clients c
LEFT JOIN campaigns camp ON camp.client_id = c.id
LEFT JOIN tickets t ON t.client_id = c.id
GROUP BY c.id, c.client_id, c.client_name;

-- ✅ Se retornar dados = SUCESSO TOTAL!


-- ================================================================
-- 🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!
-- ================================================================

-- Próximos passos:
-- 1. ✅ Migração do banco de dados concluída
-- 2. 📝 Atualizar código frontend (ManagerDashboard.jsx e TicketsSystem.jsx)
-- 3. 🧪 Testar aplicação completa
-- 4. 🚀 Deploy em produção

-- Se tudo funcionou, PARABÉNS! 🎊
-- Se algo deu errado, me avise com o erro exato!
