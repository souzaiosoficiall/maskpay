# Sincronização Definitiva de Dados do Usuário

Corrigir a falha de sincronização onde dados do cadastro (nome, CPF/CNPJ, telefone) não aparecem na tela de verificação e configurações, garantindo que o `user_metadata` do Supabase Auth seja a fonte da verdade para a criação e atualização do perfil.

## Alterações Técnicas

### 1. Refatoração da Criação de Perfil (Backend)
- **Arquivo:** `src/lib/settings.functions.ts`
- **Ação:** Atualizar o `handler` de `getProfile` para extrair rigorosamente os metadados do usuário (`full_name`, `document`, `phone`) do objeto `context.claims` (proveniente do Supabase Auth) ao criar um novo registro na tabela `profiles`.
- **Detalhe:** Garantir que o mapeamento de campos seja idêntico ao utilizado no `signUp`.

### 2. Ajuste no Fluxo de Cadastro (Frontend)
- **Arquivo:** `src/routes/auth.tsx`
- **Ação:** Garantir que a chamada `supabase.auth.signUp` salve os dados nos campos corretos dentro de `options.data`.
- **Ação:** Remover a dependência de redirecionamento imediato que pode causar race conditions antes do perfil ser criado no banco.

### 3. Validação na Tela de Verificação (Frontend)
- **Arquivo:** `src/routes/_authenticated.verify.tsx`
- **Ação:** Garantir que a exibição dos dados consuma diretamente o objeto `profile` retornado pelo servidor, sem transformações que ocultem valores existentes.

### 4. Auditoria de Dados (Banco de Dados)
- **Ação:** Executar um script SQL para sincronizar perfis órfãos ou incompletos com base nos metadados atuais do `auth.users`, se necessário.

## User-facing changes
- Os dados preenchidos no cadastro aparecerão automaticamente na tela de verificação.
- Fim das mensagens "Não informado" quando o dado já foi fornecido.
