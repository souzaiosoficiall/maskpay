# Plano de Correção: Sincronização de Status e Dados do Perfil

O usuário relatou que, mesmo após a liberação da conta no painel administrativo, a interface do usuário ainda mostra o banner de "Verificação em Análise" e a página de configurações não exibe as informações preenchidas corretamente (aparecendo fallbacks como "PROPRIETÁRIO").

## Problemas Identificados
1.  **Cache do TanStack Query**: O status do perfil no frontend (`verification_status`) pode estar desatualizado devido ao cache do `useQuery`.
2.  **Lógica de Fallback no `getProfile`**: O `createServerFn` ainda possui lógica que pode estar priorizando metadados antigos ou fallbacks fixos para o e-mail do proprietário.
3.  **Mascaramento de Dados**: A função `getProfile` mascara e-mail, telefone e CPF para usuários não-admins, o que pode impedir a visualização correta na tela de configurações do próprio usuário.

## Ações

### 1. Refinar `src/lib/settings.functions.ts`
- Remover qualquer lógica que force o nome "PROPRIETÁRIO" ou "USUÁRIO".
- Garantir que o `full_name` retornado seja o que está no banco de dados.
- Permitir que o usuário veja seus próprios dados sem máscara na página de configurações (ou ajustar a lógica de máscara para ser aplicada apenas quando um admin visualiza outros usuários, se for o caso). *Nota: Normalmente o usuário deve ver seus próprios dados reais.*

### 2. Ajustar `src/routes/_authenticated.dashboard.tsx` e `src/routes/_authenticated.tsx`
- Adicionar invalidação de query após ações de KYC (embora já exista em alguns lugares, garantir que o dashboard reflita a mudança).
- Corrigir a condição de exibição do banner para que ele desapareça imediatamente quando o status mudar para `verified`.

### 3. Ajustar `src/routes/_authenticated.settings.tsx`
- Garantir que os campos exibam o valor real do perfil se disponível.

### 4. Verificação de Status no `AuthenticatedLayout`
- Garantir que a lógica de bloqueio por status `pending_review` não impeça a atualização visual quando a conta é liberada.

## Detalhes Técnicos
- **getProfile**: Ajustar o retorno para que o próprio usuário receba seus dados sem `maskPII`.
- **Invalidate Queries**: Garantir que `queryClient.invalidateQueries({ queryKey: ['profile'] })` seja chamado após o login e após atualizações de status.
