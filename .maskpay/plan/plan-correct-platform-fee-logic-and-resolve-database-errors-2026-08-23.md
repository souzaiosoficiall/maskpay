# Plan - Correct Platform Fee Logic and Resolve Database Errors

The user reports that the Pix deposit fee calculation is incorrect (showing R$ 0.10 for R$ 10.00 instead of R$ 0.65) and that there is a database error related to the `metadata` column in the `transactions` table. This plan fixes both by centralizing fee logic and updating the database schema.

## Proposed Changes

### Database Updates
- Add the missing `metadata` column to the `public.transactions` table.
- Ensure the `fee_amount` and `net_amount` columns are correctly configured for numeric precision.

### Backend (Server Logic)
- **Centralize Fee Calculation**: Create or update a shared utility in `src/lib/fees.server.ts` that implements the logic: `taxa_total = (valor * percentual) + fixo`.
- **Refactor `generatePixDeposit`**: Update `src/lib/payments.functions.ts` to use the centralized fee logic and fetch rates from `platform_configs`.
- **Refactor `requestPixWithdrawal`**: Ensure withdrawal fees also use the database configuration.

### Frontend Updates
- **Homepage Calculator**: Update `src/routes/index.tsx` to use the correct Pix deposit fee formula: `numValue - ((numValue * fees.deposit.percentage) / 100 + fees.deposit.fixed) - fees.withdrawal.fixed`.
- **User Rates Page**: Verify `src/routes/_authenticated.rates.tsx` displays the correct database-driven rates.
- **Verification Dashboard**: Fix any display issues in `src/routes/_authenticated.verify.tsx`.

## Technical Details
- The Pix deposit fee formula is `(value * 2.49%) + R$ 0.40`.
- For R$ 10.00: `10 * 0.0249 = 0.249`, `0.249 + 0.40 = 0.649`, rounded to `0.65`.
- Database precision: Use `numeric(10,2)` for monetary values to avoid floating-point errors.
- Real-time updates: Ensure `platform_configs` changes in the Admin panel propagate instantly via TanStack Query invalidation.

## Verification Plan
- **Database**: Run `maskpay supabase query` to check column existence.
- **Calculator Test**: 
  - R$ 10.00 -> Fee: R$ 0.65, Net: R$ 9.35
  - R$ 100.00 -> Fee: R$ 2.89, Net: R$ 97.11
- **Payment Generation**: Verify `generatePixDeposit` inserts the correct `fee_amount` and `net_amount` into the database.
- **Visuals**: Check that no hardcoded "0.99%" or similar remains in the UI.
