-- Add net_amount column
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS net_amount numeric(20,2) DEFAULT 0;

-- Add metadata column
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Fix precision for existing numeric columns
ALTER TABLE public.transactions ALTER COLUMN amount TYPE numeric(20,2);
ALTER TABLE public.transactions ALTER COLUMN fee_amount TYPE numeric(20,2);

-- Re-grant permissions
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
