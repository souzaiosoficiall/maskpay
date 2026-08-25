import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * /admin não expõe o painel — redireciona para a home.
 * Painel real: /aylla e /aylla/login
 */
export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
  component: () => null,
});
