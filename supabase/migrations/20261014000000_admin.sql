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
