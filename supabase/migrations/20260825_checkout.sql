-- Checkout products + orders (run in Supabase SQL Editor)

create table if not exists public.checkout_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  theme_color text not null default '#22c55e',
  banner_url text,
  icon_url text,
  feedbacks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_products_user_id_idx on public.checkout_products(user_id);
create index if not exists checkout_products_slug_idx on public.checkout_products(slug);

create table if not exists public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.checkout_products(id) on delete cascade,
  merchant_user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists checkout_orders_merchant_idx on public.checkout_orders(merchant_user_id);
create index if not exists checkout_orders_product_idx on public.checkout_orders(product_id);

alter table public.checkout_products enable row level security;
alter table public.checkout_orders enable row level security;

-- Owner manages own products
drop policy if exists "checkout_products_owner_all" on public.checkout_products;
create policy "checkout_products_owner_all" on public.checkout_products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public read active products by slug (anon)
drop policy if exists "checkout_products_public_read" on public.checkout_products;
create policy "checkout_products_public_read" on public.checkout_products
  for select using (active = true);

-- Orders: merchant reads own
drop policy if exists "checkout_orders_merchant_read" on public.checkout_orders;
create policy "checkout_orders_merchant_read" on public.checkout_orders
  for select using (auth.uid() = merchant_user_id);

-- Inserts via service role / server only typically; allow authenticated insert for own merchant_user_id
drop policy if exists "checkout_orders_merchant_insert" on public.checkout_orders;
create policy "checkout_orders_merchant_insert" on public.checkout_orders
  for insert with check (auth.uid() = merchant_user_id);
