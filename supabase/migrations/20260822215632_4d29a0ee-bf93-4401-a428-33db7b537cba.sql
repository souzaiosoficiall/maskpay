REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_duplicates(text, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.contact_in_use(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_internal_transfer(uuid, uuid, numeric, text) FROM anon, public;