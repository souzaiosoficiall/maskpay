# Plan - Admin System Decoupling

The user wants to remove the standard dashboard sidebar from the Admin System and move it to a completely separate route structure. Currently, `/admin` is a child of `_authenticated`, which uses `DashboardLayout`.

## User Review Required

> [!IMPORTANT]
> The admin panel will no longer share the user dashboard layout. It will have its own dedicated layout and navigation.

## Proposed Changes

### Routing Structure
- Create `src/routes/_admin.tsx` as a new layout route for admin pages.
- Move the logic from `src/routes/_authenticated.admin.tsx` to a new structure under `/_admin`.
- Actually, since the user said "APENAS DO SISTEMA ADMIN!", I will create a dedicated `AdminLayout` that does NOT include the sidebar elements marked in the screenshot (the entire `aside` element).

### Components
- Create `src/components/AdminLayout.tsx` which will be a clean, full-width layout without the user dashboard sidebar.
- It will feature a simplified header and the tab navigation already present in the admin page.

### Layout Refactoring
- **DashboardLayout.tsx**: Remove the "Painel Admin" link from the user sidebar to further decouple the two systems, as requested ("APENAS DO SISTEMA ADMIN!").
- **Admin System**: The tab navigation (Dashboard, Usuários, KYC, etc.) will remain but will be the primary navigation method for admins.

## Technical Details

1.  **New Layout**: `src/components/AdminLayout.tsx`
    ```tsx
    // Full width layout with its own header and navigation
    ```
2.  **Route Change**: Update `src/routes/_authenticated.admin.tsx` to NOT use `DashboardLayout`.
    - However, TanStack Router uses file-based routing. `_authenticated.admin.tsx` is nested under `_authenticated`.
    - To truly decouple it, I should move it to `src/routes/admin.tsx` (or similar) and wrap it in its own auth gate that doesn't use the dashboard layout.
    - I'll rename `src/routes/_authenticated.admin.tsx` to `src/routes/_admin.index.tsx` and create `src/routes/_admin.tsx` for the layout.

3.  **Sidebar Cleanup**: Remove the `adminItems` section from `src/components/DashboardLayout.tsx`.
