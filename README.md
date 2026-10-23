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
| `docs/STEPS.md` | The step-by-step build guide. Start here. |

Still to come: `mobile/` (the Android and iPhone app), the payment page and the WhatsApp agent.

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
