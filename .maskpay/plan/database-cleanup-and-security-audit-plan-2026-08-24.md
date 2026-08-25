# Database Cleanup and Security Audit Plan

The user wants a complete database cleanup (keeping only the admin), a full review of the site for bugs/missing features compared to the original zip, and testing of Pix integration, fees, and provider tokens.

## Proposed Changes

### Database Cleanup
- Create a server function to perform a "System Reset".
- This function will:
  - Identify the admin user by `OWNER_EMAIL`.
  - Delete all other users from `auth.users` (cascading to `profiles`, `wallets`, `transactions`, etc.).
  - Clear `transactions`, `notifications`, `verification_requests`, `admin_logs`, and `user_integrations` for all users except the admin.
  - Reset admin wallet to zero or a base state.
  - Keep `platform_configs` as they define the global fees.

### Pix Integration & Fees Review
- Audit `src/lib/payments.functions.ts` to ensure it correctly calculates and applies fees using `fetchPlatformFees`.
- Verify `src/routes/api/public/payment-webhook.ts` correctly processes incoming payments, updates transaction status, and adjusts wallet balances.
- Ensure the `EVOPAY_API_TOKEN` and `EVOPAY_MERCHANT_ID` env vars are used correctly.
- Test fee calculations in the UI (`deposit.tsx`, `withdraw.tsx`) against the values in `platform_configs`.

### Codebase Audit (Bugs & Missing Features)
- Verify all images reference physical files in `public/assets/`.
- Ensure session persistence (24h expiry) is correctly implemented in `_authenticated.tsx`.
- Check PWA/Push notifications setup (`NotificationDiagnostics.tsx`).
- Review admin views for KYC and User management to ensure they reflect the cleaned state.

## Technical Details
- **Cleanup Script**: Use `supabaseAdmin` in a dedicated server function `resetSystem`.
- **Fee Logic**: `fees-logic.ts` is already centralizing the math; I will verify it's used in both frontend and backend.
- **Pix Provider**: Audit `evopay-client.server.ts` to ensure robust error handling and correct token usage.
- **Verification**: Use Playwright to simulate a deposit/withdrawal flow (mocked if real tokens are absent, but verifying logic).

## User Review Required
> [!IMPORTANT]
> The database cleanup will **permanently delete all users** except `souzaiosoficial@gmail.com`. Are you ready to proceed with this reset?
