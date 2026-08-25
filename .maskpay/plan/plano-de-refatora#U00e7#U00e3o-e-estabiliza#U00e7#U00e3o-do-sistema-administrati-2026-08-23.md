# Plano de Refatoração e Estabilização do Sistema Administrativo

O objetivo é reconstruir o fluxo de autorização administrativa e garantir que o acesso do proprietário (`souzaiosoficial@gmail.com`) seja infalível, eliminando o erro "Database error querying schema" que persiste devido a falhas de cache do PostgREST ou problemas de permissão de enum.

## 1. Backend: Simplificação Radical de Segurança

- Redefinir a função `has_role` no banco de dados para usar apenas tipos primitivos (`text`, `uuid`), evitando a dependência do tipo `app_role` que causa erros de "schema" quando o PostgREST falha ao resolver o enum.
- Implementar bypass de segurança a nível de banco de dados: a função `has_role` retornará `true` automaticamente para o ID do proprietário.
- Garantir permissões globais no esquema `public` para os papéis `anon` e `authenticated` para garantir que a introspecção do esquema pelo cliente não falhe.

## 2. Frontend: Refatoração de Login e Guardas

- **Login (`src/routes/admin.login.tsx`)**:
  - Implementar uma validação resiliente que prioriza o e-mail do proprietário antes de qualquer chamada RPC.
  - Se o e-mail for o do proprietário, o login será processado com sucesso sem validar o cargo via banco de dados no momento da autenticação inicial (bypass total).
- **Layout/Guard (`src/routes/admin.tsx`)**:
  - O `beforeLoad` verificará o e-mail da sessão. Se for o proprietário, a renderização será liberada sem chamadas extras ao banco de dados que possam falhar.
- **AdminLayout (`src/components/AdminLayout.tsx`)**:
  - Sincronizar a lógica de "Acesso Negado" para nunca bloquear o proprietário, mesmo que o perfil demore a carregar ou o cargo esteja ausente no cache local.

## 3. Funções de Servidor (RPC)

- **`src/lib/admin-system.functions.ts`**:
  - Adicionar um middleware `ensureOwnerOrAdmin` que usa validação de e-mail direta nos claims do Supabase (`context.claims.email`), garantindo segurança robusta no lado do servidor que não depende exclusivamente de RLS ou funções SQL instáveis.

## Detalhes Técnicos

- **SQL**:
  ```sql
  CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
  RETURNS boolean SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email = 'souzaiosoficial@gmail.com') THEN
      RETURN TRUE;
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role);
  END;
  $$ LANGUAGE plpgsql;
  ```
- **Filtro de Seguranca**: O e-mail `souzaiosoficial@gmail.com` será tratado como uma constante de sistema (SuperAdmin) em todas as camadas.
