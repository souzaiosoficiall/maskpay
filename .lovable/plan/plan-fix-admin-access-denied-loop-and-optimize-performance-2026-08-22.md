# Plan: Fix Admin Access Denied Loop and Optimize Performance

The user is experiencing an "Access Denied" loop when trying to log into the admin panel. This is likely due to strict guards triggering redirects or session issues before the profile is fully loaded and roles are verified.

## User-Facing Changes
- **Login Fix**: The admin login will now correctly authorize the owner (`souzaaiosoficial01@gmail.com`) and navigate to the dashboard without triggering immediate "Access Denied" screens.
- **Improved Performance**: The admin dashboard is being split into smaller components to load faster and be more responsive.
- **Security Hardening**: Administrative actions are strictly locked to the specific owner email at both the frontend and backend levels.

## Technical Details

### 1. Fix Admin Route Guard (`src/routes/admin.tsx`)
- Update the `beforeLoad` guard to redirect to `/dashboard` instead of `/admin/login` if the user is authenticated but not the owner.
- This prevents the "login -> redirect back to login" loop.

### 2. Refine Layout Access Check (`src/components/AdminLayout.tsx`)
- Ensure the layout waits for the profile to load before showing "Access Denied".
- Maintain the strict owner email check.

### 3. Simplify Admin Login (`src/routes/admin.login.tsx`)
- Remove redundant RPC role checks during login.
- Rely on the `getProfile` server function to handle role verification and auto-granting (which happens automatically for the owner email).

### 4. Component Extraction for Optimization
- Continue extracting sub-sections from `src/routes/admin.index.tsx` into:
  - `src/components/admin/UserManagement.tsx`: Handles user list, search, and wallet adjustments.
  - `src/components/admin/SupportCenter.tsx`: Handles ticket viewing and management.

### 5. Backend Hardening
- Verify that `ensureAdmin` in `src/lib/admin-system.functions.ts` correctly validates the owner email from `context.claims`.

## Verification Plan
- **Manual Test**: Log in with the owner email and verify direct access to the admin dashboard.
- **Security Check**: Attempt to access `/admin` with a standard user account and confirm it redirects to `/dashboard` (or shows the Access Denied UI without logging out the user).
- **Performance Check**: Verify the admin index loads quickly and component state is isolated.
