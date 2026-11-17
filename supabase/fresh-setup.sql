-- Ona Iwa Mimo: the whole database in one file, for a NEW Supabase project.
-- Paste everything into Supabase > SQL Editor > New query and click Run once.
-- (It is the starting design, the starting data and every update up to Update 7, in the right order.)

-- ============ migrations/20261009000000_init.sql ============
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

-- ============ seed.sql ============
-- Starting data: the 2027 books, prices from the conference, and app settings.
-- Safe to run again; it updates instead of duplicating.

insert into public.books (id, kind, year, title_en, title_yo, status) values
  ('manual-2027',   'manual',   2027, 'Sunday School Manual',            'Ìwé Ẹ̀kọ́ Ọjọ́ Ìsinmi',                'draft'),
  ('daily-2027',    'daily',    2027, 'Daily Divine Bread',              'Oúnjẹ Ìyè Ojoojúmọ́',                 'draft'),
  ('children-2027', 'children', 2027, 'Children''s Sunday School Manual', 'Ìwé Ẹ̀kọ́ Ọjọ́ Ìsinmi fún Àwọn Ọmọdé', 'draft')
on conflict (id) do update set title_en = excluded.title_en, title_yo = excluded.title_yo;

insert into public.products (id, name_en, name_yo, price_kobo, book_ids, on_sale, sort) values
  ('manual-2027', 'Sunday School Manual', 'Ìwé Ẹ̀kọ́ Ọjọ́ Ìsinmi', 170000, array['manual-2027'],               false, 1),
  ('daily-2027',  'Daily Divine Bread',   'Oúnjẹ Ìyè Ojoojúmọ́',  280000, array['daily-2027'],                false, 2),
  ('both-2027',   'Both books',           'Ìwé méjèèjì',          450000, array['manual-2027','daily-2027'], false, 3)
on conflict (id) do update set price_kobo = excluded.price_kobo, book_ids = excluded.book_ids;

insert into public.settings (key, value, public) values
  ('support_whatsapp',     '"+2348134730499"', true),   -- help line shown in the app
  ('agent_whatsapp',       '"+2347062023748"', false),  -- WhatsApp Business number the payment agent runs on
  ('phone_moves_per_year', '2',                true),
  ('move_wait_days',       '7',                true),
  ('offline_days',         '90',               true),
  ('watermark',            'true',             true),
  ('block_screenshots',    'true',             true)
on conflict (key) do nothing;

-- ============ migrations/20261012000000_payment_channels.sql ============
-- Three ways to pay, all unlocking the same books:
--   web          : payment page in Chrome (Flutterwave checkout: card, transfer, USSD)
--   whatsapp     : the WhatsApp agent gives a one-time account number (Flutterwave dynamic account)
--   google_play  : Google Play billing inside the app
-- Plus 'admin' for a book unlocked by hand after a support check.

alter table public.payments
  add column channel text not null default 'web'
    check (channel in ('web', 'whatsapp', 'google_play', 'admin')),
  -- WhatsApp agent: the one-time account the member transfers to
  add column account_number     text,
  add column account_bank       text,
  add column account_expires_at timestamptz,
  -- Google Play: proof of purchase, checked with Google before unlocking
  add column play_order_id       text unique,
  add column play_purchase_token text unique;

-- Google Play sells each book as its own in-app product.
alter table public.products
  add column play_product_id text unique;   -- e.g. 'manual_2027', set up in Play Console

update public.products set play_product_id = 'manual_2027' where id = 'manual-2027';
update public.products set play_product_id = 'daily_2027'  where id = 'daily-2027';
update public.products set play_product_id = 'both_2027'   where id = 'both-2027';

-- The Children's Manual has arrived; it is no longer "coming soon".
update public.books set status = 'draft' where id = 'children-2027';

-- Children's lessons have a monthly theme and different sections, so they get their own table.
create table public.children_lessons (
  book_id    text not null references public.books(id) on delete cascade,
  n          int  not null,
  date       date not null,
  theme      jsonb not null,               -- { en, yo }
  en         jsonb not null,
  yo         jsonb not null,
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (book_id, n)
);
create trigger children_lessons_touch before update on public.children_lessons
  for each row execute function public.touch_updated_at();

alter table public.children_lessons enable row level security;
create policy "editors manage children lessons" on public.children_lessons for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "admins read children lessons" on public.children_lessons for select using (public.is_admin());

-- WhatsApp agent conversations, so support can see what the agent told a member.
create table public.whatsapp_chats (
  id          bigint generated always as identity primary key,
  wa_phone    text not null,                -- the member's WhatsApp number
  direction   text not null check (direction in ('in', 'out')),
  body        text not null,
  payment_id  uuid references public.payments(id),
  at          timestamptz not null default now()
);
create index whatsapp_chats_phone on public.whatsapp_chats(wa_phone, at desc);
alter table public.whatsapp_chats enable row level security;
create policy "support reads chats" on public.whatsapp_chats for select using (public.is_admin(array['owner','support']));

-- ============ migrations/20261014000000_admin.sql ============
-- Support for the admin dashboard.

-- 1. A public storage bucket for photos (Baba Aladura, founder). Anyone can view; only editors upload.
insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;

create policy "editors upload photos" on storage.objects for insert
  with check (bucket_id = 'public' and public.is_admin(array['owner','editor']));
create policy "editors replace photos" on storage.objects for update
  using (bucket_id = 'public' and public.is_admin(array['owner','editor']));
create policy "editors delete photos" on storage.objects for delete
  using (bucket_id = 'public' and public.is_admin(array['owner','editor']));

-- 2. Notices the app shows on its Home screen, and app-wide switches.
insert into public.settings (key, value, public) values
  ('home_notice',        '{"en": "", "yo": ""}', true),   -- empty = no banner
  ('maintenance',        '{"on": false, "en": "", "yo": ""}', true),
  ('min_app_version',    '"1.0.0"', true),                -- older apps are asked to update
  ('pay_google_play',    'true', true),
  ('pay_whatsapp',       'true', false),
  ('pay_web',            'true', false)
on conflict (key) do nothing;

-- 3. Numbers for the Overview page. Only admins get an answer.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  month_start timestamptz := date_trunc('month', now());
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  select jsonb_build_object(
    'members',          (select count(*) from profiles),
    'members_today',    (select count(*) from profiles where created_at >= date_trunc('day', now())),
    'month_kobo',       (select coalesce(sum(amount_kobo), 0) from payments where status = 'paid' and created_at >= month_start),
    'manual_owners',    (select count(*) from entitlements where book_id like 'manual-%'),
    'daily_owners',     (select count(*) from entitlements where book_id like 'daily-%'),
    'children_owners',  (select count(*) from entitlements where book_id like 'children-%'),
    'pending_old',      (select count(*) from payments where status = 'pending' and created_at < now() - interval '30 minutes' and created_at > now() - interval '7 days'),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', c) order by d), '[]'::jsonb)
      from (
        select gs as d, (select count(*) from payments p where p.status = 'paid' and p.created_at::date = gs::date) as c
        from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') gs
      ) t
    )
  ) into result;
  return result;
end $$;

-- 4. Members who used up their phone changes this year (possible account sharing).
create or replace view public.member_phone_moves as
  select user_id, count(*) filter (where link_kind = 'self_move' and linked_at >= date_trunc('year', now())) as moves_this_year
  from public.devices group by user_id;
alter view public.member_phone_moves set (security_invoker = true);

-- 5. Phones check this number to know when a book's content has changed and needs downloading again.
create or replace function public.bump_content_version(b text) returns void
language sql security definer set search_path = public as $$
  update books set content_version = content_version + 1, updated_at = now() where id = b;
$$;
revoke execute on function public.bump_content_version(text) from public, anon, authenticated;

-- 6. The Children's Manual has arrived, so it is a draft book now, not "coming soon".
update public.books set status = 'draft' where id = 'children-2027' and status = 'coming_soon';

-- 7. The Children's Manual as a product. The price is a placeholder until the conference gives one;
--    it stays off sale until an owner sets the real price in Settings and switches it on.
insert into public.products (id, name_en, name_yo, price_kobo, book_ids, on_sale, sort, play_product_id)
values ('children-2027', 'Children''s Sunday School Manual', 'Ìwé Ẹ̀kọ́ Ọjọ́ Ìsinmi fún Àwọn Ọmọdé', 100000, array['children-2027'], false, 4, 'children_2027')
on conflict (id) do nothing;

-- ============ migrations/20261023000000_app.sql ============
-- Server functions the phone app calls.
-- Members never read book tables directly. These functions check the account,
-- the phone and the purchase first, then hand back only what is allowed.

-- ============================================================
-- 1. Gifts only go to a phone number that has been confirmed by SMS.
--    (Until SMS login is switched on, members type their number by hand,
--    so a typed number must never be enough to collect someone's gift.)
-- ============================================================
create or replace function public.claim_gifts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is null then return new; end if;
  if not exists (
    select 1 from auth.users u
    where u.id = new.id and u.phone_confirmed_at is not null
      and '+' || ltrim(u.phone, '+') = new.phone
  ) then
    return new;
  end if;
  insert into entitlements (user_id, book_id, source, payment_id)
    select new.id, g.book_id, 'gift', g.payment_id
    from gifts g where g.phone = new.phone and g.claimed_by is null
  on conflict do nothing;
  update gifts set claimed_by = new.id, claimed_at = now()
    where phone = new.phone and claimed_by is null;
  return new;
end $$;

-- ============================================================
-- 2. Turn whatever the member typed into +234... form. Returns null if it is not a phone number.
-- ============================================================
create or replace function public.clean_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
begin
  if d ~ '^0[789][01][0-9]{8}$' then return '+234' || substr(d, 2); end if;  -- 08031234567
  if d ~ '^234[0-9]{10}$'       then return '+' || d; end if;                -- 2348031234567
  if d ~ '^\+[1-9][0-9]{9,14}$' then return d; end if;                       -- +2348031234567 or a foreign number
  return null;
end $$;

-- ============================================================
-- 3. Create or update the signed-in member's profile.
--    The phone number can be set once. After that only an admin can change it.
-- ============================================================
create or replace function public.app_save_profile(p_full_name text, p_phone text, p_parish text, p_language text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ph  text := public.clean_phone(p_phone);
  me  profiles;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'name_needed'; end if;
  if ph is null then raise exception 'phone_invalid'; end if;
  if p_language not in ('en', 'yo') then p_language := 'en'; end if;

  select * into me from profiles where id = uid;
  if found and me.phone is not null and me.phone <> ph then raise exception 'phone_locked'; end if;
  if exists (select 1 from profiles where phone = ph and id <> uid) then raise exception 'phone_taken'; end if;

  insert into profiles (id, full_name, phone, email, parish, language)
  values (uid, trim(p_full_name), ph, (select email from auth.users where id = uid), trim(coalesce(p_parish, '')), p_language)
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = coalesce(profiles.phone, excluded.phone),
        parish    = excluded.parish,
        language  = excluded.language
  returning * into me;

  return to_jsonb(me);
end $$;

-- ============================================================
-- 4. One phone per account.
--    The app calls this every time it opens with internet.
--    p_move = true means the member has agreed to move the account to this phone.
-- ============================================================
create or replace function public.app_device(p_install_id text, p_model text, p_platform text, p_move boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid        uuid := auth.uid();
  me         profiles;
  cur        devices;
  move_limit int  := coalesce((select (value #>> '{}')::int from settings where key = 'phone_moves_per_year'), 2);
  wait_days  int  := coalesce((select (value #>> '{}')::int from settings where key = 'move_wait_days'), 7);
  moves      int;
  can_move   boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if coalesce(p_install_id, '') = '' then raise exception 'no_install_id'; end if;
  if p_platform not in ('android', 'ios') then p_platform := 'android'; end if;

  select * into me from profiles where id = uid;
  if not found then return jsonb_build_object('state', 'no_profile'); end if;
  if me.status = 'frozen' then return jsonb_build_object('state', 'frozen'); end if;

  select * into cur from devices where user_id = uid and active;

  -- This phone is already the account's phone.
  if found and cur.install_id = p_install_id then
    update devices set last_seen_at = now(), model = coalesce(nullif(p_model, ''), model) where id = cur.id;
    return jsonb_build_object('state', 'ok');
  end if;

  -- No phone linked yet (new account, or an admin reset the phone).
  if not found then
    insert into devices (user_id, install_id, model, platform, link_kind)
    values (uid, p_install_id, coalesce(p_model, ''), p_platform,
            case when exists (select 1 from devices where user_id = uid) then 'admin_reset' else 'first' end);
    return jsonb_build_object('state', 'ok');
  end if;

  -- Another phone has the account.
  select count(*) into moves from devices
    where user_id = uid and link_kind = 'self_move' and linked_at >= date_trunc('year', now());
  can_move := moves < move_limit and cur.linked_at <= now() - make_interval(days => wait_days);

  if not p_move or not can_move then
    return jsonb_build_object(
      'state',      'other_phone',
      'other_model', cur.model,
      'moves_left', greatest(move_limit - moves, 0),
      'can_move',   can_move,
      'wait_until', cur.linked_at + make_interval(days => wait_days)
    );
  end if;

  update devices set active = false, unlinked_at = now(), unlinked_reason = 'Member moved to another phone'
    where id = cur.id;
  insert into devices (user_id, install_id, model, platform, link_kind)
    values (uid, p_install_id, coalesce(p_model, ''), p_platform, 'self_move');
  return jsonb_build_object('state', 'ok', 'moved', true);
end $$;

-- ============================================================
-- 5. The book list for the signed-in member: published books, plus any book they own
--    (so testers given a draft book by an admin can still see it).
-- ============================================================
create or replace function public.app_catalogue()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'year', b.year,
        'title_en', b.title_en, 'title_yo', b.title_yo,
        'status', b.status, 'version', b.content_version,
        'owned', exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
      ) order by b.year desc, case b.kind when 'manual' then 1 when 'daily' then 2 else 3 end)
      from books b
      where b.status = 'published'
         or exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_en', p.name_en, 'name_yo', p.name_yo,
        'price_kobo', p.price_kobo, 'book_ids', p.book_ids, 'play_product_id', p.play_product_id
      ) order by p.sort)
      from products p where p.on_sale
    ), '[]'::jsonb)
  );
$$;

-- ============================================================
-- 6. Download a whole book. Only for the owner, on the account's own phone.
-- ============================================================
create or replace function public.app_get_book(p_book text, p_install_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  b     books;
  items jsonb;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from profiles where id = uid and status = 'active') then raise exception 'account_frozen'; end if;
  if not exists (select 1 from devices where user_id = uid and active and install_id = p_install_id) then
    raise exception 'wrong_phone';
  end if;
  if not exists (select 1 from entitlements where user_id = uid and book_id = p_book) then raise exception 'not_owned'; end if;

  select * into b from books where id = p_book;
  if not found then raise exception 'no_book'; end if;

  if b.kind = 'manual' then
    select jsonb_agg(jsonb_build_object('n', n, 'date', date, 'review', review, 'en', en, 'yo', yo) order by n)
      into items from lessons where book_id = p_book and published;
  elsif b.kind = 'daily' then
    select jsonb_agg(jsonb_build_object('date', date, 'sunday', sunday, 'en', en, 'yo', yo) order by date)
      into items from readings where book_id = p_book and published;
  else
    select jsonb_agg(jsonb_build_object('n', n, 'date', date, 'theme', theme, 'en', en, 'yo', yo) order by n)
      into items from children_lessons where book_id = p_book and published;
  end if;

  return jsonb_build_object('id', b.id, 'kind', b.kind, 'version', b.content_version, 'items', coalesce(items, '[]'::jsonb));
end $$;

-- Only signed-in members may call these.
revoke execute on function public.app_save_profile(text, text, text, text) from public, anon;
revoke execute on function public.app_device(text, text, text, boolean)    from public, anon;
revoke execute on function public.app_catalogue()                           from public, anon;
revoke execute on function public.app_get_book(text, text)                  from public, anon;
grant  execute on function public.app_save_profile(text, text, text, text) to authenticated;
grant  execute on function public.app_device(text, text, text, boolean)    to authenticated;
grant  execute on function public.app_catalogue()                           to authenticated;
grant  execute on function public.app_get_book(text, text)                  to authenticated;

-- ============ migrations/20261024000000_features.sql ============
-- Update 4: book covers, district headquarters, welcome and about pages, notes and bookmarks.

-- 1. Each district has one headquarters church (like a state capital).
alter table public.churches add column if not exists is_hq boolean not null default false;
create unique index if not exists churches_one_hq_per_district on public.churches(district_id) where is_hq;

-- 2. A cover picture for each book (a file in the 'public' storage bucket).
alter table public.books add column if not exists cover_path text;

-- 3. The welcome page members see when the app opens, and the About page.
insert into public.settings (key, value, public) values
  ('welcome', jsonb_build_object(
     'en', 'Welcome to Ona Iwa Mimo. Read the Sunday School Manual and the Daily Divine Bread every day, and grow in the knowledge of God.',
     'yo', 'Ẹ káàbọ̀ sí Ona Iwa Mimo. Ẹ máa ka Ìwé Ẹ̀kọ́ Ọjọ́ Ìsinmi àti Oúnjẹ Ìyè Ojoojúmọ́ lójoojúmọ́, kí ẹ sì máa dàgbà nínú ìmọ̀ Ọlọ́run.',
     'verse_en', '', 'verse_yo', '', 'verse_ref', '', 'photo_path', ''), true),
  ('about', '{"en": "", "yo": ""}', true)
on conflict (key) do nothing;

-- 4. Members' own notes and bookmarks, kept with their account so a new phone gets them back.
create table if not exists public.member_notes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null references public.books(id) on delete cascade,
  item_key   text not null,                 -- lesson number or date
  kind       text not null check (kind in ('note', 'bookmark')),
  body       text not null default '',
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, item_key, kind)
);
alter table public.member_notes enable row level security;
create policy "members manage own notes" on public.member_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.member_notes to authenticated;

-- 5. The book list now includes the cover picture.
create or replace function public.app_catalogue()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'year', b.year,
        'title_en', b.title_en, 'title_yo', b.title_yo,
        'status', b.status, 'version', b.content_version, 'cover_path', b.cover_path,
        'owned', exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
      ) order by b.year desc, case b.kind when 'manual' then 1 when 'daily' then 2 else 3 end)
      from books b
      where b.status = 'published'
         or exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_en', p.name_en, 'name_yo', p.name_yo,
        'price_kobo', p.price_kobo, 'book_ids', p.book_ids, 'play_product_id', p.play_product_id
      ) order by p.sort)
      from products p where p.on_sale
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.app_catalogue() from public, anon;
grant  execute on function public.app_catalogue() to authenticated;

-- 6. The phone's details for the Settings page (linked since, changes left this year).
create or replace function public.app_phone_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'model',       (select model from devices where user_id = auth.uid() and active),
    'linked_at',   (select linked_at from devices where user_id = auth.uid() and active),
    'moves_used',  (select count(*) from devices where user_id = auth.uid() and link_kind = 'self_move'
                      and linked_at >= date_trunc('year', now())),
    'moves_limit', coalesce((select (value #>> '{}')::int from settings where key = 'phone_moves_per_year'), 2)
  );
$$;
revoke execute on function public.app_phone_info() from public, anon;
grant  execute on function public.app_phone_info() to authenticated;

-- ============ migrations/20261025000000_community.sql ============
-- Update 5: hymn book, prayer requests and testimonies, teacher registers,
-- push notifications, recorded audio, church map links.

-- ============================================================
-- 1. Teaching guides for the Children's Manual too.
--    (The guide used to be tied to the adult lessons table only.)
-- ============================================================
alter table public.teacher_guides drop constraint if exists teacher_guides_book_id_n_fkey;

-- ============================================================
-- 2. Church map links for directions.
-- ============================================================
alter table public.churches add column if not exists map_url text not null default '';

-- ============================================================
-- 3. The C&S Hymn Book (free for every signed-in member).
-- ============================================================
create table if not exists public.hymns (
  id         uuid primary key default gen_random_uuid(),
  number     int  not null unique,
  title_en   text not null default '',
  title_yo   text not null default '',
  text_en    text not null default '',   -- verses separated by an empty line
  text_yo    text not null default '',
  category   text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.hymns enable row level security;
create policy "members read hymns" on public.hymns for select using (auth.uid() is not null);
create policy "editors manage hymns" on public.hymns for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

-- ============================================================
-- 4. Prayer requests and testimonies sent to the church office.
--    Testimonies the office approves are shown to everyone in the app.
-- ============================================================
create table if not exists public.prayer_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('prayer', 'testimony')),
  body         text not null check (length(body) between 3 and 2000),
  display_name text not null default '',     -- empty = "A member"
  status       text not null default 'new' check (status in ('new', 'prayed', 'approved', 'hidden')),
  created_at   timestamptz not null default now()
);
create index if not exists prayer_requests_status on public.prayer_requests(status, created_at desc);
alter table public.prayer_requests enable row level security;
create policy "members send requests" on public.prayer_requests for insert
  with check (user_id = auth.uid() and status = 'new');
create policy "members see own and approved" on public.prayer_requests for select
  using (user_id = auth.uid() or (kind = 'testimony' and status = 'approved') or public.is_admin());
create policy "support manages requests" on public.prayer_requests for update
  using (public.is_admin(array['owner','support','editor'])) with check (public.is_admin(array['owner','support','editor']));
grant select, insert on public.prayer_requests to authenticated;

-- ============================================================
-- 5. Teacher class registers.
-- ============================================================
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_teacher and status = 'active');
$$;

create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  book_id    text references public.books(id),
  created_at timestamptz not null default now()
);
create table if not exists public.class_students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  name       text not null,
  phone      text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.attendance (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  date       date not null,
  present    boolean not null,
  primary key (student_id, date)
);
alter table public.classes        enable row level security;
alter table public.class_students enable row level security;
alter table public.attendance     enable row level security;

create policy "teachers manage own classes" on public.classes for all
  using (teacher_id = auth.uid() and public.is_teacher()) with check (teacher_id = auth.uid() and public.is_teacher());
create policy "admins read classes" on public.classes for select using (public.is_admin());

create policy "teachers manage own students" on public.class_students for all
  using (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()) and public.is_teacher())
  with check (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()) and public.is_teacher());
create policy "admins read students" on public.class_students for select using (public.is_admin());

create policy "teachers manage own attendance" on public.attendance for all
  using (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()) and public.is_teacher())
  with check (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()) and public.is_teacher());
create policy "admins read attendance" on public.attendance for select using (public.is_admin());

grant select, insert, update, delete on public.classes, public.class_students, public.attendance to authenticated;

-- ============================================================
-- 6. Phones that can receive push notifications (for messages from the office).
-- ============================================================
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "members manage own tokens" on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_tokens to authenticated;

-- ============================================================
-- 7. Recorded audio for lessons and daily readings.
--    The files sit in a private bucket; only owners of the book can play them.
-- ============================================================
insert into storage.buckets (id, name, public) values ('audio', 'audio', false)
on conflict (id) do nothing;

create table if not exists public.audio_tracks (
  book_id    text not null references public.books(id) on delete cascade,
  item_key   text not null,                 -- lesson number or date
  lang       text not null check (lang in ('en', 'yo')),
  path       text not null,                 -- file in the 'audio' bucket: <book>/<key>-<lang>.mp3
  reader     text not null default '',      -- who recorded it
  updated_at timestamptz not null default now(),
  primary key (book_id, item_key, lang)
);
alter table public.audio_tracks enable row level security;
create policy "owners see audio" on public.audio_tracks for select using (public.has_book(book_id) or public.is_admin());
create policy "editors manage audio" on public.audio_tracks for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));

create policy "owners play audio" on storage.objects for select
  using (bucket_id = 'audio' and (public.has_book((storage.foldername(name))[1]) or public.is_admin()));
create policy "editors upload audio" on storage.objects for insert
  with check (bucket_id = 'audio' and public.is_admin(array['owner','editor']));
create policy "editors replace audio" on storage.objects for update
  using (bucket_id = 'audio' and public.is_admin(array['owner','editor']));
create policy "editors delete audio" on storage.objects for delete
  using (bucket_id = 'audio' and public.is_admin(array['owner','editor']));

-- ============ migrations/20261103000000_directory_payments.sql ============
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

-- ============ migrations/20261114000000_launch.sql ============
-- Update 7: ready for Google Play.
-- English and Yoruba hymn book, the Church Constitution as a book for sale,
-- Baba Aladura and Conference Secretaries apart, private prayer and counselling
-- requests, social media links, account deletion, Google Play purchases and
-- the switch that ends the test APK.

-- ============================================================
-- 1. Hymn book: categories and Bible lines in both languages.
-- ============================================================
alter table public.hymns add column if not exists category_yo  text not null default '';
alter table public.hymns add column if not exists scripture_yo text not null default '';

-- ============================================================
-- 2. Leaders: Baba Aladura and Conference Secretaries in their own lists.
-- ============================================================
alter table public.baba_aladura add column if not exists role text not null default 'baba';
alter table public.baba_aladura drop constraint if exists baba_aladura_role_check;
alter table public.baba_aladura add constraint baba_aladura_role_check check (role in ('baba', 'secretary'));

-- ============================================================
-- 3. The Church Constitution: a book made of sections, in English and Yoruba.
-- ============================================================
alter table public.books drop constraint if exists books_kind_check;
alter table public.books add constraint books_kind_check check (kind in ('manual', 'daily', 'children', 'document'));

create table if not exists public.doc_sections (
  book_id    text not null references public.books(id) on delete cascade,
  lang       text not null check (lang in ('en', 'yo')),
  n          int  not null,
  title      text not null,
  body       jsonb not null default '[]'::jsonb,   -- [{t:'p'|'h'|'li', x:'...'}]
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (book_id, lang, n)
);
alter table public.doc_sections enable row level security;
drop policy if exists "editors manage sections" on public.doc_sections;
drop policy if exists "admins read sections" on public.doc_sections;
create policy "editors manage sections" on public.doc_sections for all
  using (public.is_admin(array['owner','editor'])) with check (public.is_admin(array['owner','editor']));
create policy "admins read sections" on public.doc_sections for select using (public.is_admin());

insert into public.books (id, kind, year, title_en, title_yo, status)
values ('constitution', 'document', 2026, 'Church Constitution', 'Òfin Ìjọ', 'draft')
on conflict (id) do nothing;

insert into public.products (id, name_en, name_yo, price_kobo, book_ids, on_sale, sort, play_product_id)
values ('constitution', 'Church Constitution', 'Òfin Ìjọ', 250000, array['constitution'], false, 5, 'constitution')
on conflict (id) do nothing;

-- The Google Play product for each item (the seed may have run after these were first set).
update public.products set play_product_id = 'manual_2027'   where id = 'manual-2027'   and play_product_id is null;
update public.products set play_product_id = 'daily_2027'    where id = 'daily-2027'    and play_product_id is null;
update public.products set play_product_id = 'both_2027'     where id = 'both-2027'     and play_product_id is null;
update public.products set play_product_id = 'children_2027' where id = 'children-2027' and play_product_id is null;
update public.products set price_kobo = 100000 where id = 'children-2027';

create or replace function public.app_get_book(p_book text, p_install_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  b     books;
  items jsonb;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from profiles where id = uid and status = 'active') then raise exception 'account_frozen'; end if;
  if not exists (select 1 from devices where user_id = uid and active and install_id = p_install_id) then
    raise exception 'wrong_phone';
  end if;
  if not exists (select 1 from entitlements where user_id = uid and book_id = p_book) then raise exception 'not_owned'; end if;

  select * into b from books where id = p_book;
  if not found then raise exception 'no_book'; end if;

  if b.kind = 'manual' then
    select jsonb_agg(jsonb_build_object('n', n, 'date', date, 'review', review, 'en', en, 'yo', yo) order by n)
      into items from lessons where book_id = p_book and published;
  elsif b.kind = 'daily' then
    select jsonb_agg(jsonb_build_object('date', date, 'sunday', sunday, 'en', en, 'yo', yo) order by date)
      into items from readings where book_id = p_book and published;
  elsif b.kind = 'document' then
    -- Each language has its own sections. Both language slots carry the same section
    -- so the reader on the phone works the same way as for the other books.
    select jsonb_agg(jsonb_build_object(
        'n', n, 'lang', lang, 'date', '',
        'en', jsonb_build_object('name', '', 'topic', title, 'text', '', 'body', body),
        'yo', jsonb_build_object('name', '', 'topic', title, 'text', '', 'body', body)
      ) order by lang, n)
      into items from doc_sections where book_id = p_book and published;
  else
    select jsonb_agg(jsonb_build_object('n', n, 'date', date, 'theme', theme, 'en', en, 'yo', yo) order by n)
      into items from children_lessons where book_id = p_book and published;
  end if;

  return jsonb_build_object('id', b.id, 'kind', b.kind, 'version', b.content_version, 'items', coalesce(items, '[]'::jsonb));
end $$;

create or replace function public.app_catalogue()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'year', b.year,
        'title_en', b.title_en, 'title_yo', b.title_yo,
        'status', b.status, 'version', b.content_version, 'cover_path', b.cover_path,
        'owned', exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
      ) order by case b.kind when 'document' then 1 else 0 end, b.year desc,
                 case b.kind when 'manual' then 1 when 'daily' then 2 when 'children' then 3 else 4 end)
      from books b
      where b.status = 'published'
         or exists (select 1 from entitlements e where e.user_id = auth.uid() and e.book_id = b.id)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_en', p.name_en, 'name_yo', p.name_yo,
        'price_kobo', p.price_kobo, 'book_ids', p.book_ids, 'play_product_id', p.play_product_id
      ) order by p.sort)
      from products p where p.on_sale
    ), '[]'::jsonb)
  );
$$;

-- ============================================================
-- 4. Prayer requests and counselling are private.
--    Only admins given permission can read them (for example the Chairman
--    of the Prophet Council). Testimonies stay public once approved.
-- ============================================================
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('owner', 'editor', 'support', 'reader'));
alter table public.admin_users add column if not exists reads_prayers    boolean not null default false;
alter table public.admin_users add column if not exists reads_counselling boolean not null default false;

alter table public.prayer_requests drop constraint if exists prayer_requests_kind_check;
alter table public.prayer_requests add constraint prayer_requests_kind_check check (kind in ('prayer', 'testimony', 'counselling'));
alter table public.prayer_requests add column if not exists topic text not null default '';   -- counselling: singles, married, other

create or replace function public.reads_private(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a where a.user_id = auth.uid()
      and ((k = 'prayer' and a.reads_prayers) or (k = 'counselling' and a.reads_counselling))
  );
$$;

drop policy if exists "members see own and approved" on public.prayer_requests;
create policy "members see own and approved" on public.prayer_requests for select using (
  user_id = auth.uid()
  or (kind = 'testimony' and (status = 'approved' or public.is_admin()))
  or (kind in ('prayer', 'counselling') and public.reads_private(kind))
);
drop policy if exists "support manages requests" on public.prayer_requests;
create policy "support manages requests" on public.prayer_requests for update using (
  (kind = 'testimony' and public.is_admin(array['owner','support','editor'])) or (kind <> 'testimony' and public.reads_private(kind))
) with check (
  (kind = 'testimony' and public.is_admin(array['owner','support','editor'])) or (kind <> 'testimony' and public.reads_private(kind))
);

-- ============================================================
-- 5. Deleting an account (Google Play requires this).
--    Payment records are kept for the accounts, without the person attached.
-- ============================================================
alter table public.payments drop constraint if exists payments_payer_id_fkey;
alter table public.payments add constraint payments_payer_id_fkey foreign key (payer_id) references public.profiles(id) on delete set null;
alter table public.gifts drop constraint if exists gifts_claimed_by_fkey;
alter table public.gifts add constraint gifts_claimed_by_fkey foreign key (claimed_by) references public.profiles(id) on delete set null;

create table if not exists public.account_deletions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                          -- no link: the account is gone
  phone       text not null default '',
  email       text not null default '',
  books       text[] not null default '{}',  -- what the account owned, in case of a payment question
  source      text not null check (source in ('app', 'web', 'admin')),
  status      text not null default 'done' check (status in ('requested', 'done', 'rejected')),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
alter table public.account_deletions enable row level security;
drop policy if exists "support reads deletions" on public.account_deletions;
create policy "support reads deletions" on public.account_deletions for select using (public.is_admin(array['owner','support']));

-- Called from the app: removes the member's account and everything linked to it.
create or replace function public.app_delete_account(p_confirm text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  me  profiles;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if upper(coalesce(p_confirm, '')) <> 'DELETE' then raise exception 'not_confirmed'; end if;
  select * into me from profiles where id = uid;
  insert into account_deletions (user_id, phone, email, books, source, status, done_at)
  values (uid, coalesce(me.phone, ''), coalesce(me.email, (select email from auth.users where id = uid), ''),
          coalesce((select array_agg(book_id) from entitlements where user_id = uid), '{}'), 'app', 'done', now());
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
  return jsonb_build_object('deleted', true);
end $$;
revoke execute on function public.app_delete_account(text) from public, anon;
grant  execute on function public.app_delete_account(text) to authenticated;

-- ============================================================
-- 6. Which app each phone uses, and the switch that ends the test APK.
-- ============================================================
alter table public.devices add column if not exists app_version text not null default '';
alter table public.devices add column if not exists channel     text not null default '';

drop function if exists public.app_device(text, text, text, boolean);
create or replace function public.app_device(
  p_install_id text, p_model text, p_platform text, p_move boolean default false,
  p_version text default null, p_channel text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid        uuid := auth.uid();
  me         profiles;
  cur        devices;
  move_limit int  := coalesce((select (value #>> '{}')::int from settings where key = 'phone_moves_per_year'), 2);
  wait_days  int  := coalesce((select (value #>> '{}')::int from settings where key = 'move_wait_days'), 7);
  pilot_open boolean := coalesce((select (value #>> '{}')::boolean from settings where key = 'pilot_open'), true);
  moves      int;
  can_move   boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if coalesce(p_install_id, '') = '' then raise exception 'no_install_id'; end if;
  if p_platform not in ('android', 'ios') then p_platform := 'android'; end if;

  -- Test APKs stop working when the test is over. The first test APKs did not say
  -- which kind of app they are, so they count as test APKs.
  if not pilot_open and coalesce(p_channel, 'pilot') <> 'play' then
    if p_channel is null then raise exception 'test_ended'; end if;
    return jsonb_build_object('state', 'test_ended',
      'play_url', coalesce((select value #>> '{}' from settings where key = 'play_url'), ''));
  end if;

  select * into me from profiles where id = uid;
  if not found then return jsonb_build_object('state', 'no_profile'); end if;
  if me.status = 'frozen' then return jsonb_build_object('state', 'frozen'); end if;

  select * into cur from devices where user_id = uid and active;

  if found and cur.install_id = p_install_id then
    update devices set last_seen_at = now(), model = coalesce(nullif(p_model, ''), model),
      app_version = coalesce(p_version, app_version), channel = coalesce(p_channel, channel)
      where id = cur.id;
    return jsonb_build_object('state', 'ok');
  end if;

  if not found then
    insert into devices (user_id, install_id, model, platform, link_kind, app_version, channel)
    values (uid, p_install_id, coalesce(p_model, ''), p_platform,
            case when exists (select 1 from devices where user_id = uid) then 'admin_reset' else 'first' end,
            coalesce(p_version, ''), coalesce(p_channel, ''));
    return jsonb_build_object('state', 'ok');
  end if;

  select count(*) into moves from devices
    where user_id = uid and link_kind = 'self_move' and linked_at >= date_trunc('year', now());
  can_move := moves < move_limit and cur.linked_at <= now() - make_interval(days => wait_days);

  if not p_move or not can_move then
    return jsonb_build_object(
      'state',      'other_phone',
      'other_model', cur.model,
      'moves_left', greatest(move_limit - moves, 0),
      'can_move',   can_move,
      'wait_until', cur.linked_at + make_interval(days => wait_days)
    );
  end if;

  update devices set active = false, unlinked_at = now(), unlinked_reason = 'Member moved to another phone'
    where id = cur.id;
  insert into devices (user_id, install_id, model, platform, link_kind, app_version, channel)
    values (uid, p_install_id, coalesce(p_model, ''), p_platform, 'self_move', coalesce(p_version, ''), coalesce(p_channel, ''));
  return jsonb_build_object('state', 'ok', 'moved', true);
end $$;
revoke execute on function public.app_device(text, text, text, boolean, text, text) from public, anon;
grant  execute on function public.app_device(text, text, text, boolean, text, text) to authenticated;

-- ============================================================
-- 7. Google Play: the service account key lives here, readable only by the server.
-- ============================================================
create table if not exists public.server_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.server_secrets enable row level security;   -- no policies: only the server key can read it
revoke all on public.server_secrets from anon, authenticated;

-- ============================================================
-- 8. Settings for this update.
-- ============================================================
insert into public.settings (key, value, public) values
  ('pilot_open',     'true', true),
  ('play_url',       '"https://play.google.com/store/apps/details?id=com.onaiwamimo.app"', true),
  ('contact_email',  '""', true),
  ('counselling_on', 'true', true),
  ('social_links', '[
     {"kind": "linktree",  "url": "https://tr.ee/7my49Ths5f"},
     {"kind": "facebook",  "url": "https://www.facebook.com/onaiwamimomultimediaunit"},
     {"kind": "telegram",  "url": "https://t.me/oimcsmultimedia"},
     {"kind": "youtube",   "url": "https://youtube.com/@onaiwamimocsmultimedia8746"},
     {"kind": "tiktok",    "url": "https://vm.tiktok.com/ZS9fqqmJcXnSj-DDdOB/"}
   ]', true)
on conflict (key) do nothing;

-- A first short story about the church for the About page. The office can change it in Settings.
update public.settings set value = jsonb_build_object(
  'en', E'Ona Iwa Mimo Cherubim and Seraphim Church of Nigeria and Overseas was founded by St. J.O. Adeola (GCOM), who received his calling from God on 12 December 1938. That day is remembered every year as OIM Day.\n\nThe church takes its name and motto from Isaiah 35:8: "And an highway shall be there, and a way, and it shall be called The way of holiness."\n\nThe National Headquarters is at Temple Obaago, Igboho, Oyo State, the seat of the President of the church, the Baba Aladura. Members come together there every year for the National Conference in June and for the pilgrimage on the holy mountain from 26 to 29 October.\n\nToday the church has districts, annexes and parishes across Nigeria and overseas, worshipping God in white garments, in prayer, and in the teaching of the Lord Jesus Christ and the Holy Bible.',
  'yo', E'Ẹni Ọ̀wọ̀ J.O. Adéọlá (GCOM) ló dá Ìjọ Ọ̀nà Ìwà Mímọ́ Kérúbù àti Séráfù ti Nàìjíríà àti Òkè-Òkun sílẹ̀. Ọlọ́run pè é ní ọjọ́ kejìlá oṣù kejìlá ọdún 1938. A máa ń ṣe ìrántí ọjọ́ náà lọ́dọọdún gẹ́gẹ́ bí Ọjọ́ OIM.\n\nOrúkọ àti ọ̀rọ̀ ìjọ wá láti Aísáyà 35:8: "Òpópó kan yóò sì wà níbẹ̀, àti ọ̀nà kan, a ó sì máa pè é ní Ọ̀nà Ìwà Mímọ́."\n\nOlú Ìjọ wà ní Temple Obaago, Igboho, Ìpínlẹ̀ Ọ̀yọ́, níbi ìjókòó Ààrẹ ìjọ, Bàbá Aládùúrà. Àwọn ọmọ ìjọ máa ń péjọ síbẹ̀ lọ́dọọdún fún Àpérò Àjọ Ńlá ní oṣù kẹfà, àti fún ìrìn àjò sí orí òkè mímọ́ láti ọjọ́ 26 sí 29 oṣù kẹwàá.\n\nLónìí, ìjọ ní àwọn ẹkùn, ìsọ̀ngbè àti ìjọ káàkiri Nàìjíríà àti òkè-òkun, tí ń sin Ọlọ́run nínú aṣọ funfun, nínú àdúrà, àti nínú ẹ̀kọ́ Olúwa Jésù Krístì àti Bíbélì Mímọ́.')
where key = 'about' and coalesce(value->>'en', '') = '';

-- ============================================================
-- 9. Overview numbers for the admin.
-- ============================================================
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  month_start timestamptz := date_trunc('month', now());
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  select jsonb_build_object(
    'members',          (select count(*) from profiles),
    'members_today',    (select count(*) from profiles where created_at >= date_trunc('day', now())),
    'month_kobo',       (select coalesce(sum(amount_kobo), 0) from payments where status = 'paid' and created_at >= month_start),
    'manual_owners',    (select count(*) from entitlements where book_id like 'manual-%'),
    'daily_owners',     (select count(*) from entitlements where book_id like 'daily-%'),
    'children_owners',  (select count(*) from entitlements where book_id like 'children-%'),
    'constitution_owners', (select count(*) from entitlements where book_id = 'constitution'),
    'test_unlocks',     (select count(*) from entitlements where source = 'admin'),
    'test_phones',      (select count(*) from devices where active and channel <> 'play'),
    'pending_old',      (select count(*) from payments where status = 'pending' and created_at < now() - interval '30 minutes' and created_at > now() - interval '7 days'),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', c) order by d), '[]'::jsonb)
      from (
        select gs as d, (select count(*) from payments p where p.status = 'paid' and p.created_at::date = gs::date) as c
        from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') gs
      ) t
    )
  ) into result;
  return result;
end $$;
