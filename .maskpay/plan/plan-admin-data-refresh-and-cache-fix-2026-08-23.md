# Plan - Admin Data Refresh and Cache Fix

Correct the issue where administrative data only updates after logging out and back in. Ensure all admin views revalidate data on mount, window focus, and after administrative actions.

## Proposed Changes

### 1. Administrative Dashboard Component
- Update `src/routes/admin.index.tsx` to configure `useQuery` for core admin data:
  - Set `staleTime: 0` to ensure data is considered old immediately.
  - Set `refetchOnMount: 'always'` to force a refresh whenever the admin panel is opened.
  - Set `refetchOnWindowFocus: true` to refresh when the user returns to the tab.
- Add cache invalidation for related queries in all administrative mutations (status updates, balance changes, KYC moderation, and ticket management).

### 2. User Management Component
- Ensure `src/components/admin/UserManagement.tsx` correctly displays data passed from the parent and that its local state doesn't interfere with data freshness.

### 3. KYC Moderation Component
- Update `src/components/admin/KycModerationView.tsx` to use consistent cache keys and ensure it revalidates when a specific KYC request is selected.

### 4. Support and Ticket Logic
- Review `src/lib/support.functions.ts` and `src/routes/admin.index.tsx` to ensure ticket list and messages are invalidated correctly after responses or status changes.

## Technical Details
- Using `queryClient.invalidateQueries` after every mutation in `src/routes/admin.index.tsx`.
- Standardizing the `queryKey` usage to avoid partial cache hits with old data.
- Forcing a hard fetch on the `admin_users` and `admin_tickets` queries by removing `gcTime` and `staleTime` overrides that might be keeping old data in memory.
- Adding `refetchInterval` for live-ish data like support tickets if needed, though manual F5/refresh support is the primary goal.

## User Review Required
- Does the user want a specific "Refresh" button in the UI as well, or is F5/automatic refresh on focus sufficient? (Assuming automatic/F5 is preferred based on the prompt).
