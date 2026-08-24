-- Fix for WARN: Public Can Execute SECURITY DEFINER Function
-- Fix for WARN: Signed-In Users Can Execute SECURITY DEFINER Function
-- Revoke all execute permissions first
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;

-- Explicitly grant execute only to service_role (and authenticated if needed, 
-- but since it's used in RLS policies by the engine, it needs access)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

-- Fix for INFO: RLS Enabled No Policy on user_roles
-- Authenticated users need to be able to read their own roles (or we use service_role via has_role)
-- The has_role function already handles access to user_roles using SECURITY DEFINER.
-- However, we still need a policy for the table itself since RLS is enabled.
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
