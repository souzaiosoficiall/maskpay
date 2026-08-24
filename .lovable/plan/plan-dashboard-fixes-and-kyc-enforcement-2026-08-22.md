# Plan - Dashboard Fixes and KYC Enforcement

The user reported two issues:
1. The dashboard looks "delayed" (likely due to simulated data or slow fetching).
2. Functionalities remain accessible when KYC is in "pending review", but should be blocked until approved by an admin.

## Proposed Changes

### 1. Dashboard Responsiveness
- Review `src/routes/_authenticated.dashboard.tsx` data fetching.
- Reduce `staleTime` if necessary or ensure loaders are pre-fetching.
- Remove/Adjust the simulated data delay if it's causing the "dry" look before hydration.
- Add better skeleton states to avoid layout shifts.

### 2. KYC Enforcement
- Update `src/components/DashboardLayout.tsx` to include `pending` and `pending_review` in the `isKycLocked` logic.
- Ensure all protected links in the sidebar are disabled when `verification_status` is not `verified`.
- Add a specific check in `src/routes/_authenticated.tsx` (the layout wrapper) to enforce redirection or a global block overlay if the user is not verified.

## Technical Details
- **KYC Logic**: The current `isKycLocked` in `DashboardLayout.tsx` allows access if status is `pending` or `pending_review`. This will be changed so ONLY `verified` status (or `admin` role) allows access to protected features.
- **Redirection**: If a user tries to access `/transfer`, `/withdraw`, etc., they should be redirected to `/dashboard` or `/verify` if not verified.
- **Dashboard Data**: Optimize `useQuery` configurations to show cached data immediately while refetching in the background.

## Verification Plan
1. Test with a user having `verification_status = 'pending_review'`: Ensure sidebar links (Transferências, Extrato, etc.) are disabled.
2. Test accessing protected routes directly via URL: Ensure they are blocked/redirected.
3. Verify dashboard loads smoothly without feeling "delayed".
