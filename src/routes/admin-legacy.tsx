import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Old /admin path — redirect away so it is not an obvious entry point.
 * Real panel lives at /aylla
 */
export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
  component: () => null,
});
