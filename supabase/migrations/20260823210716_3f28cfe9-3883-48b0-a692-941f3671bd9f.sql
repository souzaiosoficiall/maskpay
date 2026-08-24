UPDATE public.platform_configs 
SET value = '{"percentage": 2.49, "fixed": 0.40}'::jsonb 
WHERE key = 'pix_deposit_fees';

UPDATE public.platform_configs 
SET value = '{"fixed": 0.80}'::jsonb 
WHERE key = 'pix_withdrawal_fees';
