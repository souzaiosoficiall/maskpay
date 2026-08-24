DROP FUNCTION IF EXISTS public.is_account_verified(UUID);
REVOKE EXECUTE ON FUNCTION public.contact_in_use(TEXT, TEXT) FROM anon, authenticated;