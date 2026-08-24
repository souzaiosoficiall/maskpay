# Redesign da Landing Page - ZyronPay

O objetivo é atualizar a Landing Page para um estilo mais moderno e tecnológico, incorporando elementos visuais de alta performance (como gráficos e bento grids) inspirados no design solicitado, mantendo o esquema de cores Preto e Laranja.

## Alterações Visuais

- **Hero Section**: Substituir o visual atual por uma composição mais "limpa" e focada em conversão, com um gráfico de performance/volume centralizado ou ao lado, simulando o dashboard da plataforma.
- **Gráficos e Dashboards**: Implementar componentes de visualização de dados (usando Lucide e estilização Tailwind) que representem o crescimento das vendas em tempo real na seção hero e em seções de funcionalidades.
- **Bento Grid**: Refinar a grade bento atual para ter bordas mais sutis, fundos com gradientes radiais pretos/laranjas e micro-interações.
- **Tipografia**: Manter a fonte bold de alta visibilidade, mas ajustar espaçamentos para um look mais premium.

## Detalhes Técnicos

- **Componentes**: Utilizar `framer-motion` (se disponível) ou animações Tailwind nativas para entrada de elementos.
- **Gráficos**: Criar um componente de gráfico "fake" mas visualmente impressionante usando `SVG` e `divs` animadas para representar os dados do dashboard.
- **Cores**: 
    - Fundo: `#000000` (Pure Black)
    - Destaque: `#FF6B00` (Zyron Orange)
    - Card: `oklch(0.12 0 0)` (Dark Gray)

## Etapas de Implementação

1. **Refatoração da Hero**: Criar a nova estrutura com o gráfico central de performance.
2. **Componente de Gráfico**: Desenvolver o elemento visual `DashboardPreview` com estatísticas e gráficos de linha/barras.
3. **Seções de Funcionalidades**: Atualizar os cards para o novo padrão visual.
4. **Polimento**: Ajustar sombras, borrões de fundo (backdrops) e gradientes.
