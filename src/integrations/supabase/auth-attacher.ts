import { createMiddleware } from '@tanstack/react-start'
import { supabase } from './client'
import { adminSupabase } from './admin-client'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
// On /aylla (admin) routes, use the isolated admin session so user tab sessions
// are never overwritten / mixed.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const path =
      typeof window !== 'undefined' ? window.location.pathname || '' : ''
    const isAdminPanel =
      path === '/aylla' ||
      path.startsWith('/aylla/') ||
      path === '/admin' ||
      path.startsWith('/admin/')

    if (isAdminPanel) {
      const { data } = await adminSupabase.auth.getSession()
      const token = data.session?.access_token
      return next({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    }

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)