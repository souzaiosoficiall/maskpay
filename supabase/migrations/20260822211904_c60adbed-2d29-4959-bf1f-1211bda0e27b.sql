-- Account verification status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_verification_status_check
    CHECK (verification_status IN ('unverified','pending_review','verified','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Prevent duplicate accounts by email / phone
DO $$ BEGIN
  CREATE UNIQUE INDEX profiles_email_unique_idx ON public.profiles (lower(email)) WHERE email IS NOT NULL AND email <> '';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX profiles_phone_unique_idx ON public.profiles (regexp_replace(phone, '\D', '', 'g')) WHERE phone IS NOT NULL AND phone <> '';
EXCEPTION WHEN others THEN NULL; END $$;

-- Verification requests
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

DROP POLICY IF EXISTS "Users view their own verification requests" ON public.verification_requests;
CREATE POLICY "Users view their own verification requests" ON public.verification_requests
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create their own verification requests" ON public.verification_requests;
CREATE POLICY "Users create their own verification requests" ON public.verification_requests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all verification requests" ON public.verification_requests;
CREATE POLICY "Admins view all verification requests" ON public.verification_requests
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update verification requests" ON public.verification_requests;
CREATE POLICY "Admins update verification requests" ON public.verification_requests
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Server-side gate used by protected features
CREATE OR REPLACE FUNCTION public.is_account_verified(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND verification_status = 'verified');
$$;

REVOKE ALL ON FUNCTION public.is_account_verified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_verified(UUID) TO authenticated, service_role;

-- Duplicate contact detection during sign-up (works before a session exists)
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