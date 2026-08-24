REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) FROM PUBLIC;

-- Ensure service_role still has access for server-side supabaseAdmin calls
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) TO service_role;
