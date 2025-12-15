-- =====================================================
-- CORRIGIR POLÍTICAS RLS DA TABELA CLIENTS
-- Para permitir UPDATE das colunas do Google Ads
-- =====================================================

-- Remover política antiga de UPDATE se existir
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;

-- Criar nova política de UPDATE que permite atualizar TODAS as colunas
CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Verificar políticas existentes
-- SELECT * FROM pg_policies WHERE tablename = 'clients';
