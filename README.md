# Ona Iwa Mimo

The app for the Cherubim and Seraphim Church (Ona Iwa Mimo) 2027 Sunday School Manual and Daily Divine Bread, in English and Yoruba.

## What is in this folder

| Folder | What it holds |
| --- | --- |
| `content/source/` | The conference's Word files. Put the six `.docx` files here (adult manual, Daily Divine Bread and Children's Manual, each in English and Yoruba). They are never uploaded to GitHub. |
| `content/corrections.json` | Fixes applied on top of the Word files, with a note of why. |
| `content/out/` | Clean book content made by the importer, plus `report.md` listing anything that looks wrong. |
| `scripts/` | The importer that reads the Word files. |
| `supabase/migrations/` | The database design: tables and security rules. |
| `supabase/seed.sql` | The 2027 books, prices and app settings. |
| `admin/` | The admin dashboard website (Next.js). Runs on Netlify. |
| `mobile/` | The Android (and later iPhone) app, built with Expo. |
| `docs/STEPS.md` | The step-by-step build guide. Start here. |

Google Play billing is in (Play builds only). Still to come: phone number sign-in by SMS.

The payment page lives at `/pay` on the admin site. The WhatsApp agent and the Flutterwave confirmations come in at `/api/whatsapp` and `/api/flutterwave`.

## Run the importer (Windows, Command Prompt)

```
cd C:\dev\ona-iwa-mimo
npm install
npm run import
```

Then open `content\out\report.md`.

## Rules for this project

- Money is stored in kobo: ₦1,700 is `170000`.
- Secrets (keys, passwords) live only in `.env` files, never in the code and never on GitHub.
- No em dashes in anything members read.

## Bible texts in the app

- English: King James Version, public domain (eBible.org, via the BibleNLP/ebible corpus).
- Yoruba: Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní, Copyright © 2017 Biblica, Inc., used under the Creative Commons Attribution-ShareAlike 4.0 licence. The original work by Biblica, Inc. is available for free at www.biblica.com and open.bible. The credit is shown on the Bible page in the app and must stay there.


## Directory and hymn book

- `content/out/directory-2027.json` comes from the conference's 2027 meetings book: districts, annexes, officers, churches, the National Executive Council and the special days. Upload with `npm run upload-directory`.
- `content/out/hymns-2026.json` is the hymn book from the conference's 2026 English and Yoruba Word files: 866 hymns and 45 Kneeling Songs in both languages. The 49 Ìsọjí songs (Yoruba only) still come from `content/out/hymns-yo.json`. Upload with `npm run upload-hymns`.
- `content/out/constitution.json` is the Church Constitution (English) and Òfin (Yoruba). Upload with `npm run upload-constitution`. It is sold as a book (₦2,500).
- Public pages on the admin site: `/` (welcome, for visitors who are not signed in), `/privacy`, `/delete-account`. Google Play purchases are checked at `/api/play`.
- The hymn book says: © C&S Unification Church of Nigeria, all rights reserved, no copy without written permission of the Publication Board, C&S National Conference. Keep that written permission on file before the app goes to Play.
