# Plan: Implement Withdrawal Section

Implement the "Retirada" (Withdrawal) functionality, allowing users to request Pix withdrawals from their available balance.

## User Interface

### Withdrawal Page (`src/routes/_authenticated.withdraw.tsx`)
- Display "Saldo disponível" prominently at the top.
- Create a two-step process or a single-page form inspired by digital wallets:
    - **Step 1: Withdrawal Value**: Input field for the amount (R$).
    - **Step 2: Pix Details**:
        - Radio group for "Tipo de Chave" (CPF, CNPJ, Telefone, E-mail, Chave Aleatória).
        - Input field for "Chave Pix" with appropriate masking.
        - Optional "Descrição" field.
- **Action**: "Solicitar retirada" button.
- **States**:
    - Loading state while the transaction is processing.
    - Success state with confirmation toast and balance update.
    - Error state handling API failures (insufficient balance, etc.).

### Navigation Update (`src/components/DashboardLayout.tsx`)
- Update the sidebar links under "Transferências":
    - Link "Saque" to `/withdraw`.
    - Link "Depositar" to `/deposit` (placeholder).
    - Link "Transferência Interna" to `/internal-transfer` (placeholder).

## Technical Details

### Backend Integration
- Use the existing `processTransaction` server function in `src/lib/financial.functions.ts`.
- Call it with `type: 'cash_out'` for withdrawals.
- Ensure the `walletId` is fetched (mocked or from current user session).
- Handle the `adjust_wallet_balance` RPC call already defined in the server function.

### Form Validation
- Use Zod for client-side validation (amount > 0, valid Pix keys).
- Mask Pix keys based on the selected type (CPF, CNPJ, Phone).

### State Management
- Use `useServerFn` from TanStack Start to call the backend.
- Use `useQueryClient` to invalidate stats/dashboard queries after a successful withdrawal.
