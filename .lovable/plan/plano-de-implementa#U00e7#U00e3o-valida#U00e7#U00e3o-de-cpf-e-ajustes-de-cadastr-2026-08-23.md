# Plano de Implementação: Validação de CPF e Ajustes de Cadastro

O objetivo deste plano é implementar a validação matemática e via API externa de CPF no fluxo de cadastro, desativar temporariamente a confirmação obrigatória de e-mail e garantir que o nome real do usuário seja utilizado em toda a plataforma.

## 1. Desativar Verificação por E-mail
*   **Ação:** Configurar o Supabase para não exigir confirmação de e-mail para login imediato.
*   **Técnico:** Como não tenho acesso direto ao dashboard do Supabase, utilizarei o `supabaseAdmin.auth.admin.updateUserById` ou garantirei que no `signUp` as opções permitam o login. No entanto, a forma definitiva é via `auth.signUp` com `email_confirm: true` se estiver usando o admin client, ou ajustando o fluxo de login para aceitar usuários não confirmados.
*   **Correção no código:** No `src/routes/auth.tsx`, garantirei que o login funcione mesmo que o e-mail não tenha sido confirmado (embora a mensagem de erro atual já trate isso, o redirecionamento pós-cadastro deve ser direto).

## 2. Validação Real de CPF no Backend
*   **Ação:** Criar um Server Function para validar o CPF matemática e externamente.
*   **Provedor Sugerido:** Recomendo a utilização de um serviço como **Hublao**, **Dados de Graça (API do Governo)** ou um agregador como **BigDataCorp** ou **Serpro**. Para este projeto, prepararei a integração com uma API genérica e solicitarei a `CPF_VALIDATION_API_KEY` como Secret.
*   **Fluxo:**
    1.  O usuário digita o CPF no Step 1.
    2.  O frontend chama `validateCPF(document)`.
    3.  O backend valida o algoritmo (dígitos verificadores).
    4.  O backend consulta a API externa.
    5.  Se retornar o nome, o backend retorna o nome para o frontend.
    6.  O frontend preenche o campo "Nome Completo" no Step 2 e o bloqueia para edição (ou permite revisão).

## 3. Segurança e Duplicidade
*   **Ação:** Impedir cadastros duplicados com o mesmo CPF.
*   **Técnico:** No `src/routes/auth.tsx`, a verificação de duplicidade já existe, mas será reforçada no backend durante a criação final.

## 4. Remoção de Nomes Genéricos
*   **Ação:** Remover qualquer fallback para "PROPRIETÁRIO" ou "USUÁRIO".
*   **Locais:** `src/lib/settings.functions.ts`, `src/lib/admin-auth.functions.ts` e componentes de dashboard.

## Detalhes Técnicos
*   **Nova Server Function:** `src/lib/identity.functions.ts` contendo `validateCpfServer`.
*   **Middleware:** A validação será protegida para evitar scraping.
*   **Alterações no UI:** 
    *   `src/routes/auth.tsx`: Adicionar estado de carregamento durante a validação do CPF entre o Step 1 e 2.
    *   `src/routes/auth.tsx`: Desativar obrigatoriedade de confirmação de e-mail no fluxo de `signUp`.
*   **Secrets Necessários:** `CPF_VALIDATION_API_KEY` e `CPF_VALIDATION_ENDPOINT`.

---

**Você possui preferência por algum provedor de validação de CPF específico (ex: Serpro, BigDataCorp, InfoSimples)?**
Se não, deixarei preparado para um padrão de mercado.
