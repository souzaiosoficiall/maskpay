# EvoPay Integration Plan

Integrate EvoPay as the primary payment gateway for Pix deposits and withdrawals, including automated fee management and administrative control.

## User Review Required

> [!IMPORTANT]
> **EvoPay Credentials Needed**: To proceed with the real integration, I need the following credentials from your EvoPay merchant panel:
> 1. **Merchant ID** (or Client ID)
> 2. **API Token** (or Secret Key)
> 3. **Webhook Secret** (if used for signature verification)
>
> Please provide these so I can store them securely as Secrets. **Do not paste them in the chat if you prefer; you can use the `add_secret` tool if prompted, or I will wait for your input.**

## Proposed Changes

### 1. Database & Config
- Create a `platform_configs` table to store central settings (like Pix fees).
- Seed initial fees:
    - Deposit: 2.49% + R$0.40
    - Withdrawal: R$0.80
- Add columns to `transactions` for EvoPay tracking: `evopay_id`, `fee_amount`, `net_amount`.

### 2. Backend (Server Functions)
- **`src/lib/payments.functions.ts`**:
    - `generatePixDeposit`: Authenticates with EvoPay, calculates fees, creates a pending transaction, and returns the QR Code/Copy-Paste string.
    - `requestPixWithdrawal`: Validates balance/transaction password, calculates fees, and triggers the EvoPay cashout API.
- **`src/routes/api/public/evopay-webhook.ts`**:
    - Public endpoint to receive status updates from EvoPay.
    - Implements signature validation and idempotency (preventing double balance updates).

### 3. Frontend (UI)
- Update the Deposit/Withdrawal flows to show real-time fee calculations.
- Display EvoPay-provided QR codes and status indicators (Pending/Confirmed).
- Add an Admin interface (under `/admin`) to edit the platform fees stored in the database.

## Technical Details
- **Security**: All API calls to EvoPay happen server-side. Credentials are never exposed to the client.
- **Precision**: Use `Intl.NumberFormat` for BRL and handle currency as decimals (number in DB) with careful rounding to 2 decimal places in calculations.
- **Idempotency**: Use EvoPay's transaction ID as a unique constraint or reference in our database to prevent duplicate processing of the same payment event.
