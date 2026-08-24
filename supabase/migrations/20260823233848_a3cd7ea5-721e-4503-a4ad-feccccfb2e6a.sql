-- 1. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.process_internal_transfer(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_internal_transfer(uuid, text, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_platform_config(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_config(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. admin_logs
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read admin logs" ON public.admin_logs;
CREATE POLICY "Admins can read admin logs" ON public.admin_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can insert admin logs" ON public.admin_logs;
CREATE POLICY "Admins can insert admin logs" ON public.admin_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. user_roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. platform_configs
DROP POLICY IF EXISTS "Allow public read on configs" ON public.platform_configs;
GRANT SELECT ON public.platform_configs TO anon;
GRANT SELECT ON public.platform_configs TO authenticated;
GRANT ALL ON public.platform_configs TO service_role;
CREATE POLICY "Public can read fee configs only" ON public.platform_configs
  FOR SELECT TO anon USING (key IN ('pix_deposit_fees', 'pix_withdrawal_fees'));
CREATE POLICY "Authenticated can read configs" ON public.platform_configs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage configs" ON public.platform_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. verification_requests admin review
CREATE POLICY "Admins can read verification requests" ON public.verification_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT UPDATE ON public.verification_requests TO authenticated;
CREATE POLICY "Admins can update verification requests" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. wallets admin read
CREATE POLICY "Admins can read all wallets" ON public.wallets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));