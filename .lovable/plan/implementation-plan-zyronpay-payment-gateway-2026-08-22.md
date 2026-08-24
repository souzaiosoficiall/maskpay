# Implementation Plan - ZyronPay Payment Gateway

Building a complete payment gateway called **ZyronPay** with a brand color of orange. The project will be split into three phases: Frontend, Backend, and Admin.

## User Review Required

> [!IMPORTANT]
> The request involves building a full payment gateway (API, webhooks, financial ledger). This requires careful handling of security and financial data. I will use **Lovable Cloud** for persistent storage and authentication.

- Do you have a specific orange hex code in mind, or should I pick a vibrant, modern orange (e.g., `#FF6B00`)?
- For the "Cash-in" (Deposit) and "Cash-out" (Withdrawal) features, do you want to integrate with actual providers (like Stripe or Pix) or should I start with a simulated system for now?

## Proposed Changes

### Phase 1: Frontend (Landing, Dashboard, Auth)
- **Branding**: Set up a custom theme with orange as the primary color in `src/styles.css`.
- **Landing Page**: Update `src/routes/index.tsx` with a professional landing page for ZyronPay.
- **Authentication**: Create `/auth` routes for Login and Signup using Lovable Cloud.
- **Dashboard & Navigation**: Implement a layout with a sidebar containing:
    - **Dashboard**: Overview of balance and activity.
    - **Wallet**: Detailed balance and assets.
    - **Transactions**: History with filtering.
    - **Operations**: Cash-in and Cash-out forms.
    - **Developer tools**: API keys and Webhook management.
    - **Settings**: Profile and account configuration.

### Phase 2: Backend (Persistence & Logic)
- **Database Schema**:
    - `profiles`: User information.
    - `wallets`: Current balances for users.
    - `transactions`: Ledger of all movements (Idempotent tracking).
    - `api_keys`: Scoped keys for external integration.
    - `webhooks`: Configuration for external notifications.
- **Server Functions**:
    - `processTransaction`: Handles ledger entries and balance updates.
    - `createApiKey`: Generates and stores scoped keys.
    - `handleWebhook`: Emits events to external URLs.

### Phase 3: Admin (Management)
- **Admin Dashboard**: A protected area (`/admin`) for operators.
- **Management Tools**:
    - User oversight and KYC status.
    - Global transaction history.
    - Deposit/Withdrawal approval flow.
    - System-wide configuration (Fees, blocks).

## Technical Details

- **Tech Stack**: TanStack Start (React 19), Tailwind CSS v4, Lucide Icons, Shadcn UI.
- **Persistence**: Lovable Cloud (PostgreSQL).
- **Security**: 
    - Row-Level Security (RLS) to ensure users only see their own data.
    - Server functions for financial logic to prevent client-side manipulation.
    - Zod for strict input validation.
- **Branding**: Custom Tailwind primary colors mapped to Orange-500/600.
