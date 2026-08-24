REVOKE EXECUTE ON FUNCTION public.check_duplicates(text, text, text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.check_duplicates(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_duplicates(text, text, text, uuid) TO service_role;