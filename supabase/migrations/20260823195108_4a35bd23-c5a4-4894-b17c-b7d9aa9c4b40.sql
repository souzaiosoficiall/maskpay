-- Corrigir status de solicitações existentes para aparecerem no admin
UPDATE public.verification_requests 
SET status = 'pending_review' 
WHERE status = 'pending';

-- Garantir que os perfis também estejam no status correto
UPDATE public.profiles 
SET verification_status = 'pending_review' 
WHERE verification_status = 'pending';
