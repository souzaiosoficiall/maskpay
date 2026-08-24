CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(p_wallet_id UUID, p_amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount
  WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;
