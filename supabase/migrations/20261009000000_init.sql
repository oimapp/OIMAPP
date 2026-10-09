-- Ona Iwa Mimo: first database setup.
-- Money is stored in kobo (₦1,700 = 170000) so there are no rounding errors.
-- Members never read lessons or readings straight from the database. The books
-- are handed out by a server function that first checks the purchase and the phone.

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- Admin team
-- ============================================================

create table public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('owner', 'editor', 'support')),
  created_at timestamptz not null default now()
);

-- owner: everything. editor: books and free pages. support: members and payments.
create or replace function public.is_admin(roles text[] default array['owner','editor','support'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users a where a.user_id = auth.uid() and a.role = any(roles));
$$;

create table public.audit_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   uuid references auth.users(id),
  action  text not null,          -- e.g. 'reset_phone', 'make_teacher', 'grant_book'
  target  text,                   -- e.g. a member id or lesson id
  detail  jsonb not null default '{}'::jsonb
);

-- ============================================================
-- Settings (support number, phone rules...)
-- ============================================================

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  public     boolean not null default false,  -- true = the app may read it
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Members
-- ============================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text unique,                    -- international form: +2348031234567
  email       text,
  parish      text not null default '',
  language    text not null default 'en' check (language in ('en', 'yo')),
  is_teacher  boolean not null default false, -- only an admin can change this
  status      text not null default 'active' check (status in ('active', 'frozen')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- One row per phone an account has been used on. Only one can be active.
create table public.devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  install_id      text not null,              -- random id the app makes once and keeps in secure storage
  model           text not null default '',   -- e.g. 'TECNO Spark 10'
  platform        text not null check (platform in ('android', 'ios')),
  link_kind       text not null check (link_kind in ('first', 'self_move', 'admin_reset')),
  active          boolean not null default true,
  linked_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  unlinked_at     timestamptz,
  unlinked_reason text
);
create unique index devices_one_active_per_user on public.devices(user_id) where active;
create index devices_user on public.devices(user_id, linked_at desc);

-- ============================================================
-- Books and what is for sale
-- ============================================================

create table public.books (
  id              text primary key,          -- 'manual-2027', 'daily-2027', 'children-2027'
  kind            text not null check (kind in ('manual', 'daily', 'children')),
  year            int  not null,
  title_en        text not null,
  title_yo        text not null,
  status          text not null default 'draft' check (status in ('coming_soon', 'draft', 'published')),
  content_version int  not null default 0,   -- goes up each publish so phones know to refresh
  updated_at      timestamptz not null default now()
);

create table public.products (
  id          text primary key,              -- 'manual-2027', 'daily-2027', 'both-2027'
  name_en     text not null,
  name_yo     text not null,
  price_kobo  int  not null check (price_kobo > 0),
  book_ids    text[] not null,
  on_sale     boolean not null default false,
  sort        int not null default 0
);

create table public.lessons (
  book_id    text not null references public.books(id) on delete cascade,
  n          int  not null,
  date       date not null,
  review     boolean not null default false,
  en         jsonb not null,                 -- { name, topic, text, body: [...] }
  yo         jsonb not null,
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (book_id, n)
);
create trigger lessons_touch before update on public.lessons
  for each row execute function public.touch_updated_at();

create table public.readings (
  book_id    text not null references public.books(id) on delete cascade,
  date       date not null,
  sunday     boolean not null default false,
  en         jsonb not null,
  yo         jsonb not null,
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (book_id, date)
);
create trigger readings_touch before update on public.readings
  for each row execute function public.touch_updated_at();

-- Only teacher accounts see these. Never holds answers to the lesson questions.
create table public.teacher_guides (
  book_id    text not null,
  n          int  not null,
  aim        text not null default '',
  discussion text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (book_id, n),
  foreign key (book_id, n) references public.lessons(book_id, n) on delete cascade
);

-- ============================================================
-- Payments and who owns which book
-- ============================================================

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  tx_ref              text not null unique,  -- our reference, sent to Flutterwave
  payer_id            uuid not null references public.profiles(id),
  beneficiary_phone   text not null,         -- the payer's own number, or the person it is a gift for
  product_id          text not null references public.products(id),
  amount_kobo         int  not null,
  currency            text not null default 'NGN',
  status              text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  method              text,                  -- card, banktransfer, ussd
  flw_transaction_id  bigint unique,
  verified_at         timestamptz,
  raw                 jsonb,                 -- Flutterwave's answer, kept for support
  created_at          timestamptz not null default now()
);
create index payments_payer on public.payments(payer_id, created_at desc);
create index payments_status on public.payments(status, created_at desc);

create table public.entitlements (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null references public.books(id),
  source     text not null check (source in ('purchase', 'gift', 'admin')),
  payment_id uuid references public.payments(id),
  granted_by uuid references auth.users(id), -- set when an admin unlocks by hand
  reason     text,                           -- required when an admin unlocks by hand
  created_at timestamptz not null default now(),
  primary key (user_id, book_id),
  check (source <> 'admin' or (granted_by is not null and coalesce(reason, '') <> ''))
);

-- A book bought for a phone number that has no account yet waits here.
create table public.gifts (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  book_id     text not null references public.books(id),
  payment_id  uuid not null references public.payments(id),
  claimed_by  uuid references public.profiles(id),
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (phone, book_id)
);

-- When someone signs up (or adds their phone), give them any books waiting for that number.
create or replace function public.claim_gifts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is null then return new; end if;
  insert into entitlements (user_id, book_id, source, payment_id)
    select new.id, g.book_id, 'gift', g.payment_id
    from gifts g where g.phone = new.phone and g.claimed_by is null
  on conflict do nothing;
  update gifts set claimed_by = new.id, claimed_at = now()
    where phone = new.phone and claimed_by is null;
  return new;
end $$;
create trigger profiles_claim_gifts after insert or update of phone on public.profiles
  for each row execute function public.claim_gifts();

-- Does the person signed in own this book?
create or replace function public.has_book(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b);
$$;

-- ============================================================
-- Free pages
-- ============================================================

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  end_date   date,
  title_en   text not null,
  title_yo   text not null default '',
  place      text not null default '',
  kind       text not null default 'Event',
  updated_at timestamptz not null default now()
);

create table public.districts (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  sort  int not null default 0
);

create table public.churches (
  id           uuid primary key default gen_random_uuid(),
  district_id  uuid not null references public.districts(id) on delete cascade,
  name         text not null,
  town         text not null default '',
  address      text not null default '',
  prophet      text not null default '',
  phone        text not null default '',
  sort         int not null default 0
);

create table public.baba_aladura (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  years       text not null default '',   -- e.g. '1925 to 1933'
  photo_path  text,                       -- file in the 'public' storage bucket
  sort        int not null default 0
);

create table public.announcements (
  id        uuid primary key default gen_random_uuid(),
  audience  text not null check (audience in ('all', 'manual', 'daily', 'teachers', 'no_book')),
  body_en   text not null,
  body_yo   text not null default '',
  sent_by   uuid references auth.users(id),
  sent_at   timestamptz not null default now()
);

-- ============================================================
-- Security rules (row level security)
-- The server functions use the service key and skip these rules.
-- ============================================================

alter table public.admin_users     enable row level security;
alter table public.audit_log       enable row level security;
alter table public.settings        enable row level security;
alter table public.profiles        enable row level security;
alter table public.devices         enable row level security;
alter table public.books           enable row level security;
alter table public.products        enable row level security;
alter table public.lessons         enable row level security;
alter table public.readings        enable row level security;
alter table public.teacher_guides  enable row level security;
alter table public.payments        enable row level security;
alter table public.entitlements    enable row level security;
alter table public.gifts           enable row level security;
alter table public.events          enable row level security;
alter table public.districts       enable row level security;
alter table public.churches        enable row level security;
alter table public.baba_aladura    enable row level security;
alter table public.announcements   enable row level security;

-- Admin team
create policy "admins see the team"   on public.admin_users for select using (public.is_admin());
create policy "owner manages team"    on public.admin_users for all using (public.is_admin(array['owner'])) with check (public.is_admin(array['owner']));
create policy "admins read the log"   on public.audit_log   for select using (public.is_admin());
create policy "admins write the log"  on public.audit_log   for insert with check (public.is_admin() and actor = auth.uid());

-- Settings
create policy "anyone reads public settings" on public.settings for select using (public or public.is_admin());
create policy "owner changes settings"       on public.settings for all using (public.is_admin(array['owner'])) with check (public.is_admin(array['owner']));

-- Profiles: members see and edit their own name, parish and language only
create policy "member reads own profile"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "member edits own profile"   on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, parish, language) on public.profiles to authenticated;
-- Admins change is_teacher and status through server functions that also write the audit log.

-- Devices, payments, entitlements: members read their own; only the server writes
create policy "member reads own devices"      on public.devices      for select using (user_id = auth.uid() or public.is_admin());
create policy "member reads own payments"     on public.payments     for select using (payer_id = auth.uid() or public.is_admin());
create policy "member reads own books"        on public.entitlements for select using (user_id = auth.uid() or public.is_admin());
create policy "admins read gifts"             on public.gifts        for select using (public.is_admin());

-- Catalogue: anyone may see what is on sale
create policy "anyone reads books"     on public.books    for select using (status <> 'draft' or public.is_admin());
create policy "editors manage books"   on public.books    for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "anyone reads products"  on public.products for select using (on_sale or public.is_admin());
create policy "owner manages products" on public.products for all using (public.is_admin(array['owner'])) with check (public.is_admin(array['owner']));

-- Book content: admins only. Members get it through the download function.
create policy "editors manage lessons"  on public.lessons  for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "editors manage readings" on public.readings for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "admins read lessons"     on public.lessons  for select using (public.is_admin());
create policy "admins read readings"    on public.readings for select using (public.is_admin());

-- Teaching guides: active teachers who own the manual, and editors
create policy "teachers read guides" on public.teacher_guides for select using (
  public.is_admin() or (
    public.has_book(book_id) and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_teacher and p.status = 'active'))
);
create policy "editors manage guides" on public.teacher_guides for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

-- Free pages: everyone reads, editors write
create policy "anyone reads events"        on public.events        for select using (true);
create policy "anyone reads districts"     on public.districts     for select using (true);
create policy "anyone reads churches"      on public.churches      for select using (true);
create policy "anyone reads baba aladura"  on public.baba_aladura  for select using (true);
create policy "editors manage events"      on public.events        for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "editors manage districts"   on public.districts     for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "editors manage churches"    on public.churches      for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "editors manage baba aladura" on public.baba_aladura for all using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

-- Announcements: signed-in members read, editors send
create policy "members read announcements" on public.announcements for select using (auth.uid() is not null);
create policy "editors send announcements" on public.announcements for insert with check (public.is_admin(array['owner','editor']) and sent_by = auth.uid());
