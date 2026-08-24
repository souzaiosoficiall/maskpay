CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can create their own wallet"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.profiles TO authenticated;
GRANT INSERT ON public.wallets TO authenticated;