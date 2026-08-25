# ZyronPay/MaskPay Internal Transfer & Extrato Implementation Plan

This plan implements internal user-to-user transfers by email and a high-fidelity account statement (Extrato) integrated with the backend.

## User Experience
- **Internal Transfer**: A multi-step flow where users find recipients by email, verify their identity, and send funds instantly.
- **Extrato**: A detailed ledger showing all activity (PIX, internal transfers, deposits) with real-time status and filtering.

## Technical Details

### 1. Backend / Database
- **Migrations**:
    - Ensure RLS policies allow users to see transactions where their `wallet_id` is the subject.
- **Server Functions**:
    - `findUserByEmail`: Resolves a recipient email to a wallet ID and display name.
    - `processInternalTransfer`: A secure server function that:
        1. Checks sender balance.
        2. Verifies recipient wallet exists.
        3. Creates a `transfer_out` transaction for the sender.
        4. Creates a `transfer_in` transaction for the recipient.
        5. Updates both balances atomically using `adjust_wallet_balance`.

### 2. Components & Routes
- **`src/routes/_authenticated.transfer.tsx`**:
    - New route for the transfer interface.
    - Step 1: Email input + validation.
    - Step 2: Recipient summary + amount input.
    - Step 3: Confirmation modal/view.
- **`src/routes/_authenticated.extract.tsx`**:
    - Refactor to fetch real data from Supabase.
    - Implement status filters (Sucesso, Pendente, Falha).
    - Implement period filters (date range).
- **`src/components/DashboardLayout.tsx`**:
    - Update "Transferência Interna" link to point to the new `/transfer` route.

### 3. Verification
- Test internal transfer with a secondary user account.
- Verify transaction visibility (sender/receiver both see the relevant entry).
- Validate balance protection (over-drafting).

## Safety & Security
- Strict RLS ensures users cannot query other users' wallets or transaction history directly.
- Email lookup only returns the public display name, not PII.
- All balance updates use database-level atomicity.
