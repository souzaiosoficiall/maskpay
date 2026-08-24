-- Missing tables and columns for MaskPay

-- Tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'Aberto',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

-- Ticket Messages table
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    attachment_path TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

-- Add missing columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'transaction_password_hash') THEN
        ALTER TABLE public.profiles ADD COLUMN transaction_password_hash TEXT;
    END IF;
END $$;

-- RLS for tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tickets" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read messages of own tickets" ON public.ticket_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets WHERE id = public.ticket_messages.ticket_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert messages to own tickets" ON public.ticket_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tickets WHERE id = public.ticket_messages.ticket_id AND user_id = auth.uid())
);

-- Internal transfer function
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
    p_sender_id UUID,
    p_receiver_email TEXT,
    p_amount DECIMAL,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receiver_id UUID;
    v_sender_wallet_id UUID;
    v_receiver_wallet_id UUID;
    v_sender_balance DECIMAL;
BEGIN
    -- Get receiver id
    SELECT id INTO v_receiver_id FROM auth.users WHERE email = p_receiver_email;
    IF v_receiver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destinatário não encontrado');
    END IF;

    -- Get wallets
    SELECT id, balance INTO v_sender_wallet_id, v_sender_balance FROM public.wallets WHERE user_id = p_sender_id;
    SELECT id INTO v_receiver_wallet_id FROM public.wallets WHERE user_id = v_receiver_id;

    IF v_sender_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
    END IF;

    -- Update balances
    UPDATE public.wallets SET balance = balance - p_amount WHERE id = v_sender_wallet_id;
    UPDATE public.wallets SET balance = balance + p_amount WHERE id = v_receiver_wallet_id;

    -- Log transactions
    INSERT INTO public.transactions (wallet_id, type, amount, description, status)
    VALUES (v_sender_wallet_id, 'transfer_out', p_amount, p_description, 'completed');

    INSERT INTO public.transactions (wallet_id, type, amount, description, status)
    VALUES (v_receiver_wallet_id, 'transfer_in', p_amount, p_description, 'completed');

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_internal_transfer(UUID, TEXT, DECIMAL, TEXT) TO authenticated;
