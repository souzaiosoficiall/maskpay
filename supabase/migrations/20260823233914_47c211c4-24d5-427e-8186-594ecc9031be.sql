REVOKE ALL ON FUNCTION public.get_platform_config(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_config(text) TO service_role;