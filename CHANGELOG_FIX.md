# Correções MaskPay Admin — 2026-08-27

## Problema principal
As informações do painel admin demoravam ou às vezes não apareciam.

### Causa raiz
O hook `useSessionReady` lia a sessão do **app do usuário** (`maskpay-auth-session`),
enquanto o login do admin grava a sessão em um storage **isolado** (`maskpay-admin-auth-session`).

Resultado:
- `enabled: sessionReady` ficava `false` na maioria das vezes
- as queries de usuários/tickets nem disparavam (ou falhavam de forma intermitente)
- a tela ficava no loading ou vazia

## O que foi corrigido

1. **Novo hook `useAdminSessionReady`**
   - Lê exclusivamente a sessão admin (`adminSupabase`)
   - Arquivo: `src/hooks/useAdminSessionReady.ts`

2. **`src/routes/aylla.index.tsx`**
   - Passa a usar `useAdminSessionReady` (em vez de `useSessionReady`)
   - Queries com `retry: 2`, `refetchOnMount: 'always'`, `refetchOnWindowFocus: true`
   - Não engole mais erros com `.catch(() => [])` silenciosamente
   - Loading só bloqueia na carga inicial real (não quando já há dados em cache)
   - Banner de erro + botão "Tentar de novo" se as queries falharem
   - Spinner sutil quando estiver refetchando em background

3. **`src/components/AdminLayout.tsx`**
   - Usa `useAdminSessionReady`
   - Removido o delay artificial de 500ms no `checkRole` (acelerava a entrada no painel)

## O que NÃO foi alterado
- Taxas / platform fees
- Lógica de pagamento / adquirente
- Estrutura de banco / RLS
- Credenciais ou variáveis de ambiente

## Como aplicar
Substitua/adicione os arquivos no projeto e faça deploy na Vercel:

```
src/hooks/useAdminSessionReady.ts   ← NOVO
src/routes/aylla.index.tsx          ← substituir
src/components/AdminLayout.tsx      ← substituir
```

Depois do deploy:
1. Abra /aylla/login
2. Faça login admin
3. O painel deve carregar os dados de forma consistente e rápida

## Checkup geral (outros pontos observados)
- Auth attacher (`auth-attacher.ts`) já usa `adminSupabase` corretamente em rotas /aylla — ok
- Middleware `requireAdminRole` ok
- PlatformSettings / taxas: não alterado, conforme solicitado
- Duplicidade de fetch de users/tickets no Layout (para badges) + na página: aceitável; com a sessão certa deixa de ser o gargalo
