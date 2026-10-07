-- Vardhman Billing Desk: Supabase schema for optional cloud sync.
-- Run this in the Supabase SQL editor of a new project, then put the project URL
-- and anon key in .env as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  shop_name text,
  gst_number text,
  address text,
  state text default 'Uttar Pradesh',
  mobile text,
  email text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  upi_id text,
  proprietor text,
  invoice_prefix text,
  invoice_start_number integer default 1001,
  low_stock_threshold integer default 5,
  terms text,
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  barcode text,
  hsn text,
  category text,
  unit text default 'PCS',
  rate numeric(12, 2) not null default 0,
  purchase_rate numeric(12, 2) default 0,
  discount numeric(5, 2) default 0,
  gst numeric(5, 2) default 18,
  stock numeric(12, 2) default 0,
  created_at timestamptz default now()
);
create index if not exists products_user_idx on public.products (user_id);
create index if not exists products_barcode_idx on public.products (user_id, barcode);

create table if not exists public.invoices (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text not null,
  date date not null,
  time text,
  customer_name text,
  customer_address text,
  customer_mobile text,
  customer_gstin text,
  customer_state text,
  payment_mode text,
  salesperson text,
  delivery_note text,
  ref_no text,
  order_no text,
  dispatch_through text,
  destination text,
  terms_delivery text,
  freight numeric(12, 2) default 0,
  freight_gst numeric(5, 2) default 18,
  extra_discount numeric(12, 2) default 0,
  subtotal numeric(12, 2) default 0,
  discount_total numeric(12, 2) default 0,
  cgst_total numeric(12, 2) default 0,
  sgst_total numeric(12, 2) default 0,
  igst_total numeric(12, 2) default 0,
  round_off numeric(6, 2) default 0,
  grand_total numeric(12, 2) default 0,
  amount_paid numeric(12, 2),
  payments jsonb default '[]'::jsonb,
  notes text,
  is_local boolean default true,
  amount_in_words text,
  items jsonb not null default '[]'::jsonb,
  shop_config jsonb,
  created_by text,
  created_at timestamptz default now(),
  unique (user_id, invoice_number)
);
create index if not exists invoices_user_date_idx on public.invoices (user_id, date desc);

-- Row Level Security: every user only sees their own shop's data
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own products" on public.products;
create policy "own products" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own invoices" on public.invoices;
create policy "own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Upgrading an older project that already has these tables? Add the new columns:
alter table public.profiles add column if not exists state text default 'Uttar Pradesh';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists bank_name text;
alter table public.profiles add column if not exists upi_id text;
alter table public.profiles add column if not exists low_stock_threshold integer default 5;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists purchase_rate numeric(12, 2) default 0;
alter table public.invoices add column if not exists amount_paid numeric(12, 2);
alter table public.invoices add column if not exists payments jsonb default '[]'::jsonb;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists shop_config jsonb;
alter table public.invoices add column if not exists created_by text;
