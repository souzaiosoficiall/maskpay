-- Políticas para o painel admin ler todos os dados (fallback sem service role)
-- Rode no SQL Editor do Supabase

-- profiles: admin vê todos
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or lower(coalesce((select email from auth.users where id = auth.uid()), ''))
       = lower('souzaiosoficial@gmail.com')
  );

-- wallets: admin vê todos
drop policy if exists "wallets_admin_select_all" on public.wallets;
create policy "wallets_admin_select_all" on public.wallets
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or lower(coalesce((select email from auth.users where id = auth.uid()), ''))
       = lower('souzaiosoficial@gmail.com')
  );

-- transactions: admin vê todos
drop policy if exists "transactions_admin_select_all" on public.transactions;
create policy "transactions_admin_select_all" on public.transactions
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or lower(coalesce((select email from auth.users where id = auth.uid()), ''))
       = lower('souzaiosoficial@gmail.com')
  );

-- verification_requests: admin vê todos
drop policy if exists "verification_requests_admin_select_all" on public.verification_requests;
create policy "verification_requests_admin_select_all" on public.verification_requests
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or lower(coalesce((select email from auth.users where id = auth.uid()), ''))
       = lower('souzaiosoficial@gmail.com')
  );
