# 🚀 Guia de Migração - Foreign Keys UUID

**Objetivo:** Converter as Foreign Keys de `campaigns` e `tickets` para usarem UUID ao invés de TEXT, garantindo integridade relacional e performance.

---

## 📋 O Que Esta Migração Faz?

### Problema Atual:
```
┌──────────────┐         ┌──────────────┐
│   clients    │         │  campaigns   │
├──────────────┤         ├──────────────┤
│ id (UUID)    │────┐    │ id (UUID)    │
│ client_id    │    │    │ client_id ⚠️ │ ← Aponta para TEXT
│   (TEXT)     │    └───→│   (TEXT)     │    ao invés de UUID
└──────────────┘         └──────────────┘
     ✓ Correto                ✗ Errado
```

### Depois da Migração:
```
┌──────────────┐         ┌──────────────┐
│   clients    │         │  campaigns   │
├──────────────┤         ├──────────────┤
│ id (UUID) ●──┼────────→│ client_id ✓  │ ← Agora aponta para UUID
│ client_id    │         │   (UUID)     │    (correto!)
│   (TEXT)     │         └──────────────┘
└──────────────┘
   Exibição apenas
```

---

## 🎯 Por Que Fazer Esta Migração?

### ❌ Problemas Sem a Migração:

1. **JOINs Automáticos Falham:**
   ```javascript
   // Isso pode não funcionar:
   .select('*, campaigns(*)')
   // Retorna clientes sem campanhas mesmo que existam
   ```

2. **Performance Ruim:**
   - Joins em TEXT são mais lentos que em UUID
   - Índices menos eficientes

3. **Integridade Comprometida:**
   - Sem FK real, não há validação de dados
   - Possível criar campanhas órfãs (sem cliente válido)

### ✅ Benefícios Após a Migração:

1. **JOINs Automáticos Funcionam:**
   ```javascript
   // Isso funcionará perfeitamente:
   .select('*, campaigns(*)')
   // Retorna clientes com array de campanhas
   ```

2. **Performance Melhor:**
   - JOINs 2-5x mais rápidos
   - Índices otimizados automaticamente

3. **Integridade Garantida:**
   - FK valida cada inserção
   - Impossível criar dados órfãos
   - ON DELETE CASCADE remove campanhas ao deletar cliente

---

## 📖 Explicação Técnica da Migração

### Etapa 1: Adicionar Nova Coluna UUID
```sql
ALTER TABLE campaigns ADD COLUMN client_uuid UUID;
```
**O que faz:** Cria uma nova coluna temporária para armazenar UUIDs.

---

### Etapa 2: Preencher com Dados Corretos
```sql
UPDATE campaigns 
SET client_uuid = clients.id 
FROM clients 
WHERE campaigns.client_id = clients.client_id;
```

**O que faz:** 
- Para cada campanha, busca o cliente correspondente pelo `client_id` (TEXT)
- Pega o `id` (UUID) desse cliente
- Preenche `client_uuid` com esse UUID

**Exemplo:**
```
ANTES:
campaigns.client_id = "C-001" (TEXT)

PROCESSO:
1. Busca em clients onde client_id = "C-001"
2. Encontra: { id: "a1b2c3...", client_id: "C-001" }
3. Pega o UUID: "a1b2c3..."

DEPOIS:
campaigns.client_uuid = "a1b2c3..." (UUID)
```

---

### Etapa 3: Remover Coluna Antiga
```sql
ALTER TABLE campaigns DROP COLUMN client_id;
ALTER TABLE campaigns RENAME COLUMN client_uuid TO client_id;
```

**O que faz:** 
- Remove a coluna TEXT antiga
- Renomeia a coluna UUID para ficar com o mesmo nome

---

### Etapa 4: Criar Foreign Key Constraint
```sql
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE CASCADE;
```

**O que faz:**
- Cria uma constraint (regra) no banco
- Garante que `campaigns.client_id` sempre aponta para um `clients.id` válido
- `ON DELETE CASCADE`: se deletar um cliente, deleta suas campanhas automaticamente

---

### Etapa 5: Row Level Security (RLS)

```sql
CREATE POLICY "Managers can view campaigns" ON campaigns
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE clients.id = campaigns.client_id 
        AND clients.owner_id = auth.uid()
    )
);
```

**O que faz:**
- Garante que managers só vejam campanhas dos seus clientes
- Clients só vejam suas próprias campanhas
- Segurança a nível de linha no banco de dados

---

## 🛡️ Segurança e Rollback

### Antes de Começar:

1. **Backup Automático:**
   - Supabase faz backups diários automaticamente
   - Mas é bom fazer um manual antes

2. **Transações:**
   - Cada bloco SQL usa `BEGIN` e `COMMIT`
   - Se der erro, nada é alterado (atomicidade)

3. **Verificações:**
   - Script tem várias queries de verificação
   - Sempre verifique antes de prosseguir

### Como Fazer Rollback (se necessário):

**Se algo der errado DURANTE a migração:**
```sql
ROLLBACK; -- Desfaz tudo desde o último BEGIN
```

**Se perceber problema DEPOIS da migração:**
1. Ir no Supabase Dashboard > Database > Backups
2. Restaurar o backup criado antes da migração
3. Avisar-me para analisarmos o erro

---

## 📝 Passo a Passo Para Executar

### **Passo 1: Acessar Supabase SQL Editor**

1. Abra [https://supabase.com](https://supabase.com)
2. Selecione seu projeto
3. Menu lateral: **SQL Editor**
4. Clique em "New query"

---

### **Passo 2: Fazer Backup**

1. Menu lateral: **Database** > **Backups**
2. Clique em **"Start a backup"**
3. Aguarde finalizar (pode levar alguns minutos)
4. ✅ Confirme que o backup está listado

---

### **Passo 3: Verificar Estrutura Atual**

Cole no SQL Editor:

```sql
-- Ver tipo de dados das colunas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('clients', 'campaigns', 'tickets')
  AND column_name = 'client_id'
ORDER BY table_name;
```

**Clique em "Run"** ▶️

**Resultado Esperado:**
```
table_name  | column_name | data_type  | is_nullable
------------|-------------|------------|-------------
clients     | client_id   | text       | YES
campaigns   | client_id   | text/uuid  | ?    ← Verificar isso
tickets     | client_id   | text/uuid  | ?    ← Verificar isso
```

📸 **Me envie uma screenshot do resultado!** Vou te dizer o próximo passo.

---

### **Passo 4: Ver Foreign Keys Atuais**

Cole no SQL Editor:

```sql
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
```

**Resultado Esperado (se FK existir):**
```
table_name | column_name | foreign_table_name | foreign_column_name
-----------|-------------|--------------------|-----------------------
campaigns  | client_id   | clients           | client_id ou id ← Ver
tickets    | client_id   | clients           | client_id ou id ← Ver
```

Se não retornar nada = não tem FK criada ainda (precisamos criar).

---

### **Passo 5: Executar Migração**

**⚠️ IMPORTANTE: Só execute depois de me mostrar os resultados dos Passos 3 e 4!**

Vou te passar o script exato baseado na sua estrutura atual.

---

## ❓ Perguntas Frequentes

**P: Vou perder dados?**  
R: Não! A migração apenas reorganiza como os dados estão relacionados. Os dados continuam lá.

**P: O sistema vai ficar fora do ar?**  
R: A migração é muito rápida (< 1 segundo se tiver poucos registros). Mas recomendo fazer em horário de baixo uso.

**P: E se der erro?**  
R: Use `ROLLBACK` ou restaure o backup. Nada será perdido.

**P: Preciso atualizar o código?**  
R: Sim, depois da migração precisa atualizar 2 arquivos. Vou ajudar com isso.

**P: Quanto tempo leva?**  
R: 
- Backup: 2-5 minutos
- Verificação: 1 minuto
- Migração: < 1 minuto
- Testes: 5-10 minutos
- **Total: ~20 minutos**

---

## 🚦 Status Atual

Estamos aqui: **Preparação para Migração**

**Próximo passo:** Execute os Passos 1-4 acima e me mostre os resultados!

Vou aguardar você completar as verificações para continuarmos com segurança. 👍
