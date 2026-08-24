-- 20260822171204_13cf0a62-f2d2-430a-a63f-4221a455881f.sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    currency TEXT DEFAULT 'BRL' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, currency)
);

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'transfer_in', 'transfer_out', 'fee')),
    amount DECIMAL(15, 2) NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    reference_id UUID, -- Idempotency key or external ref
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    key_name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] DEFAULT '{read}' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] DEFAULT '{transaction.completed}' NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role DEFAULT 'user' NOT NULL,
    UNIQUE (user_id, role)
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT 
USING (wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their own api keys" ON public.api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own webhooks" ON public.webhooks FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

CREATE POLICY "Admins can see all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can see all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can see all transactions" ON public.transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 20260822171218_d422dc29-07c9-449e-968a-c5ea66e9c369.sql
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 20260822171416_9401743b-657d-483e-8e95-a0d5beebff7a.sql
CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(p_wallet_id UUID, p_amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount
  WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;

-- 20260822171444_e930c2ce-bc19-4d99-977c-a45781329ce7.sql
ALTER FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) SET search_path = public;
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM authenticated;
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, DECIMAL) TO service_role;

-- 20260822171649_fdadf326-2323-41b4-9853-681184400b16.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- 20260822203723_7d52f862-7bb2-4c6b-8348-ae92cc518747.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_password_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_document ON public.profiles(document);

-- 20260822205311_2ca4f837-107b-402a-91ea-04cf454182f2.sql
CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can create their own wallet"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.profiles TO authenticated;
GRANT INSERT ON public.wallets TO authenticated;

-- 20260822211904_c60adbed-2d29-4959-bf1f-1211bda0e27b.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_verification_status_check
    CHECK (verification_status IN ('unverified','pending_review','verified','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

DO $$ BEGIN
  CREATE UNIQUE INDEX profiles_email_unique_idx ON public.profiles (lower(email)) WHERE email IS NOT NULL AND email <> '';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX profiles_phone_unique_idx ON public.profiles (regexp_replace(phone, '\D', '', 'g')) WHERE phone IS NOT NULL AND phone <> '';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('rg','cnh')),
  front_path TEXT NOT NULL,
  back_path TEXT NOT NULL,
  selfie_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS verification_requests_user_idx ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS verification_requests_status_idx ON public.verification_requests(status);

GRANT SELECT, INSERT ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own verification requests" ON public.verification_requests
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users create their own verification requests" ON public.verification_requests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all verification requests" ON public.verification_requests
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update verification requests" ON public.verification_requests
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.contact_in_use(_email TEXT, _phone TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _email IS NOT NULL AND _email <> '' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(email) = lower(_email)
    ) THEN 'email'
    WHEN _phone IS NOT NULL AND regexp_replace(_phone,'\D','','g') <> '' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE regexp_replace(coalesce(phone,''),'\D','','g') = regexp_replace(_phone,'\D','','g')
    ) THEN 'phone'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.contact_in_use(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_in_use(TEXT, TEXT) TO anon, authenticated, service_role;

-- 20260822211928_6b87c9ac-d5b9-4959-9e85-267a46cd78b5.sql
-- Note: Skipping the drop of is_account_verified if it wasn't created yet or was intentional
-- but I'll follow the exact sequence if possible.
REVOKE EXECUTE ON FUNCTION public.contact_in_use(TEXT, TEXT) FROM anon, authenticated;