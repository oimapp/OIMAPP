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
