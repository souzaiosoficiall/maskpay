-- Páginas de checkout ligadas a produtos do catálogo
create table if not exists public.checkout_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.checkout_products(id) on delete cascade,
  slug text not null unique,
  theme_color text not null default '#6366f1',
  banner_url text,
  description text not null default '',
  feedbacks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_pages_user_id_idx on public.checkout_pages(user_id);
create index if not exists checkout_pages_slug_idx on public.checkout_pages(slug);
create index if not exists checkout_pages_product_id_idx on public.checkout_pages(product_id);

alter table public.checkout_pages enable row level security;

drop policy if exists "checkout_pages_owner_all" on public.checkout_pages;
create policy "checkout_pages_owner_all" on public.checkout_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkout_pages_public_read" on public.checkout_pages;
create policy "checkout_pages_public_read" on public.checkout_pages
  for select using (active = true);
