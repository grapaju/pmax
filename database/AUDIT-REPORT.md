# 🔍 Relatório de Auditoria - Integração com Banco de Dados Supabase

**Data:** 13 de dezembro de 2025  
**Projeto:** Gerenciador de Campanhas Google Ads (PMax)

---

## 📊 Resumo Executivo

Realizei uma análise completa da integração com o banco de dados Supabase e identifiquei **2 problemas críticos** relacionados às chaves estrangeiras (Foreign Keys) que podem estar causando falhas nas queries de relacionamento.

### Status Geral
- ✅ **Conexão com Supabase:** Funcionando
- ✅ **Estrutura de tabelas:** Bem definida
- ⚠️ **Foreign Keys:** Inconsistentes (TEXT ao invés de UUID)
- ⚠️ **Queries com JOIN:** Podem falhar silenciosamente
- ❓ **RLS Policies:** Não verificadas (necessário testar)

---

## 🗄️ Estrutura do Banco de Dados Identificada

### 1️⃣ **Tabela: `users`**
```sql
id              UUID        PRIMARY KEY
email           TEXT        UNIQUE
role            TEXT        ('manager' | 'client')
name            TEXT
```
**Uso:** Autenticação e controle de acesso (Supabase Auth)

---

### 2️⃣ **Tabela: `clients`**
```sql
id              UUID        PRIMARY KEY
client_id       TEXT        (ID customizado ex: "C-001")
client_name     TEXT
email           TEXT
owner_id        UUID        FOREIGN KEY → users.id
```
**Uso:** Armazenamento de clientes  
**⚠️ Atenção:** Possui DOIS identificadores - `id` (UUID) e `client_id` (TEXT customizado)

---

### 3️⃣ **Tabela: `campaigns`** ⚠️ PROBLEMA AQUI
```sql
id              UUID        PRIMARY KEY
client_id       TEXT/UUID   ⚠️ FOREIGN KEY → clients.client_id ou clients.id?
name            TEXT
budget          NUMERIC
status          TEXT
data            JSONB       (métricas: spend, conversions, roas, etc)
updated_at      TIMESTAMP
```

**🚨 PROBLEMA CRÍTICO:**  
O código em `ManagerDashboard.jsx` (linha 98) usa:
```javascript
.insert([{
    client_id: clientData.client_id, // ← TEXT (ex: "C-001")
}])
```

Mas o ideal seria usar:
```javascript
.insert([{
    client_id: clientData.id, // ← UUID
}])
```

**Impacto:**
- Queries com `.select('*, campaigns(*)')` podem não funcionar
- Problemas ao fazer JOINs nativos no PostgreSQL
- Inconsistência com padrões de banco de dados

---

### 4️⃣ **Tabela: `campaign_history`**
```sql
id              UUID        PRIMARY KEY
campaign_id     UUID        FOREIGN KEY → campaigns.id ✅
data            JSONB
period_start    TEXT/DATE
period_end      TEXT/DATE
created_at      TIMESTAMP
```
**Uso:** Versionamento de dados de campanhas  
**✅ Status:** FK correta (UUID)

---

### 5️⃣ **Tabela: `tickets`** ⚠️ PROBLEMA AQUI
```sql
id              UUID        PRIMARY KEY
ticket_id       TEXT        (ex: "TKT-123456")
title           TEXT
description     TEXT
status          TEXT
priority        TEXT
created_by      TEXT        (email)
client_id       TEXT/UUID   ⚠️ FOREIGN KEY → clients.client_id ou clients.id?
assigned_to     TEXT        (email)
updated_at      TIMESTAMP
```

**🚨 PROBLEMA CRÍTICO:**  
Similar ao problema anterior - `TicketsSystem.jsx` (linha 157) usa TEXT ao invés de UUID.

---

### 6️⃣ **Tabela: `ticket_messages`**
```sql
id              UUID        PRIMARY KEY
ticket_id       UUID        FOREIGN KEY → tickets.id ✅
sender_email    TEXT
sender_name     TEXT
sender_role     TEXT
content         TEXT
created_at      TIMESTAMP
```
**✅ Status:** FK correta

---

### 7️⃣ **Tabela: `google_ads_credentials`**
```sql
user_id             UUID        PRIMARY KEY, FOREIGN KEY → users.id
client_id_val       TEXT        (não confundir com client_id de outras tabelas)
client_secret       TEXT
developer_token     TEXT
refresh_token       TEXT
```
**Uso:** Armazenamento seguro de credenciais da API Google Ads  
**✅ Status:** Estrutura correta

---

## 🚨 Problemas Identificados

### **Problema #1: FK em `campaigns.client_id`**

**Localização:** `src/components/ManagerDashboard.jsx` linha 98-103

**Código Problemático:**
```javascript
const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .insert([{
        client_id: newClientData.clientId, // ← Cria "C-001"
        client_name: newClientData.name,
        email: newClientData.email,
        owner_id: user.id
    }])
    .select()
    .single();

// Depois tenta criar campanha usando o TEXT ao invés do UUID:
const { error: campError } = await supabase
    .from('campaigns')
    .insert([{
        client_id: clientData.client_id, // ⚠️ ERRO: usando TEXT ("C-001")
        name: 'Campanha Padrão',
        // ...
    }]);
```

**Correção:**
```javascript
const { error: campError } = await supabase
    .from('campaigns')
    .insert([{
        client_id: clientData.id, // ✅ CORRETO: usando UUID
        name: 'Campanha Padrão',
        // ...
    }]);
```

---

### **Problema #2: FK em `tickets.client_id`**

**Localização:** `src/components/TicketsSystem.jsx` linha 157-167

**Código Problemático:**
```javascript
const { data: ticketData, error: ticketError } = await supabase
    .from('tickets')
    .insert([{
        ticket_id: ticketIdStr,
        title: newTicketData.title,
        // ...
        client_id: targetClientId, // ⚠️ ERRO: pode ser TEXT
    }])
```

O código tenta pegar o `client_id` (TEXT) quando deveria pegar o `id` (UUID):
```javascript
const clientObj = clients.find(c => c.id === targetClientId);
if (clientObj) {
    targetClientId = clientObj.client_id; // ⚠️ ERRO: pegando TEXT
    // ...
}
```

**Correção:**
```javascript
const clientObj = clients.find(c => c.id === targetClientId);
if (clientObj) {
    targetClientId = clientObj.id; // ✅ CORRETO: usando UUID
    // ...
}
```

---

### **Problema #3: Queries com JOIN podem falhar**

**Localização:** Vários componentes

**Queries Afetadas:**
```javascript
// ManagerDashboard.jsx linha 42
.from('clients')
.select(`
    *,
    campaigns (*)  // ⚠️ Este JOIN pode falhar se FK estiver errada
`)

// ClientDashboard.jsx linha 25
.from('clients')
.select(`
    *,
    campaigns (*)  // ⚠️ Mesma situação
`)
```

**Como Funciona no Supabase:**  
Quando você usa `campaigns (*)`, o Supabase busca automaticamente uma FK entre as tabelas. Se a FK estiver em TEXT ao invés de UUID, o JOIN pode não funcionar ou retornar vazio.

---

## ✅ Soluções Propostas

### **Opção 1: Migrar o Banco de Dados (RECOMENDADO)**

Execute o script SQL fornecido em `database/migration-fix-foreign-keys.sql`:

1. **Backup do banco** via Supabase Dashboard
2. Executar verificação da estrutura atual
3. Migrar `campaigns.client_id` de TEXT → UUID
4. Migrar `tickets.client_id` de TEXT → UUID
5. Configurar RLS (Row Level Security) policies
6. Testar todas as queries

**Vantagens:**
- ✅ Consistência total no banco de dados
- ✅ Performance melhor em JOINs
- ✅ Padrão correto de modelagem relacional
- ✅ Evita erros futuros

**Desvantagens:**
- ⚠️ Requer migração de dados
- ⚠️ Precisa atualizar o código frontend

---

### **Opção 2: Ajustar Apenas o Código (RÁPIDO, mas não ideal)**

Corrigir os pontos específicos no código para usar UUID:

**Arquivos a modificar:**
1. `src/components/ManagerDashboard.jsx` (linha 98)
2. `src/components/TicketsSystem.jsx` (linha 157)

**Mudanças:**
```javascript
// Antes:
client_id: clientData.client_id, // TEXT

// Depois:
client_id: clientData.id, // UUID
```

**Vantagens:**
- ✅ Rápido de implementar
- ✅ Não precisa mexer no banco

**Desvantagens:**
- ⚠️ Mantém inconsistência no modelo de dados
- ⚠️ O campo `clients.client_id` (TEXT) fica sem uso
- ⚠️ Pode confundir desenvolvedores futuros

---

## 🧪 Como Testar Após Correções

### **1. Testar Criação de Cliente e Campanha:**
```javascript
// No console do navegador (com usuário manager logado):
const testClient = await supabase
    .from('clients')
    .insert({
        client_id: 'TEST-001',
        client_name: 'Cliente Teste',
        email: 'teste@exemplo.com',
        owner_id: user.id
    })
    .select()
    .single();

console.log('Cliente criado:', testClient);

const testCampaign = await supabase
    .from('campaigns')
    .insert({
        client_id: testClient.data.id, // ← Deve ser UUID
        name: 'Campanha Teste',
        budget: 1000,
        status: 'active',
        data: {}
    })
    .select();

console.log('Campanha criada:', testCampaign);
```

### **2. Testar Query com JOIN:**
```javascript
const result = await supabase
    .from('clients')
    .select(`
        *,
        campaigns (*)
    `)
    .eq('owner_id', user.id);

console.log('Clientes com campanhas:', result);
// Deve retornar clientes com array de campaigns dentro
```

### **3. Verificar no Supabase Dashboard:**
- SQL Editor → Executar:
```sql
SELECT 
    c.client_name,
    c.id as client_uuid,
    c.client_id as client_custom_id,
    camp.name as campaign_name,
    camp.client_id as campaign_fk
FROM clients c
LEFT JOIN campaigns camp ON camp.client_id = c.id
LIMIT 10;
```

**Resultado Esperado:**  
- `client_uuid` = UUID (ex: "550e8400-e29b-41d4-a716-446655440000")
- `campaign_fk` = Mesmo UUID de `client_uuid`

---

## 📝 Checklist de Verificação

Execute estes passos para confirmar que está tudo OK:

- [ ] **Backup do banco de dados realizado**
- [ ] **Verificar estrutura atual das FKs** (script SQL seção 2)
- [ ] **Decidir entre Opção 1 (migração) ou Opção 2 (código)**
- [ ] **Aplicar correções escolhidas**
- [ ] **Testar criação de cliente + campanha**
- [ ] **Testar query com JOIN automático**
- [ ] **Testar criação de ticket**
- [ ] **Verificar RLS policies** (managers vs clients)
- [ ] **Testar em produção com dados reais**

---

## 🎯 Recomendação Final

**Minha recomendação é seguir a Opção 1 (Migração do Banco)** pelos seguintes motivos:

1. **Consistência:** Todos os relacionamentos usarão UUID
2. **Performance:** JOINs nativos do PostgreSQL são muito mais rápidos
3. **Manutenibilidade:** Código mais limpo e fácil de entender
4. **Escalabilidade:** Evita problemas futuros ao adicionar novas features

**Próximos Passos:**
1. Fazer backup completo do banco
2. Executar o script de migração em ambiente de teste
3. Testar todas as funcionalidades
4. Aplicar em produção
5. Monitorar logs por 24-48h

---

## 📞 Dúvidas?

Se encontrar algum erro durante a migração ou tiver dúvidas sobre qualquer parte deste relatório, me avise que posso ajudar a resolver!

**Arquivos Criados:**
- `database/migration-fix-foreign-keys.sql` - Script completo de migração e RLS policies
- `database/AUDIT-REPORT.md` - Este relatório

**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Data:** 13/12/2025
