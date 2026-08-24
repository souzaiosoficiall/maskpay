-- Fix for Function Search Path Mutable, Public Execution, and Signed-In Execution
ALTER FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) SET search_path = public;

REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM authenticated;
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM anon;

GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;
