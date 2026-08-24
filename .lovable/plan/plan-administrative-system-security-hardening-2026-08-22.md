# Plan: Administrative System Security Hardening

Implement comprehensive security for the administrative area, covering backend authorization, route protection, dedicated login, and data sensitivity.

## User-Facing Changes
- **Dedicated Admin Login**: When accessing `/admin`, users without an admin session will be redirected to a specialized administrative login page.
- **Access Control**: Standard users will be blocked from accessing administrative routes and APIs.
- **Sensitive Data Protection**: PII like CPF/CNPJ, phone numbers, and documents will only be visible to verified administrators.

## Technical Details

### 1. Database & Authorization
- **Role Verification**: Use the existing `public.has_role` RPC to verify 'admin' status.
- **Admin Logs**: Ensure all administrative actions are logged in `admin_logs`.

### 2. Backend Security (Server Functions)
- Refactor `src/lib/admin-system.functions.ts` and `src/lib/admin.functions.ts` to use a consistent `ensureAdmin` middleware/helper.
- Protect all sensitive fields in profile queries: standard users should receive masked data, while admins get full access.

### 3. Routing & Authentication
- **Admin Layout Guard**: Update `src/components/AdminLayout.tsx` to perform a hard server-side check (via loader or server function) in addition to the client-side check.
- **Admin Login Route**: Create `src/routes/admin.login.tsx` for administrative authentication.
- **Session Management**: Use Supabase auth with specific metadata validation to distinguish administrative sessions.

### 4. Implementation Steps
1. **Middleware**: Enhance `requireSupabaseAuth` or create a specific `requireAdminAuth` middleware.
2. **Login Page**: Implement `/admin/login` specifically for admins.
3. **Route Guards**: Implement TanStack Router loaders for all `/admin/*` routes to check admin status before rendering.
4. **Data Masking**: Update `getProfile` and other functions to mask PII for non-admins.
5. **Admin Functions**: Audit all `src/lib/admin*.functions.ts` to ensure they all call `ensureAdmin`.

## Security Review
- Verify that bypassing the frontend (e.g., via `curl`) does not allow non-admins to call administrative server functions.
- Ensure document bucket policies (`kyc-documents`) only allow 'authenticated' admins to read objects.
