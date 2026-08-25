# Plan: Fix Ticket Chat Interface and Sender Identification

Refine the support ticket system to ensure clear identification of senders (Support vs. User) in both the User and Admin views, addressing the reported visual inconsistencies and header bugs.

## Technical Details

### 1. Database & Server Functions
- Update `src/lib/support.functions.ts`:
  - Ensure `sendTicketMessage` correctly identifies if the sender is an admin (Support) vs. the ticket owner.
  - Fix the `metadata` to consistently include `sender_name: 'SUPORTE MASK'` for admin replies.
  - Verify `user_id` is set to the *actual sender* (admin's UID or user's UID) while `metadata` handles the display alias.

### 2. User View (`src/routes/_authenticated.support.tsx`)
- Refine the chat bubble logic:
  - **Left Side:** Support messages (where `metadata?.sender_name === 'SUPORTE MASK'` or `user_id === null`).
  - **Right Side:** User's own messages.
  - Update the "Header" area to ensure it doesn't show the user's own name as if they are talking to themselves when a response arrives.

### 3. Admin View (`src/components/admin/SupportCenter.tsx`)
- Fix the sender logic in the admin chat:
  - **Right Side:** Admin (Support) messages.
  - **Left Side:** User (Customer) messages.
  - **Header Bug:** Fix the issue where the user's name appears incorrectly in the header when the admin sends a message (ensure the header identifies the *subject* of the ticket, not the last sender).
- Update the avatar logic to show the correct roles.

### 4. Logic Verification
- Messages where `metadata.sender_name` is present should be treated as "Support" regardless of which admin UID sent it.
- System messages (initial boot) stay on the left for the user.
- Ensure the admin view correctly attributes messages to the specific user they are helping.

## Steps
1. Modify `src/lib/support.functions.ts` to ensure admin replies carry the correct metadata.
2. Update `src/routes/_authenticated.support.tsx` to fix bubble positioning and display names.
3. Update `src/components/admin/SupportCenter.tsx` to fix bubble positioning and the header name bug.
