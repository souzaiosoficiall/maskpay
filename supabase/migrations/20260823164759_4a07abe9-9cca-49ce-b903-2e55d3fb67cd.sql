-- Política de Leitura para o bucket ticket-attachments
CREATE POLICY "Leitura de anexos de ticket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Política de Upload para o bucket ticket-attachments
CREATE POLICY "Upload de anexos de ticket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Política de Delete (opcional, para limpeza)
CREATE POLICY "Remoção de anexos de ticket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ticket-attachments');
