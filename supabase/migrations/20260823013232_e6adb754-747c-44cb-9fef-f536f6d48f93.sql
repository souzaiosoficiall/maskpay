-- 1. Fix search_path + revoke public execute on trigger function
CREATE OR REPLACE FUNCTION public.handle_admin_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.email = 'souzaiosoficial@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.profiles (id, email, full_name, kyc_status, verification_status, status)
    VALUES (NEW.id, NEW.email, 'Administrador Principal', 'verified', 'verified', 'active')
    ON CONFLICT (id) DO UPDATE SET
      kyc_status = 'verified',
      verification_status = 'verified',
      status = 'active';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_admin_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_admin_role_assignment() FROM PUBLIC, anon, authenticated;

-- 2. has_role must not be callable by anonymous visitors
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(app_role, uuid) TO authenticated, service_role;

-- 3. Prevent sender spoofing on ticket messages
DROP POLICY IF EXISTS "Users can send messages to their own tickets" ON public.ticket_messages;
CREATE POLICY "Users can send messages to their own tickets"
ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND ticket_id IN (SELECT id FROM public.tickets WHERE user_id = auth.uid())
);

-- 4. Consolidate duplicate verification_requests policies
DROP POLICY IF EXISTS "Users can insert own verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users create their own verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can view own verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users view their own verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins view all verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can update all verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins update verification requests" ON public.verification_requests;

CREATE POLICY "verification_requests_insert_own"
ON public.verification_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verification_requests_select_own_or_admin"
ON public.verification_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verification_requests_update_admin"
ON public.verification_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));