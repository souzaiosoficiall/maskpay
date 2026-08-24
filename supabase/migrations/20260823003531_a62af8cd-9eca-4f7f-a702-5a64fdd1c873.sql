DROP POLICY IF EXISTS "Users can read platform_configs" ON public.platform_configs;

CREATE POLICY "Users can read public fee configs"
ON public.platform_configs
FOR SELECT
TO authenticated
USING (key IN ('pix_deposit_fees', 'pix_withdrawal_fees'));

REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_internal_transfer(uuid, uuid, numeric, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(uuid, uuid, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.contact_in_use(text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.contact_in_use(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_duplicates(text, text, text, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.check_duplicates(text, text, text, uuid) TO service_role;
