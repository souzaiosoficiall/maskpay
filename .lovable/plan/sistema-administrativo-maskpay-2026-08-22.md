# Sistema Administrativo MaskPay

Implementação do painel administrativo completo para gerenciamento de usuários, KYC, saldos, rotas e suporte.

## 1. Banco de Dados & Backend
- **Tabela `profiles`**: Adicionar campos `status` (active/blocked), `account_route` (WHITE/BLACK) e `last_activity_at`.
- **Tabela `admin_logs`**: Criar tabela de auditoria para registrar ações dos administradores.
- **Server Functions**: Implementar `getAllUsers`, `updateUserStatus` (aceitar/bloquear), `updateBalance` (adicionar/bloquear), `updateAccountRoute`, `resetUserPassword` e `getAdminLogs`.
- **Segurança**: Todas as funções protegidas por middleware e validação RPC `has_role('admin')`.

## 2. Frontend - Painel Admin (`/admin`)
- **Seção Usuários**: 
  - Listagem com filtros por status (Pendentes, Aceitos, Bloqueados).
  - Visualização de Nome, E-mail, Telefone, CPF/CNPJ (protegido), Saldo, Rota, Status KYC e Datas.
  - Painel de detalhes com ações: Aprovar/Recusar KYC, Bloquear/Desbloquear Conta, Reset de Senha.
- **Gestão de Saldo**:
  - Interface para adicionar ou bloquear saldo com motivo obrigatório.
  - Exibição clara de Saldo Disponível vs. Bloqueado.
- **Configuração de Rota**: Toggle entre WHITE e BLACK no perfil do usuário.
- **Tickets Administrativos**:
  - Visualização centralizada de todos os tickets.
  - Sistema de resposta com anexo de imagens e marcação de status (Aberto/Resolvido).
  - Indicadores visuais de novas mensagens.

## 3. Experiência do Usuário (Bloqueio)
- **DashboardLayout**: Aplicação de cadeados visuais em todas as rotas se a conta estiver `blocked`.
- **Exceção**: Aba de Tickets permanece aberta mesmo para usuários bloqueados.

## Detalhes Técnicos
- **Localização**: `src/lib/admin-system.functions.ts` e `src/routes/_authenticated.admin.tsx`.
- **Real-time**: Uso de `invalidateQueries` do TanStack Query para atualizações imediatas após ações administrativas.
- **Segurança**: Validação rigorosa no backend em cada mutation administrativa.
