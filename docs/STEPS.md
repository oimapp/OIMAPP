# Build steps

We do these in order. Tick each one when it is done. Claude writes the code; you do the steps that need your accounts, your money or your computer.

## Stage 1: Get set up

All commands are typed in **Command Prompt** (press the Windows key, type `cmd`, press Enter), not inside VS Code. VS Code is only for opening and reading files.

### 1.1 Tools on your computer
- [x] Node.js (LTS) installed
- [x] Git installed

### 1.2 Project on GitHub
- [x] Private repository created: github.com/adura549/ona-iwa-mimo

### 1.3 Put the starter code on GitHub (from the zip)
1. Download `ona-iwa-mimo-starter.zip` from the chat.
2. Make the folder `C:\dev` if you don't have it. Unzip the file there, so you end up with `C:\dev\ona-iwa-mimo` (inside it you should see `README.md`, `package.json`, `scripts`, `supabase`...).
   If Windows unzips it as `C:\dev\ona-iwa-mimo\ona-iwa-mimo`, move the inner folder up one level.
3. In Command Prompt, type these one line at a time, pressing Enter after each:
   ```
   cd C:\dev\ona-iwa-mimo
   git status
   ```
   It should say `On branch main` and `nothing to commit, working tree clean`. If it says "not a git repository", the hidden `.git` folder was lost while unzipping: tell Claude.
4. Connect the folder to your GitHub project and upload it:
   ```
   git remote add origin https://github.com/adura549/ona-iwa-mimo.git
   git push -u origin main
   ```
   The first time, a GitHub sign-in window opens. Sign in as **adura549** and click **Authorize**.
5. Refresh github.com/adura549/ona-iwa-mimo in your browser. You should see the files and 3 commits.

- [ ] Code is on GitHub

### 1.4 Run the importer on your computer
1. Copy the six Word files (adult manual, Daily Divine Bread and Children's Manual, English and Yoruba) into `C:\dev\ona-iwa-mimo\content\source`.
2. In Command Prompt:
   ```
   cd C:\dev\ona-iwa-mimo
   npm install
   npm run import
   ```
   `npm install` takes a minute the first time and may print some warnings. That is normal.
3. It should end with `Done. 52 lessons, 365 days, 52 children's lessons.` and `12 things to check.`
4. Open `C:\dev\ona-iwa-mimo\content\out\report.md` in VS Code to read it. Send Claude a screenshot of the Command Prompt window either way.

- [ ] Importer runs on your computer

### 1.5 Open a personal Google Play developer account ($25, once)
Do this now: identity checks take a few days, and the account must exist before the community test.
1. On your computer, go to play.google.com/console and sign in with the Google account you want to own the app. Use one you will keep for years; it cannot be changed later.
2. Choose **Yourself** (personal account), not an organisation.
3. Developer name: this is shown on the Play Store under the app. Use a name the church will recognise, for example `Christotec Digital`. Your legal name is checked privately.
4. Pay the $25 registration fee with a card that works for international payments.
5. Complete identity verification with a government ID (NIN slip, international passport or driver's licence). The name must match the card and the account.
6. When asked, verify that you have an Android phone: install the **Google Play Console** app on your Android phone and sign in with the same account.
7. Tell Claude when the account shows as verified.

Because this is a new personal account, Google requires a **closed test with at least 12 testers who stay opted in for 14 days in a row** before the app can go public. Our community test does this. Start collecting now: the Gmail addresses of 20 to 25 members who will test (more than 12, in case some drop out).

- [ ] Play developer account opened and verified
- [ ] List of 20 to 25 tester Gmail addresses

## Stage 2: Backend (Supabase)
- [x] Supabase project `ona-iwa-mimo` created (West EU, London)
- [x] Tables created (init, payment_channels, seed)
- [x] `.env` file made with SUPABASE_URL and SUPABASE_SECRET_KEY
- [x] Books uploaded with `npm run upload`

## Stage 3: Admin dashboard

### 3.1 Run the new database file
1. In VS Code open `supabase/migrations/20261014000000_admin.sql`, press Ctrl + A, then Ctrl + C.
2. In Supabase: SQL Editor, New query, paste with Ctrl + V, click Run. You should see `Success`.

### 3.2 Create your admin login
1. In Supabase, click **Authentication** (the people icon) on the left, then **Users**.
2. Click **Add user**, then **Create new user**.
3. Type your email and a strong password. Tick **Auto Confirm User**. Click **Create user**.
4. Go to SQL Editor, New query, paste this (put your own email), and click Run:
   ```
   insert into admin_users (user_id, name, role)
   select id, 'Christotec', 'owner' from auth.users where email = 'YOUR-EMAIL-HERE';
   ```
   You should see `Success. 1 rows affected` (or similar).

### 3.3 Try the admin on your laptop first
1. In Supabase: Project Settings, API Keys. Copy the **Publishable key** (starts with `sb_publishable_`).
2. In VS Code, inside the `admin` folder, make a new file called `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your project URL (same as in the main .env)
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_... (same as in the main .env)
   FLUTTERWAVE_SECRET_KEY=
   ```
3. In Command Prompt:
   ```
   cd C:\dev\ona-iwa-mimo\admin
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 in your browser and sign in with the email and password from 3.2.
5. To stop it, click the Command Prompt window and press Ctrl + C, then type Y and Enter.

### 3.4 Put the admin online with Netlify
1. Save to GitHub first (Command Prompt, in `C:\dev\ona-iwa-mimo`): `git add -A`, `git commit -m "Admin dashboard"`, `git push`.
2. Go to app.netlify.com and sign in with GitHub.
3. Click **Add new site**, then **Import an existing project**, then **GitHub**.
4. If ona-iwa-mimo is not in the list, click **Configure the Netlify app on GitHub** and allow it.
5. Choose **ona-iwa-mimo**. Fill in:
   - Base directory: `admin`
   - Build command: `npm run build`
   - Publish directory: `admin/.next`
6. Click **Add environment variables** and add the same four values as `.env.local`. For SUPABASE_SECRET_KEY and FLUTTERWAVE_SECRET_KEY, tick **Contains secret values**.
7. Click **Deploy**. Wait 2 to 4 minutes. Open the link Netlify gives you and sign in.

- [ ] Admin works on the laptop
- [ ] Admin is online on Netlify

## Stage 4: Android app

## Stage 5: Community test

## Stage 6: Google Play
