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
