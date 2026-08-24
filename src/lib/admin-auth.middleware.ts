import { createMiddleware } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const requireAdminAuth = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next }) => {
    return next()
  })