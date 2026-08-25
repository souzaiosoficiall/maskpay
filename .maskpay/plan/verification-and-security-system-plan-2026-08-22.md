# Verification and Security System Plan

Implement a full account verification (KYC) system with strict logical blocking for non-verified users, multi-step document upload, and administrative review.

## User Experience
- **Restricted Access**: New accounts start as "Pendente". Only the Dashboard is accessible; all other sidebar items are locked (visual lock + route protection).
- **KYC Banner**: Prominent red warning on the Dashboard for unverified users with a "Start Verification" button.
- **Step 1 - Data Confirmation**: Users confirm their existing profile data (Name, Email, Document, Phone).
- **Step 2 - Document Selection**: Choose between RG or CNH and upload front/back photos.
- **Step 3 - Selfie**: Upload a photo holding the document.
- **Review State**: After submission, the banner changes to "Verification under review" (blue/neutral), and functionality remains locked.
- **Admin Panel**: Review area for administrators to see all submitted documents and Approve/Reject.

## Technical Details

### 1. Database Schema
- **Tables**: Use existing `verification_requests` and `profiles`.
- **States**: 
  - `verification_status`: 'unverified', 'pending' (submitted), 'verified', 'rejected'.
  - `kyc_status`: mapped to the same logical states.
- **Storage**: Use Supabase storage bucket `kyc-documents` for uploads with strict RLS (only user can upload/view their own; admins can view all).

### 2. Backend Logic
- **`src/lib/kyc.functions.ts`**:
  - `submitVerification`: Validates and records a new KYC request. Updates `profiles.verification_status` to 'pending'.
  - `getVerificationStatus`: Returns current KYC status for the user.
- **`src/lib/admin.functions.ts`**:
  - Update `updateKycStatus` to handle the 'rejected' case: block account and update profile.
- **Route Guarding**:
  - Update `src/routes/_authenticated.tsx` or `src/components/DashboardLayout.tsx` to enforce the lock.
  - Redirect unauthorized access from protected routes to `/dashboard`.

### 3. Frontend Implementation
- **`src/routes/_authenticated.dashboard.tsx`**: Add the KYC warning banner based on `verification_status`.
- **`src/routes/_authenticated.verify.tsx` (New)**: The multi-step KYC wizard.
- **`src/components/DashboardLayout.tsx`**:
  - Visual lock icons for non-verified users.
  - Logical check in the layout to block rendering or redirect if accessing a locked route.

### 4. Admin Interface
- **`src/routes/_authenticated.admin.tsx`**: Add a detailed KYC request view showing front, back, and selfie images with Approve/Reject buttons.

## Security Controls
- **RLS**: Ensure `verification_requests` are locked down.
- **Route Guards**: Server-side functions already use `requireSupabaseAuth`; add verification checks to critical financial functions (transfer, withdraw).
- **Duplication**: Add unique constraints or RLS functions to prevent duplicate Email/Phone registrations (already partially implemented).
