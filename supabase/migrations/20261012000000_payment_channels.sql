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
