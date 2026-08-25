# Redesenho Humanizado & Direto (Inspirado em MisticPay)

O objetivo é remover a estética excessivamente "AI/High-Tech" (brilhos intensos, grids complexos, animações constantes) em favor de uma interface limpa, humana e direta ao ponto, mantendo a paleta Black & Orange.

## Mudanças Visuais
- **Layout Limpo**: Substituir a bento grid e os Dashboards Preview animados por seções de conteúdo linear e minimalista.
- **Tipografia Humanizada**: Ajustar os pesos das fontes para serem menos "agressivos" (menos `font-black`, mais `font-bold` ou `semibold`).
- **Minimalismo Orange**: Usar o laranja apenas em pontos de ação claros (CTAs, ícones importantes), eliminando os gradientes de fundo excessivos.
- **Header Simples**: Trocar o header flutuante "pill" por um header fixo padrão ou mais integrado ao topo, com menos desfoque e transparência.
- **Foco no Produto**: Mostrar benefícios em texto direto, sem metáforas visuais complexas.

## Detalhes Técnicos
- **Global Styles**: Simplificar as variáveis de borda e sombra em `src/styles.css` para um visual mais plano (flat).
- **Landing Page (`src/routes/index.tsx`)**:
  - Hero: Título direto, subtítulo curto, um botão de destaque.
  - Seções: Lista de benefícios com ícones simples, sem cards 3D ou animações de entrada exageradas.
  - Remover `DashboardPreview` e simulações de gráficos complexos.
- **Componentes**: Reduzir o uso de `framer-motion` para animações apenas essenciais (ex: transições de página ou hover simples).
