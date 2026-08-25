# Plan - Admin KYC Notification and Visual Indicators

Implement a notification indicator (a "little light") on the KYC menu item in the admin panel and ensure pending documents are correctly displayed.

## User Requirements
- Add a visual indicator (dot/light) on the "KYC" menu item when there are pending documents.
- Fix the issue where documents don't appear in the admin panel even when pending.
- Language: Portuguese (as requested by user "luizinha encima do nome KFC").

## Technical Changes

### 1. Database & Backend Analysis
- The user reports documents are pending but not showing.
- `src/lib/admin.functions.ts`: `getKycRequests` filters by `kyc_status = 'pending'`.
- `src/lib/admin.functions.ts`: `getKycRequestAdmin` filters by `status = 'pending_review'` in `verification_requests`.
- `src/routes/admin.index.tsx` calculates `kycPending` based on `u.kyc_status === 'pending' || u.verification_status === 'pending_review'`.
- **Potential Issue**: Inconsistency between `profiles.kyc_status` and `verification_requests.status`.
- **Action**: Ensure the admin fetches the latest state and the UI correctly maps them.

### 2. Admin Layout (`src/routes/admin.index.tsx`)
- Update the tab navigation to show a notification dot on the KYC tab.
- The dot will appear if `kycPending.length > 0`.

### 3. KYC Moderation View (`src/components/admin/KycModerationView.tsx`)
- Update the document retrieval logic to be more resilient.
- Ensure that if `verification_requests` exist for a user, they are fetched even if the exact status string has a minor mismatch.

### 4. Admin Navigation Indicator
- Add a small red/yellow dot above or next to the KYC text/icon in the navigation bar.

## Proposed Steps

### Step 1: Update Admin Layout Tabs
Modify `src/routes/admin.index.tsx` to add a notification badge to the KYC tab button.

### Step 2: Fix Data Consistency
Review `src/lib/admin.functions.ts` to ensure it fetches documents correctly. It currently searches for `pending_review`. I will verify if the user's uploaded documents are landing in that state.

### Step 3: UI Enhancement
Add the visual indicator to `src/routes/admin.index.tsx` tab list.
