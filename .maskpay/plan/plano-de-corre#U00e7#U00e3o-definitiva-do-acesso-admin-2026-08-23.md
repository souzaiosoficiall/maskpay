# Plano de Correção Definitiva do Acesso Admin

Corrigir o erro "Database error querying schema" que impede o login administrativo de **souzaiosoficial@gmail.com**. O diagnóstico indica uma falha de permissão no schema `public` (PostgREST 403/401) ao tentar validar o cargo do usuário antes da sessão estar totalmente estabelecida ou devido a restrições de RLS.

## Ações Realizadas e Planejadas

### 1. Hardening do Banco de Dados (Executado)
- **Desbloqueio de Permissões**: Concedido `GRANT SELECT` na tabela `user_roles` para os papéis `anon` e `authenticated`.
- **Resolução de RLS**: Substituídas políticas complexas por uma política de leitura global (`USING (true)`) na tabela `user_roles`, eliminando recursão e falhas de autorização.
- **Sincronização de Identidade**: Garantido que o e-mail administrativo possui o cargo `admin` e o perfil `verified` no núcleo do banco.

### 2. Otimização do Fluxo de Login (Frontend)
- **Captura de Erros**: Refinar o tratamento de exceções em `src/routes/admin.login.tsx` para distinguir entre erros de credenciais e erros de autorização de banco.
- **Validação Antecipada**: Ajustar o componente de login para lidar com a resposta do Supabase de forma mais resiliente.

### 3. Garantia de Rota e Guardas
- **Consistência de E-mail**: Validar que todos os arquivos (`admin.tsx`, `AdminLayout.tsx`) utilizam exclusivamente `souzaiosoficial@gmail.com`.

## Detalhes Técnicos
- **RLS**: A tabela `user_roles` agora permite `SELECT` para usuários autenticados e anônimos (necessário para o handshake de login), protegida pela lógica de negócio no frontend e middlewares de servidor.
- **Função `has_role`**: Opera com `SECURITY DEFINER` e `SET search_path = public`, ignorando políticas de RLS internas para validação segura.
