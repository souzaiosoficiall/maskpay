# Plan: Enhanced Ticket Support System

Implement a robust support ticket system for MaskPay, featuring separate user and admin flows, status categorization, message history (conversation-style), and file attachments.

## Technical Details

### Database (Supabase)
- Create `tickets` table:
    - `id` (uuid, pk)
    - `user_id` (uuid, fk -> auth.users)
    - `subject` (enum: 'Conta', 'Financeiro', 'Sugestão')
    - `status` (enum: 'Aberto', 'Resolvido')
    - `created_at` (timestamp)
- Create `ticket_messages` table:
    - `id` (uuid, pk)
    - `ticket_id` (uuid, fk -> tickets)
    - `sender_id` (uuid, fk -> auth.users)
    - `content` (text)
    - `attachment_url` (text, optional)
    - `created_at` (timestamp)
- RLS Policies:
    - Users can read/create their own tickets and messages.
    - Admins can read/update all tickets and messages.
    - Public schema `GRANT` statements.

### Server Functions (`src/lib/support.functions.ts`)
- `createTicket`: Create a new ticket with an initial message and optional attachment.
- `getTickets`: List tickets for the current user (filtered by status).
- `getAdminTickets`: List all tickets (for admin).
- `getTicketMessages`: Fetch the conversation history for a specific ticket.
- `sendTicketMessage`: Append a message to a ticket (used by both user and admin).
- `resolveTicket`: Update ticket status to 'Resolvido' (admin only).

### User Interface
- **Support Page (`src/routes/_authenticated.support.tsx`)**:
    - Categorized lists: "Abertos" and "Resolvidos".
    - "Novo Ticket" button opening a multi-step modal (Subject -> Message -> Attachment).
    - Image attachment preview and removal.
    - Conversation view for selected tickets with distinct user/admin styling.
- **Admin Page (`src/routes/_authenticated.admin.tsx`)**:
    - Update the "Tickets" tab to show real data.
    - Admin interface to reply and resolve tickets.

### Assets
- Setup Supabase storage bucket `ticket-attachments` for image uploads.

## User Experience
- Real-time updates via Supabase subscriptions (optional, but recommended for chat feel).
- Mobile-friendly bento-grid and charcoal theme consistency.
- Responsive conversation view.
