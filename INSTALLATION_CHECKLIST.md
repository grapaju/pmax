# ✅ CHECKLIST DE INSTALAÇÃO - Google Ads Integration

## 📦 FASE 1: Instalação de Dependências

- [ ] Executar: `npm install google-ads-api google-auth-library date-fns @radix-ui/react-progress`
- [ ] Verificar se não há erros de instalação
- [ ] Verificar se `package.json` foi atualizado

## 🗄️ FASE 2: Configuração do Supabase

- [ ] Abrir Supabase Studio (https://supabase.com/dashboard)
- [ ] Ir em SQL Editor
- [ ] Copiar conteúdo de `database/google-ads-tables.sql`
- [ ] Executar SQL no editor
- [ ] Verificar se 5 tabelas foram criadas:
  - [ ] google_ads_metrics
  - [ ] google_ads_keywords
  - [ ] google_ads_analysis
  - [ ] google_ads_recommendations
  - [ ] google_ads_activity_log
- [ ] Adicionar colunas na tabela `clients`:
```sql
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_client_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_client_secret TEXT,
ADD COLUMN IF NOT EXISTS google_ads_developer_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_login_customer_id TEXT;
```

## 🔐 FASE 3: Configuração Google Cloud Console

- [ ] Acessar https://console.cloud.google.com/
- [ ] Criar ou selecionar projeto
- [ ] Ativar Google Ads API:
  - [ ] Menu > APIs & Services > Library
  - [ ] Buscar "Google Ads API"
  - [ ] Clicar em "Enable"
- [ ] Criar OAuth 2.0 Credentials:
  - [ ] APIs & Services > Credentials
  - [ ] Create Credentials > OAuth client ID
  - [ ] Configurar OAuth consent screen
  - [ ] Tipo: Desktop app
  - [ ] **Copiar Client ID** (guardar em local seguro)
  - [ ] **Copiar Client Secret** (guardar em local seguro)

## 📱 FASE 4: Configuração Google Ads

- [ ] Acessar https://ads.google.com/
- [ ] Tools & Settings > Setup > API Center
- [ ] Solicitar acesso à API (se necessário)
- [ ] **Copiar Developer Token** (guardar em local seguro)
- [ ] **Copiar Customer ID** da conta (ex: 123-456-7890)

## 🔑 FASE 5: Obter Refresh Token

**PASSO 1: Configurar Redirect URI no Google Cloud Console**
- [ ] Acessar https://console.cloud.google.com/apis/credentials
- [ ] Clicar no OAuth 2.0 Client ID criado anteriormente
- [ ] Em "Authorized redirect URIs", clicar em "ADD URI"
- [ ] Adicionar exatamente: `http://localhost:3000/oauth2callback`
- [ ] Clicar em "SAVE"
- [ ] Aguardar alguns segundos para propagação

**PASSO 2: Executar Script**
- [ ] Executar: `node tools/get-google-ads-refresh-token.js`
- [ ] Inserir Client ID quando solicitado
- [ ] Inserir Client Secret quando solicitado
- [ ] Aguardar o navegador abrir automaticamente
- [ ] Se não abrir, copiar URL do terminal e abrir manualmente

**PASSO 3: Autorizar no Navegador**
- [ ] Fazer login com conta Google Ads
- [ ] Selecionar a conta correta
- [ ] Clicar em "Permitir" / "Allow"
- [ ] Aguardar redirecionamento para localhost

**PASSO 4: Copiar Refresh Token**
- [ ] Voltar para o terminal
- [ ] **Copiar apenas o Refresh Token** (linha que começa com `1//...`)
- [ ] Guardar em local seguro
- [ ] NÃO copiar o Access Token (ele expira em 1 hora)

## 🎨 FASE 6: Integração no Frontend

Escolha UMA das opções:

### Opção A: Como Tab no Dashboard Existente
- [ ] Abrir arquivo do dashboard (ex: `src/components/ClientDashboard.jsx`)
- [ ] Importar: `import GoogleAdsIntegration from '@/components/GoogleAdsIntegration';`
- [ ] Adicionar tab "Google Ads" nas tabs
- [ ] Adicionar componente dentro da tab: `<GoogleAdsIntegration client={currentClient} />`

### Opção B: Como Seção Separada
- [ ] Importar componente no dashboard
- [ ] Adicionar seção com `<GoogleAdsIntegration client={currentClient} />`

### Opção C: Como Página/Rota Separada
- [ ] Criar arquivo `src/pages/GoogleAdsPage.jsx`
- [ ] Adicionar rota em `App.jsx` ou arquivo de rotas
- [ ] Implementar navegação para a página

Ver exemplos detalhados em: `INTEGRATION_EXAMPLES.jsx`

## 🧪 FASE 7: Teste Inicial

- [ ] Executar: `npm run dev`
- [ ] Acessar o dashboard no navegador
- [ ] Navegar até a seção/tab de Google Ads
- [ ] Verificar se o componente renderiza sem erros
- [ ] Ir na aba "Configuração"
- [ ] Preencher todos os campos:
  - [ ] Client ID
  - [ ] Client Secret
  - [ ] Developer Token
  - [ ] Refresh Token
  - [ ] Customer ID
  - [ ] Login Customer ID (se usar MCC)
- [ ] Clicar em "Salvar Credenciais"
- [ ] Verificar mensagem de sucesso

## 📊 FASE 8: Coleta de Dados

- [ ] Na aba "Configuração", clicar em "Coletar Dados"
- [ ] Aguardar processo (pode levar 30-60 segundos)
- [ ] Verificar mensagem de sucesso
- [ ] Confirmar no Supabase que dados foram salvos:
  - [ ] Verificar tabela `google_ads_metrics`
  - [ ] Verificar tabela `google_ads_keywords`

## 🔍 FASE 9: Executar Análise

- [ ] Na aba "Configuração", clicar em "Executar Análise"
- [ ] Aguardar processo (pode levar 10-20 segundos)
- [ ] Verificar mensagem de sucesso
- [ ] Confirmar no Supabase:
  - [ ] Verificar tabela `google_ads_analysis`
  - [ ] Verificar tabela `google_ads_recommendations`

## 📈 FASE 10: Verificar Resultados

- [ ] Ir na aba "Análise"
- [ ] Verificar se cards de resumo aparecem
- [ ] Verificar tabs:
  - [ ] Performance (keywords de alto/baixo desempenho)
  - [ ] Quality Score (distribuição e componentes)
  - [ ] Oportunidades (keywords para expandir)
  - [ ] Desperdício (keywords problemáticas)
- [ ] Ir na aba "Recomendações"
- [ ] Verificar se recomendações foram geradas
- [ ] Testar filtros (todas, alta, média, baixa prioridade)
- [ ] Testar ações (Implementada, Descartar)

## 🎉 FASE 11: Pronto para Usar!

Se todos os itens acima foram marcados, a integração está completa!

### Próximos passos opcionais:
- [ ] Configurar coleta automática (cron job)
- [ ] Personalizar thresholds de análise
- [ ] Adicionar exportação de relatórios
- [ ] Configurar alertas/notificações
- [ ] Criar dashboards executivos

## 🆘 Troubleshooting

Se algo não funcionar:

1. **Erro ao instalar dependências**
   - [ ] Deletar `node_modules` e `package-lock.json`
   - [ ] Executar `npm install` novamente

2. **Erro ao executar SQL**
   - [ ] Verificar se está conectado ao projeto correto no Supabase
   - [ ] Verificar permissões do usuário

3. **Erro "Invalid developer token"**
   - [ ] Verificar se o token está correto (sem espaços)
   - [ ] Para produção, aguardar aprovação do Google
   - [ ] Usar conta de teste para desenvolvimento

4. **Erro "Invalid customer ID"**
   - [ ] Remover hífens: `123-456-7890` → `1234567890`
   - [ ] Verificar se tem acesso à conta Google Ads

5. **Erro ao coletar dados**
   - [ ] Verificar credenciais salvas no Supabase
   - [ ] Verificar console do navegador para erros
   - [ ] Verificar tabela `google_ads_activity_log` para detalhes

6. **Componente não renderiza**
   - [ ] Verificar imports
   - [ ] Verificar console do navegador
   - [ ] Verificar se `client` está sendo passado corretamente

## 📚 Documentação de Referência

- [ ] Ler `GOOGLE_ADS_INTEGRATION_GUIDE.md` para detalhes
- [ ] Consultar `INTEGRATION_SUMMARY.md` para visão geral
- [ ] Ver `INTEGRATION_EXAMPLES.jsx` para exemplos de uso

---

**Data de conclusão:** ___/___/___

**Testado por:** _________________

**Observações:**
_______________________________________________
_______________________________________________
_______________________________________________
