# 🚀 Google Ads Integration - Guia de Instalação

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Configuração do Supabase](#configuração-do-supabase)
4. [Configuração do Google Ads API](#configuração-do-google-ads-api)
5. [Como Usar](#como-usar)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Esta integração traz funcionalidades poderosas do **corcril-ads** para o Gerenciador PMax:

✅ **Coleta automática de dados** via Google Ads API
✅ **Análise de Keywords** (performance, quality score, oportunidades)
✅ **Recomendações automáticas** de otimização
✅ **Armazenamento no Supabase** (PostgreSQL)
✅ **Dashboard interativo** em React

### Arquitetura

```
Google Ads API → DataCollector → Supabase (PostgreSQL)
                      ↓
                  Analyzers
                      ↓
              Recommendation Engine
                      ↓
            React Components (UI)
```

---

## 💿 Instalação

### 1. Instalar dependências

```powershell
cd "d:\Gerenciador PMax"
npm install google-ads-api date-fns @radix-ui/react-progress
```

### 2. Executar migrations no Supabase

Acesse o Supabase Studio → SQL Editor e execute:

```powershell
# Copiar o conteúdo do arquivo para o SQL Editor
Get-Content ".\database\google-ads-tables.sql" | Set-Clipboard
```

Depois cole e execute no Supabase SQL Editor.

---

## 🗄️ Configuração do Supabase

### Verificar tabelas criadas

Após executar as migrations, você deve ter estas tabelas:

- ✅ `google_ads_metrics` - Métricas de campanhas
- ✅ `google_ads_keywords` - Keywords com Quality Score
- ✅ `google_ads_analysis` - Análises completas
- ✅ `google_ads_recommendations` - Recomendações geradas
- ✅ `google_ads_activity_log` - Logs de atividades

### Políticas RLS (Row Level Security)

As políticas já foram criadas automaticamente para:
- ✅ Usuários só veem seus próprios dados
- ✅ Segurança baseada no `client_id`

---

## 🔐 Configuração do Google Ads API

### Passo 1: Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto ou selecione existente
3. Ative a **Google Ads API**:
   - Menu > APIs & Services > Library
   - Busque "Google Ads API"
   - Clique em "Enable"

### Passo 2: OAuth 2.0 Credentials

1. Vá para: APIs & Services > Credentials
2. Clique em "Create Credentials" > "OAuth client ID"
3. Configure OAuth consent screen:
   - User Type: External
   - App name: Gerenciador PMax
   - Seu email nos campos obrigatórios
4. Tipo de aplicativo: **Desktop app**
5. **Copie o Client ID e Client Secret**

### Passo 3: Developer Token

1. Acesse: https://ads.google.com/
2. Tools & Settings > Setup > API Center
3. Solicite acesso (se não tiver)
4. **Copie o Developer Token**

> **Nota**: Para testes, use token de conta teste. Para produção, requer aprovação do Google.

### Passo 4: Refresh Token

**IMPORTANTE:** Antes de executar o script, você precisa adicionar a redirect URI no Google Cloud Console:

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique no seu OAuth 2.0 Client ID (tipo Desktop)
3. Em **"Authorized redirect URIs"**, clique em **"ADD URI"**
4. Adicione exatamente: `http://localhost:3000/oauth2callback`
5. Clique em **"SAVE"**

Agora execute o script para obter o refresh token:

```powershell
node tools/get-google-ads-refresh-token.js
```

O script irá:
1. Pedir seu Client ID e Client Secret
2. Iniciar um servidor local na porta 3000
3. Abrir seu navegador automaticamente
4. Após autorização, exibir o Refresh Token no terminal

**Importante:** Copie apenas o **Refresh Token** (a linha longa que começa com `1//...`)

Se o navegador não abrir automaticamente, copie a URL exibida no terminal e cole no navegador.

---

## 🎮 Como Usar

### 1. Adicionar campos no Supabase (tabela clients)

Execute no SQL Editor do Supabase:

```sql
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_client_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_client_secret TEXT,
ADD COLUMN IF NOT EXISTS google_ads_developer_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_login_customer_id TEXT;
```

### 2. Integrar no Dashboard

Edite o arquivo onde você quer mostrar a integração (ex: `ClientDashboard.jsx`):

```jsx
import GoogleAdsIntegration from '@/components/GoogleAdsIntegration';

// Dentro do componente:
<GoogleAdsIntegration client={currentClient} />
```

### 3. Workflow de Uso

1. **Configurar Credenciais**
   - Vá na aba "Configuração"
   - Preencha Client ID, Client Secret, Developer Token, Refresh Token, Customer ID
   - Clique em "Salvar Credenciais"

2. **Coletar Dados**
   - Clique em "Coletar Dados"
   - Aguarde a coleta (busca últimos 30 dias)
   - Campanhas e keywords serão salvas no Supabase

3. **Executar Análise**
   - Clique em "Executar Análise"
   - O sistema irá:
     - Analisar performance de keywords
     - Calcular Quality Scores
     - Gerar recomendações automáticas

4. **Ver Resultados**
   - Aba "Análise": visualize métricas detalhadas
   - Aba "Recomendações": veja sugestões de otimização

---

## 🔧 Troubleshooting

### Erro: "Invalid developer token"
- Verifique se o token está correto
- Para produção, aguarde aprovação do Google
- Use conta de teste para desenvolvimento

### Erro: "Invalid customer ID"
- Remova hífens: `123-456-7890` → `1234567890`
- Verifique se tem acesso à conta

### Erro: "Invalid refresh token"
- Execute novamente o script de refresh token
- Certifique-se de autorizar com a conta correta

### Erro ao coletar dados
- Verifique conexão com internet
- Confirme que a conta Google Ads tem campanhas ativas
- Verifique permissões de leitura na conta

### Erro ao salvar no Supabase
- Confirme que executou as migrations
- Verifique políticas RLS
- Confira se o `client_id` está correto

---

## 📊 Recursos Disponíveis

### Análise de Keywords
- ✅ Performance Score (0-100)
- ✅ High Performers (top keywords)
- ✅ Low Performers (keywords problemáticas)
- ✅ Oportunidades de expansão
- ✅ Keywords desperdiçando budget

### Quality Score
- ✅ Média geral e distribuição
- ✅ Componentes (Ad Relevance, Landing Page, Expected CTR)
- ✅ Keywords com QS baixo
- ✅ Recomendações específicas

### Recomendações Automáticas
- ✅ Pausar keywords sem conversão
- ✅ Aumentar lances em oportunidades
- ✅ Adicionar palavras negativas
- ✅ Melhorar Quality Score
- ✅ Otimizar landing pages
- ✅ Melhorar anúncios

---

## 🎯 Próximos Passos

Após instalação, você pode:

1. **Automatizar coleta**: criar cron job para coletar dados diariamente
2. **Personalizar thresholds**: ajustar limites de análise para seu negócio
3. **Exportar relatórios**: adicionar export PDF/Excel
4. **Alertas**: configurar notificações para problemas críticos
5. **Dashboard executivo**: criar visualizações agregadas

---

## 📚 Referências

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [google-ads-api NPM](https://www.npmjs.com/package/google-ads-api)
- [Supabase Docs](https://supabase.com/docs)

---

## 🤝 Suporte

Se encontrar problemas:

1. Verifique os logs no console do navegador
2. Confira a tabela `google_ads_activity_log` no Supabase
3. Revise este guia passo a passo
4. Teste com credenciais de conta teste primeiro

**Importante**: Mantenha suas credenciais seguras e nunca commite no Git!
