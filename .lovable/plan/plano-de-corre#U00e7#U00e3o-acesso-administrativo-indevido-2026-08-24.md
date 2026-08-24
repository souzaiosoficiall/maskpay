# Plano de Correção: Acesso Administrativo Indevido

O objetivo é garantir que apenas usuários com a função de `admin` (ou o proprietário) possam acessar o painel administrativo. Atualmente, usuários comuns conseguem entrar se a sessão estiver ativa, pois a validação no `AdminLayout` é lenta e as server functions não bloqueiam o carregamento inicial do layout.

## Mudanças Propostas

### Backend (Segurança Real)

1.  **Refatorar `admin-auth.functions.ts`**:
    *   Melhorar `checkAdminRole` para ser mais rigoroso.
    *   Garantir que o bypass de proprietário seja usado apenas como último recurso.

2.  **Middleware de Admin**:
    *   Criar um middleware reutilizável `requireAdmin` em `src/integrations/supabase/auth-middleware.ts` (ou similar) que verifique a role `admin` no banco de dados usando o token JWT do usuário.
    *   Aplicar este middleware em todas as server functions administrativas em `src/lib/admin-system.functions.ts`.

### Frontend (User Experience & Gatekeeping)

1.  **Atualizar `src/routes/admin.tsx`**:
    *   Utilizar o `beforeLoad` do TanStack Router para fazer uma verificação prévia da sessão. Se não houver sessão, redirecionar imediatamente para `/admin/login`.

2.  **Refatorar `src/components/AdminLayout.tsx`**:
    *   Tornar a verificação de `isAdminForce` bloqueante e irreversível.
    *   Se `isAdminForce` for `false`, garantir que o `Outlet` nunca seja renderizado.
    *   Adicionar um log claro quando um usuário não-admin tenta acessar.

3.  **Ajustar `src/routes/admin.login.tsx`**:
    *   Garantir que após o login bem-sucedido, a verificação de role seja disparada imediatamente.

## Detalhes Técnicos

*   **Tabela `user_roles`**: A verificação deve consultar `public.has_role(auth.uid(), 'admin')` através de uma RPC segura (Security Definer) para evitar recursividade de RLS.
*   **TanStack Router Context**: Usar o `context` da rota para passar o estado de `isAdmin` para as rotas filhas.
