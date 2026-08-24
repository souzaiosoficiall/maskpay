# Plan to fix User Name and Account Verification Logic

I will fix two critical bugs: the hardcoded "PROPRIETÁRIO" name override and the account verification locking logic that inconsistently unlocks on page reload.

## Proposed Changes

### 1. Fix User Name Recovery (Bug 1)
- **src/lib/settings.functions.ts**: Remove hardcoded fallbacks to "Proprietário Geral" or "PROPRIETÁRIO". Ensure it strictly uses `full_name` from the database or Auth metadata.
- **src/lib/admin-auth.functions.ts**: Remove hardcoded `full_name: 'Proprietário Geral'` in the `adminLoginBypass` user creation logic.
- **src/components/AdminLayout.tsx**: Remove hardcoded `full_name: 'Proprietário'` fallback.
- **src/routes/_authenticated.dashboard.tsx**: Ensure the greeting uses the full name from the fetched profile without generic fallbacks.

### 2. Fix Account Verification Locking (Bug 2)
- **Source of Truth**: Enforce that the account status is strictly derived from the profile fetched from the server.
- **src/components/DashboardLayout.tsx**:
    - Update `isKycLocked` to be `true` by default until the profile is fully loaded and confirmed.
    - Ensure `isProfileLoading` prevents any transient "unlocked" state.
- **src/routes/_authenticated.tsx**: 
    - Implement a robust route gate that checks `verification_status` and redirects to `/dashboard` if a user tries to access a protected route while unverified.
    - This ensures that even if a user types the URL directly, they are sent back.
- **src/routes/_authenticated.dashboard.tsx**:
    - Ensure the "Verificação Necessária" banner and locked stats are strictly tied to the latest profile data.

### 3. Verification & Testing
- I will verify that the owner's real name (e.g., "THIARLES FERREIRA SOUZA") shows up correctly.
- I will verify that a new account starts as "PENDING" and cannot access transfers/settings even after a page refresh.
- I will verify that an "APPROVED" account has full access.

## Technical Details
- Using `isKycLocked = !profile || profile.verification_status !== 'verified'` (defaulting to locked).
- Removing conditional checks that override `full_name` based on `isOwner`.
- Ensuring `supabaseAdmin` syncs metadata to `profiles` only when actually present.
