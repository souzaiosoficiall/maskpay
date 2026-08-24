# Plano: Correção do Acesso Administrativo e Erros de Autenticação (JWT Inválido)

O sistema administrativo está apresentando erros de "Unauthorized: Invalid token" porque as funções do servidor (`serverFn`) esperam um JWT válido do Supabase, mas o fluxo de login atual para o proprietário tenta usar tokens manuais ou falha em estabelecer uma sessão real quando há problemas no banco de dados.

## Alterações Propostas

### 1. Servidor: Normalização do Login do Proprietário
- Ajustar `src/lib/admin-auth.functions.ts` para que a função `adminLoginBypass` seja mais resiliente.
- Se o login com a senha falhar (mesmo para o dono), ela deve tentar encontrar o usuário pelo e-mail usando o `supabaseAdmin.auth.admin.listUsers()`.
- Se encontrado, forçar a atualização da senha no Auth para o valor esperado e re-tentar o login para obter um **session object real** (com JWT válido).
- Isso garante que o navegador receba um token que o middleware `requireSupabaseAuth` aceite.

### 2. Cliente: Fluxo de Login Robusto
- Em `src/routes/admin.login.tsx`, garantir que após receber o objeto de sessão (seja do login direto ou do bypass), o método `supabase.auth.setSession` seja chamado corretamente.
- Adicionar logs detalhados para capturar falhas em tempo real.

### 3. Middleware: Suporte a Sessões Administrativas
- Revisar `src/lib/admin-auth.middleware.ts` para garantir que ele não tente validar o token manual contra o Supabase se for um token de bypass, mas idealmente, o objetivo é **eliminar** a necessidade de tokens manuais e usar apenas JWTs reais.
- O middleware deve confiar no `requireSupabaseAuth` mas injetar as claims de admin se o e-mail for o do proprietário, independentemente do que diz a tabela `user_roles` (fallback de segurança).

### 4. Layout Admin: Estabilização do Carregamento
- Em `src/components/AdminLayout.tsx`, simplificar a verificação de role.
- Se houver sessão, carregar o layout. Se o e-mail for o do proprietário, assumir permissão total imediatamente no frontend para evitar "Acesso Negado" visual enquanto o backend processa as permissões.

## Detalhes Técnicos
- O erro "Invalid token" ocorre no arquivo `src/integrations/supabase/auth-middleware.ts` na linha 71 (`token.split('.').length !== 3`).
- Ao garantir que `adminLoginBypass` retorne uma sessão real gerada pelo Supabase Auth (mesmo que via reset de senha administrativo), o token sempre terá 3 partes e passará na validação.

## Verificação
- Testar o login com o e-mail do proprietário.
- Verificar se as requisições para `getAllUsers` e `getTickets` retornam dados sem erro 401.
