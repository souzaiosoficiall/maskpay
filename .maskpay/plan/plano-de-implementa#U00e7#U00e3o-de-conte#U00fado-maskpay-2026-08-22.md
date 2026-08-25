# Plano de Implementação de Conteúdo MaskPay

Este plano descreve a criação das páginas de Blog, Documentação/API e seções Legais (Privacidade e Termos) para a MaskPay, seguindo a estética minimalista e profissional estabelecida.

## 1. Estrutura de Rotas e Páginas
- **Blog**: Listagem de artigos sobre fintech e e-commerce.
- **Docs/API**: Documentação técnica para desenvolvedores.
- **Legal**: Termos de Uso e Política de Privacidade.

## 2. Detalhes Técnicos
- Utilizar TanStack Router para as novas rotas.
- Manter o tema "Charcoal & Silver" (`oklch(0.18 0 0)` background).
- Componentes compartilhados (Header/Footer) serão movidos para um layout base ou replicados com consistência.
- Animações com `framer-motion` para entrada suave de conteúdo.

## 3. Ações
- Criar `src/routes/blog/index.tsx`.
- Criar `src/routes/docs/index.tsx`.
- Criar `src/routes/legal/privacy.tsx` e `src/routes/legal/terms.tsx`.
- Atualizar links no `Footer` e `Header` da `src/routes/index.tsx` para apontar para as novas rotas.

## 4. Estilo de Conteúdo
- **Blog**: Cards com imagens sfx e tipografia bold.
- **Docs**: Layout lateral (sidebar) com conteúdo centralizado, exemplos de código em blocos escuros.
- **Legal**: Texto limpo, espaçado, focado em legibilidade.
