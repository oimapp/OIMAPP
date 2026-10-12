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
Create the Supabase project, load the database design, and connect the importer. Detailed steps come when Stage 1 is done.

## Stage 3: Admin website (Netlify)

## Stage 4: Android app

## Stage 5: Community test

## Stage 6: Google Play
