import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * /admin e /admin/* não expõem o painel.
 * Painel real: /aylla e /aylla/login
 */
export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
  component: () => null,
});
