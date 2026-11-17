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
