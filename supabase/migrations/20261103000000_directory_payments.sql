-- Update 6: church directory from the 2027 meetings book, hymn book series,
-- payment page, Flutterwave confirmations and the WhatsApp payment agent.

-- ============================================================
-- 1. Districts and annexes: headquarters address, state, officers.
-- ============================================================
alter table public.districts add column if not exists kind     text not null default 'district' check (kind in ('district', 'annex'));
alter table public.districts add column if not exists admin_hq text not null default '';
alter table public.districts add column if not exists state    text not null default '';

create table if not exists public.district_officers (
  id          uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete cascade,
  role        text not null,
  name        text not null default '',
  phone       text not null default '',
  sort        int  not null default 0
);
alter table public.district_officers enable row level security;
create policy "anyone reads officers" on public.district_officers for select using (true);
create policy "editors manage officers" on public.district_officers for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

-- The National Executive Council.
create table if not exists public.council_members (
  id   uuid primary key default gen_random_uuid(),
  post text not null,
  name text not null default '',
  sort int  not null default 0
);
alter table public.council_members enable row level security;
create policy "anyone reads council" on public.council_members for select using (true);
create policy "editors manage council" on public.council_members for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

-- ============================================================
-- 2. Calendar: the Bible texts for special days.
-- ============================================================
alter table public.events add column if not exists texts text not null default '';

-- ============================================================
-- 3. Hymn book: more than one numbered list (main hymns, Akunlẹkọ, Isọji).
-- ============================================================
alter table public.hymns add column if not exists series    text not null default 'main' check (series in ('main', 'akunleko', 'isoji'));
alter table public.hymns add column if not exists label     text not null default '';
alter table public.hymns add column if not exists scripture text not null default '';
alter table public.hymns add column if not exists tune      text not null default '';
alter table public.hymns drop constraint if exists hymns_number_key;
create unique index if not exists hymns_series_number on public.hymns(series, number);

-- ============================================================
-- 4. Payments made outside the app (payment page and WhatsApp) may come
--    from someone without an account, so the payer is optional.
-- ============================================================
alter table public.payments alter column payer_id drop not null;
alter table public.payments add column if not exists payer_name  text not null default '';
alter table public.payments add column if not exists payer_email text not null default '';
alter table public.payments add column if not exists wa_phone    text;           -- WhatsApp number that asked for the account
alter table public.payments add column if not exists notified    boolean not null default false;

-- Where each WhatsApp conversation is up to.
create table if not exists public.whatsapp_sessions (
  wa_phone   text primary key,
  step       text not null default 'menu',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_sessions enable row level security;
create policy "support reads sessions" on public.whatsapp_sessions for select using (public.is_admin(array['owner','support']));

-- ============================================================
-- 5. Settings the app and the payment page need.
-- ============================================================
update public.settings set public = true where key = 'agent_whatsapp';
insert into public.settings (key, value, public) values
  ('pay_page_url', '""', true)    -- e.g. https://ona-iwa-mimo-admin.netlify.app/pay
on conflict (key) do nothing;
