-- Restrict adjust_wallet_balance
REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;

-- Restrict process_internal_transfer
REVOKE EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(UUID, UUID, DECIMAL, TEXT) TO service_role;

-- Restrict has_role (already SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
