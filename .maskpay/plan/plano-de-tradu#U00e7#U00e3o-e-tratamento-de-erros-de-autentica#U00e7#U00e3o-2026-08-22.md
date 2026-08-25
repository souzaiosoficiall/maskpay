# Plano de Tradução e Tratamento de Erros de Autenticação

Este plano visa traduzir mensagens de erro de autenticação para o português e melhorar a clareza quando um e-mail não estiver cadastrado.

## Alterações

### 1. Autenticação (Frontend)
- **Arquivo:** `src/routes/auth.tsx`
- **Ação:** Atualizar o mapeamento de erros no `handleSubmit`.
- **Mudanças:**
    - `Invalid login credentials` -> `E-mail ou senha incorretos` (Já existe, mas vamos reforçar).
    - `Email not confirmed` -> `E-mail ainda não confirmado. Verifique sua caixa de entrada.`
    - `User not found` ou erro genérico de e-mail inexistente -> `Este e-mail não está cadastrado em nossa plataforma.`

### 2. Layout do Dashboard
- **Arquivo:** `src/components/DashboardLayout.tsx`
- **Ação:** Traduzir os status de verificação no cabeçalho (caso existam pendências).
- **Mudanças:**
    - `Verified` -> `Verificado`
    - `Reviewing` -> `Em análise`
    - `Unverified` -> `Não verificado`
    - (Nota: Algumas dessas já foram feitas, vou revisar o arquivo para garantir consistência).

### 3. Verificação Global
- **Ação:** Procurar por toasts e mensagens de erro remanescentes em inglês nas rotas de login e cadastro.

## Detalhes Técnicos
- Utilização de `toast.error()` com mensagens amigáveis em português.
- Melhoria na lógica de captura de erro do Supabase Auth para identificar falhas específicas de "usuário não encontrado".
