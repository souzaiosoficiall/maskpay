# Plano de Unificação e Correção do Sistema de Taxas

Este plano visa garantir que todas as taxas da plataforma (Entrada/PIX e Saída/Saque) sejam gerenciadas centralizadamente pelo Administrador, salvas no banco de dados e aplicadas de forma real em todo o sistema (cálculos, calculadora da homepage e área do usuário), eliminando valores "hardcoded".

## Ações Realizadas

### 1. Banco de Dados (Verificação e Garantia)
- Confirmar a existência da tabela `platform_configs` com as chaves:
  - `pix_deposit_fees` (JSON: `{ percentage: number, fixed: number }`)
  - `pix_withdrawal_fees` (JSON: `{ fixed: number }`)
- Criar a função SQL `get_platform_config(key_name text)` para facilitar a recuperação segura no backend.

### 2. Backend (Lógica de Servidor)
- Atualizar `src/lib/platform-fees.server.ts` para garantir que as taxas recuperadas do banco sejam a fonte única de verdade.
- Refatorar `src/lib/payments.functions.ts` para que `generatePixDeposit` e `requestPixWithdrawal` usem estritamente os valores do banco para calcular `fee_amount` e `net_amount`.

### 3. Frontend (Interface do Administrador)
- Revisar `src/components/admin/PlatformSettings.tsx` para garantir que o formulário "Taxas" esteja persistindo corretamente os dados no banco via `updatePlatformFees`.
- Adicionar validação para garantir que os valores salvos sejam números válidos.

### 4. Frontend (Interface do Usuário)
- Atualizar `src/routes/_authenticated.rates.tsx` (Página de Taxas do Usuário) para buscar os valores reais do banco em vez de usar uma lista estática.
- Atualizar a calculadora na homepage (`src/routes/index.tsx`) para carregar as taxas dinamicamente do banco de dados ao ser montada, garantindo sincronia total com as alterações do admin.

### 5. Consistência Visual
- Remover todos os valores decimais e textos de taxas fixas (ex: "0,99%", "R$ 0,80") que estejam escritos diretamente nos arquivos `.tsx`.

## Detalhes Técnicos
- **TanStack Query**: Utilização de `staleTime: 0` ou invalidação de queries ao salvar no admin para refletir as mudanças instantaneamente.
- **Supabase**: Uso de `upsert` na tabela `platform_configs` para manter as configurações persistentes.
- **Server Functions**: Centralização do cálculo de taxas no servidor para evitar manipulações no cliente.

---
Vou prosseguir com a implementação destas etapas agora.
