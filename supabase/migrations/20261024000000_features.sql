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
