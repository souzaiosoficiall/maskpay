# Admin System Hardening & Optimization Plan

Resolve the "Acesso Negado" (Access Denied) loop, optimize performance, and fix security/logical bugs.

## Technical Details

### 1. Fix Access Denied Loop
*   **Issue:** The `admin.tsx` route guard forces a `signOut()` for any email not matching `souzaaiosoficial01@gmail.com`. This likely clears the session *during* the login process or immediately after, causing the "Access Denied" screen in `AdminLayout` because the session is lost.
*   **Fix:**
    *   Update `src/routes/admin.tsx` to handle unauthorized access more gracefully (redirect without forced `signOut` if the intent is to allow re-login).
    *   Refine `AdminLayout.tsx` to ensure it doesn't render the "Acesso Negado" state if the user was just redirected or if the session is still being established.
    *   Standardize the `ADMIN_EMAIL` check across all entry points.

### 2. Performance Optimization
*   **API Batching:** The `AdminPage` (admin dashboard) makes separate calls for users, tickets, and logs. While React Query handles this, some server functions could be combined or optimized to reduce round trips.
*   **Data Masking:** Ensure PII masking happens efficiently on the server side to reduce payload size.
*   **Component Splitting:** The `src/routes/admin.index.tsx` is very large (~800 lines). Break it down into sub-components for better maintainability and rendering performance.

### 3. Bug Fixes & Security
*   **Ticket Ownership:** Verify that `resolveTicket` and other support functions strictly respect the authorized admin email.
*   **KYC Handling:** Fix potential data mismatches between `profiles` and `verification_requests`.
*   **Error Handling:** Improve error reporting in the admin UI to provide actionable feedback instead of generic errors.

## Proposed Changes

### Routes & Components
*   **`src/routes/admin.tsx`:** Refine the `beforeLoad` guard.
*   **`src/components/AdminLayout.tsx`:** Update access check logic.
*   **`src/routes/admin.index.tsx`:** Refactor into smaller components (e.g., `UserManagement`, `SupportCenter`, `KycModeration`).

### Server Functions
*   **`src/lib/admin-system.functions.ts`:** Optimize data fetching and ensure strict email validation.
*   **`src/lib/support.functions.ts`:** Harden ownership checks.
