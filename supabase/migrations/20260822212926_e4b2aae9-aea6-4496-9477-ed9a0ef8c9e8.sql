-- Support Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL CHECK (subject IN ('Conta', 'Financeiro', 'Sugestão')),
    status TEXT DEFAULT 'Aberto' NOT NULL CHECK (status IN ('Aberto', 'Resolvido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ticket Messages Table
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Grants
GRANT SELECT, INSERT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

-- RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all tickets" ON public.tickets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all tickets" ON public.tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view messages of their own tickets" ON public.ticket_messages FOR SELECT 
USING (ticket_id IN (SELECT id FROM public.tickets WHERE user_id = auth.uid()));
CREATE POLICY "Users can send messages to their own tickets" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (ticket_id IN (SELECT id FROM public.tickets WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view all ticket messages" ON public.ticket_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can send messages to any ticket" ON public.ticket_messages FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Atomic Transfer Function
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  p_sender_wallet_id UUID,
  p_receiver_wallet_id UUID,
  p_amount DECIMAL,
  p_description TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_user_id UUID;
BEGIN
  -- Validate sender exists and get user_id
  SELECT user_id INTO v_sender_user_id FROM public.wallets WHERE id = p_sender_wallet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet do remetente não encontrada';
  END IF;

  -- Ensure caller is the owner (if not service_role)
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_sender_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Check balance
  IF (SELECT balance FROM public.wallets WHERE id = p_sender_wallet_id) < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Deduct from sender
  UPDATE public.wallets SET balance = balance - p_amount WHERE id = p_sender_wallet_id;
  
  -- Add to receiver
  UPDATE public.wallets SET balance = balance + p_amount WHERE id = p_receiver_wallet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet do destinatário não encontrada';
  END IF;

  -- Record transactions
  INSERT INTO public.transactions (wallet_id, type, amount, status, description)
  VALUES (p_sender_wallet_id, 'transfer_out', p_amount, 'completed', p_description);

  INSERT INTO public.transactions (wallet_id, type, amount, status, description)
  VALUES (p_receiver_wallet_id, 'transfer_in', p_amount, 'completed', p_description);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) TO service_role;
