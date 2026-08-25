# Plano de Implementação: Sistema de Notificações Real-time

Implementar um sistema completo de comunicações entre administradores e usuários, com persistência em banco de dados, entrega em tempo real via Supabase Realtime e controle de dispensa individual.

## 1. Banco de Dados (Supabase)

### Tabelas e Estrutura
- **public.notifications**
  - `id` (uuid, PK)
  - `title` (text)
  - `description` (text)
  - `created_at` (timestamptz)
  - `created_by` (uuid, FK auth.users)
  - `target_type` (text: 'all', 'user', 'group') - padrão 'all'
  - `is_active` (boolean)
- **public.notification_dismissals**
  - `id` (uuid, PK)
  - `notification_id` (uuid, FK notifications)
  - `user_id` (uuid, FK auth.users)
  - `dismissed_at` (timestamptz)

### Segurança (RLS)
- `notifications`: 
  - SELECT: Autenticados (filtrando ativas)
  - INSERT/UPDATE/DELETE: Apenas Admins (usando `has_role` function existente)
- `notification_dismissals`:
  - SELECT/INSERT: O próprio usuário (`auth.uid() = user_id`)
  - DELETE: O próprio usuário

## 2. Backend (Server Functions)

- `src/lib/notifications.functions.ts`:
  - `createNotification`: Para o admin criar e disparar.
  - `dismissNotification`: Para o usuário marcar como "Não aparecer mais".
  - `getActiveNotifications`: Para buscar notificações não dispensadas ao carregar o dashboard.

## 3. Frontend - Área Administrativa

- `src/routes/admin.notifications.tsx`: Nova rota.
  - Lista de notificações enviadas.
  - Botão "+ Nova Notificação".
  - Formulário com Assunto e Descrição.
  - Ação de exclusão/desativação.

## 4. Frontend - Dashboard do Usuário

- `src/components/NotificationManager.tsx`: Novo componente global.
  - Injetado no `DashboardLayout`.
  - Escuta o canal do Supabase Realtime para a tabela `notifications`.
  - Busca notificações ativas no mount.
  - Filtra notificações já dispensadas localmente e via banco.
  - Exibe o Modal Central quando uma nova notificação chega ou existe uma pendente.

- `src/components/NotificationModal.tsx`:
  - Design profissional e responsivo.
  - Checkbox "Não aparecer mais".
  - Botões "Fechar".

## Detalhes Técnicos

- **Tempo Real**: Utilizar `supabase.channel('public:notifications').on(...)`.
- **Prevenção de Duplicidade**: Controle de estado no `NotificationManager` para não abrir o mesmo modal se já estiver visível ou processado.
- **Responsividade**: Tailwind classes para garantir centralização e ajuste em mobile (iPhone/Android).
- **Persistência**: O estado de "Não aparecer mais" será gravado na tabela `notification_dismissals`.

---
*Este plano segue os requisitos de segurança, tempo real e persistência solicitados.*
