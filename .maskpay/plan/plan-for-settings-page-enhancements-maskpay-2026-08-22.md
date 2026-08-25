# Plan for Settings Page Enhancements (MaskPay)

This plan implements a real settings management system using Supabase, including user profiles, sensitive data masking, and multi-tier password security (Access Password and Transaction Password).

## User Review Required

> [!IMPORTANT]
> - The new "Transaction Password" (4 digits) will be required for sensitive operations (withdrawals/transfers).
> - Profile data (Email, Phone, CPF/CNPJ) will be fetched from the `profiles` table and masked for privacy.
> - Access Password (6 digits) update will be implemented via Supabase Auth.

## Proposed Changes

### Database & Schema (MaskPay Cloud)
- Create a migration to add sensitive fields to `public.profiles`:
  - `phone`: TEXT
  - `document`: TEXT (CPF/CNPJ)
  - `transaction_password_hash`: TEXT (for the 4-digit PIN)
- Add security grants and RLS policies for profile updates.

### Server Functions (`src/lib/settings.functions.ts`)
- `getProfile`: Fetch the current user's profile.
- `updateAccessPassword`: Update Supabase Auth password (validated for 6 digits).
- `updateTransactionPassword`: Set or update the 4-digit transaction PIN.
- `updateProfile`: Update non-sensitive profile info (if needed).

### Frontend Enhancements
- **Settings Page overhaul (`src/routes/_authenticated.settings.tsx`):**
  - Implement the Profile Top section with auto-generated initials and full name.
  - Implement "Informações Pessoais" with data masking (e.g., `thiarl********@gmail.com`).
  - Implement "Segurança" section with two sub-options:
    - Change Access Password (6 digits modal/form).
    - Manage Transaction Password (4 digits modal/form).
- **Utility Functions:**
  - Add data masking helpers to `src/lib/utils.ts`.

## Technical Details

### Security Implementation
- **Data Masking:** Logic implemented client-side to partially obscure strings.
- **Passwords:**
  - Access Password: 6 digits, managed by Supabase Auth (`updateUser`).
  - Transaction Password: 4 digits, stored as a hash in the `profiles` table.

### Components
- Use existing `Card`, `Button`, `Input`, `Label` from Shadcn.
- Use `framer-motion` for smooth transitions between settings sections.
- Use `Avatar` component with `AvatarFallback` for initials.

## Success Criteria
- [ ] User can see their real name and initials at the top.
- [ ] Profile data (Email, Phone, CPF/CNPJ) is visible but masked.
- [ ] User can update their 6-digit access password.
- [ ] User can set/update their 4-digit transaction password.
- [ ] All inputs are validated according to the digit requirements.
