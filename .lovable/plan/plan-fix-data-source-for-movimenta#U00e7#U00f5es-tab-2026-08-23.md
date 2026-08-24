# Plan - Fix Data Source for "Movimentações" Tab

Correct the data source for the "Movimentações" tab to use real database records instead of hardcoded demo data.

## User Review Required

> [!IMPORTANT]
> The current "Movimentações" menu item points to a `/webhooks` route which contains static mock data. I will redirect this to the existing real `/extract` (Extrato) functionality or implement the real query logic within the Movements view to ensure consistency across the platform.

## Proposed Changes

### Dashboard Navigation
- Update `src/components/DashboardLayout.tsx` to link the "Movimentações" menu item to the real transactions route.

### Backend Data Fetching
- Ensure `src/routes/_authenticated.webhooks.tsx` (the current Movements view) uses `getTransactionStats` and `getTransactions` server functions instead of the `stats` constant.
- Verify that these queries strictly filter by the authenticated user's `wallet_id`.

### UI Feedback
- Implement the "Nenhuma movimentação encontrada" empty state for users with no history.
- Remove all hardcoded amounts (e.g., R$ 52.200,00) and replace them with real balance/volume data from the database.

## Technical Details

- **Affected Files:**
  - `src/components/DashboardLayout.tsx`: Menu link update.
  - `src/routes/_authenticated.webhooks.tsx`: Replace static `stats` array with `useQuery` hooks calling `getTransactionStats`.
  - `src/lib/transactions.functions.ts`: Verification of user-specific filtering.
- **Empty State:** Will use the standard "Nenhuma movimentação encontrada" message as requested.
- **Verification:** I will verify the changes using a test account with zero transactions to confirm the empty state is displayed correctly.
