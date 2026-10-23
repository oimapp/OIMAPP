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
