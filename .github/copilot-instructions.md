# Copilot Instructions for Gerenciador PMax

## Visão Geral da Arquitetura
- Projeto React moderno com Vite, TailwindCSS e PostCSS.
- Estrutura principal em `src/`, com componentes React em `src/components/` e contextos em `src/contexts/`.
- Plugins customizados do Vite em `plugins/`, incluindo funcionalidades para modo de seleção, edição visual e integração com editores inline.
- Scripts utilitários e de integração em `src/lib/` e `plugins/utils/`.

## Fluxos de Desenvolvimento
- **Build/Dev:** Use `npm run dev` para desenvolvimento local e `npm run build` para build de produção (veja `package.json`).
- **TailwindCSS:** Configuração em `tailwind.config.js` e `postcss.config.js`. Estilos globais em `src/index.css`.
- **Plugins Vite:** Plugins customizados em `plugins/` são carregados via configuração do Vite (`vite.config.js`).
- **Scripts utilitários:** Scripts como `tools/generate-llms.js` são usados para geração ou integração de modelos.

## Padrões e Convenções Específicas
- Componentes React usam extensão `.jsx` e são organizados por domínio funcional.
- Componentes de UI reutilizáveis ficam em `src/components/ui/`.
- Contextos de autenticação e integração externa (ex: Supabase) em `src/contexts/` e `src/lib/`.
- Plugins Vite seguem padrão de exportação de função e são organizados por funcionalidade.
- Evite lógica de negócio em arquivos de configuração ou scripts de build.

## Integrações e Pontos de Comunicação
- **Supabase:** Integração via `src/contexts/SupabaseAuthContext.jsx` e `src/lib/customSupabaseClient.js`.
- **Google Ads:** Componentes como `GoogleAdsSettingsDialog.jsx` e `GoogleAdsSync.jsx` lidam com integrações e sincronização.
- **PDF Export:** Implementado em `ExportPDF.jsx`.

## Exemplos de Padrões Importantes
- Para criar um novo componente de UI, siga o padrão de `src/components/ui/button.jsx`.
- Para adicionar um novo plugin Vite, use como referência `plugins/vite-plugin-iframe-route-restoration.js`.
- Para lógica de autenticação, utilize o contexto de `SupabaseAuthContext.jsx`.

## Outras Observações
- Não há README.md ou instruções de agentes anteriores; siga este guia como fonte principal.
- Mantenha as instruções concisas e específicas para este projeto.
