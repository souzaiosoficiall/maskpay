# Plano de Auditoria de Responsividade e Organização Visual - MaskPay

Auditoria completa e correção de responsividade em TODA a plataforma, com foco em iPhones (SE ao Pro Max), garantindo que nenhum conteúdo seja cortado ou sobreposto.

## 1. Ajustes Globais e Layouts Base
- **Safe Area (iOS):** Implementar suporte a `env(safe-area-inset-*)` no `src/routes/__root.tsx` e layouts base para evitar que o conteúdo fique sob o notch ou a Dynamic Island.
- **Menu Lateral (Dashboard & Admin):** Refatorar o `DashboardLayout.tsx` e `AdminLayout.tsx` para usar um `Drawer` (mobile) e `Sidebar` fixa (desktop), garantindo que o menu não ocupe espaço excessivo no celular.
- **Header:** Ajustar o cabeçalho para dispositivos móveis, garantindo que o avatar e informações do usuário não quebrem o layout.

## 2. Fluxos de Autenticação e Cadastro
- **Login/Cadastro (`src/routes/auth.tsx`):** Revisar os formulários de 4 etapas para que os inputs e botões ocupem 100% da largura disponível no mobile, com espaçamento adequado e sem overflow horizontal.
- **Modais e Cards:** Ajustar o `Card` de autenticação para ter margens menores no mobile, aproveitando melhor o espaço da tela.

## 3. Dashboard e Área do Cliente
- **Estatísticas e Gráficos:** Refatorar o grid de stats e o gráfico de receita no `src/routes/_authenticated.dashboard.tsx` para empilhar em telas pequenas.
- **Verificação KYC (`src/routes/_authenticated.verify.tsx`):** Ajustar o wizard de upload de documentos. Garantir que o preview das imagens e os botões de upload não ultrapassem a largura da tela e sejam fáceis de tocar.
- **Tabelas de Extrato/Movimentações:** Implementar rolagem horizontal suave ou visualização em cards para tabelas em telas pequenas.

## 4. Sistema Administrativo
- **Tabelas Administrativas:** Revisar `UserManagement.tsx` e `AdminLogsTable.tsx`. Implementar rolagem horizontal ou ocultação de colunas secundárias no mobile.
- **Moderação KYC (`KycModerationView.tsx`):** Ajustar a visualização lateral de documentos para que, no mobile, a lista de usuários e os documentos fiquem empilhados verticalmente.
- **Central de Suporte (`SupportCenter.tsx`):** Ajustar o chat de tickets para que a área de mensagens e o input de resposta se comportem como um app nativo de mensagens no iPhone.

## 5. Landing Page (`src/routes/index.tsx`)
- **Hero & Carrossel:** Ajustar o tamanho da fonte do H1 e a animação do carrossel de logos para evitar overflow.
- **Seção de Features:** Garantir que os cards de features tenham altura flexível e margens corretas no iPhone.

## Detalhes Técnicos
- Uso de classes `safe-p-*` e `safe-m-*` do Tailwind (ou equivalentes nativos).
- Breakpoints consistentes: `sm` (640px), `md` (768px), `lg` (1024px).
- Testes visuais simulando iPhone SE (375px) até Pro Max (430px+).
- Garantia de que nenhuma alteração de CSS global quebre o layout Desktop atual.
