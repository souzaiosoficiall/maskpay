# ZyronPay Implementation Plan

Implementation of a complete payment gateway infrastructure with orange branding, focusing on frontend, backend, and admin capabilities.

## User Review Required

> [!IMPORTANT]
> The current implementation uses simulated financial logic in `financial.functions.ts`. In a production environment, actual integration with banking APIs or payment processors (like Stripe or Pix) would be required.

## Technical Details

- **Stack**: TanStack Start, React 19, Tailwind CSS v4, MaskPay Cloud (PostgreSQL/Auth).
- **Primary Color**: `#FF6B00` (Zyron Orange).
- **Backend Architecture**:
  - Atomic ledger via PostgreSQL functions (`adjust_wallet_balance`).
  - Row-Level Security (RLS) for multi-tenant data protection.
  - Server Functions (`createServerFn`) for secure backend logic.
- **Route Structure**:
  - `/`: Public landing page.
  - `/auth`: Unified login/signup.
  - `/_authenticated`: Layout-protected dashboard area.
    - `/dashboard`: Overview and metrics.
    - `/wallet`: Balance and transfers.
    - `/transactions`: Full ledger view.
    - `/api-keys`: Developer keys.
    - `/webhooks`: Real-time notifications.

## Phase 1: Foundation & Frontend
- [x] Configure design system with Zyron Orange branding in `src/styles.css`.
- [x] Initialize database schema (profiles, wallets, transactions, roles, api_keys, webhooks).
- [x] Create public landing page (`src/routes/index.tsx`).
- [x] Implement authentication route (`src/routes/auth.tsx`).
- [x] Build authenticated dashboard layout with sidebar navigation.

## Phase 2: Dashboard & Features
- [x] Dashboard Overview with stats and activity charts.
- [x] Wallet management with simulated transfer logic.
- [x] Transactions ledger with filtering and status tracking.
- [x] API Key management for developers.
- [x] Webhook configuration interface.

## Phase 3: Backend Logic (Current)
- [x] Create atomic balance adjustment PostgreSQL function.
- [x] Implement `processTransaction` server function with validation.
- [x] Implement `generateApiKey` server function.
- [ ] Implement Admin View for KYC and transaction monitoring.
- [ ] Add real-time transaction updates using Supabase Realtime.
