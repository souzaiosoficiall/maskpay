-- Add phone and document to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_password_hash TEXT;

-- Add index on document for lookup if needed
CREATE INDEX IF NOT EXISTS idx_profiles_document ON public.profiles(document);
