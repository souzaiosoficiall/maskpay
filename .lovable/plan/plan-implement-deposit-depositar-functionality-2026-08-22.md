# Plan: Implement Deposit (Depositar) Functionality

Implement a functional "Deposit" interface using the existing project patterns and backend integration.

## Proposed Changes

### 1. New Route: `/_authenticated.deposit`
- **File**: `src/routes/_authenticated.deposit.tsx`
- **Features**:
  - Form to enter the deposit amount (Valor).
  - "Generate Payment" (Gerar pagamento) button with loading state.
  - Integration with `processTransaction` server function (`type: 'cash_in'`).
  - Dynamic display of QR Code using `qrcode.react`.
  - Display of the Pix "Copia e Cola" code.
  - "Copy Code" button with visual feedback (toast).
- **Design**: Matches the dark theme, black-gray background, and rounded pill aesthetics of the current dashboard.

### 2. Sidebar Navigation
- **File**: `src/components/DashboardLayout.tsx`
- **Changes**: Update the "Depositar" link in the "Transferências" dropdown to point to `/deposit` instead of `/extract`.

## Technical Details
- Use `useServerFn` to call `processTransaction`.
- Use `qrcode.react` for client-side QR generation from the Pix string.
- Maintain existing wallet ID placeholder logic for consistency with other parts of the prototype.
- Ensure all translations are in Portuguese.
