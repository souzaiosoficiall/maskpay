-- Ensure KYC and ticket storage buckets exist (policies alone are not enough).
-- "Bucket not found" on verification upload means storage.buckets never had these rows.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Re-assert policies (safe if already present)
DROP POLICY IF EXISTS "Users can upload their own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all ticket attachments" ON storage.objects;

CREATE POLICY "Users can upload their own kyc documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own kyc documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own kyc documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all kyc documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND public.has_role(auth.uid(), 'admin')
);
