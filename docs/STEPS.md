# Build steps

We do these in order. Tick each one when it is done. Claude writes the code; you do the steps that need your accounts, your money or your computer.

## Stage 1: Get set up

### 1.1 Apply for a D-U-N-S number (free, can take up to 30 days)
Google Play asks for this before it opens an account in a business name. Start it now because it is slow.
1. Find your business registration certificate (CAC). You need the exact business name, address and phone number on it.
2. Go to dnb.com and choose the free option to get a D-U-N-S number.
3. Type the name, address and phone **exactly** as on the certificate. Google compares them later and rejects mismatches.
4. Save the confirmation email. Tell Claude the date you applied.

- [ ] Applied for D-U-N-S on: ______

### 1.2 Install the tools on your computer
1. Install **Node.js**: go to nodejs.org, download the version marked **LTS**, run the installer, keep all the default choices.
2. Install **Git**: go to git-scm.com, download for Windows, run the installer, keep the default choices.
3. Close any open Command Prompt windows. Open a new one (press the Windows key, type `cmd`, press Enter).
4. Type each line below and press Enter after each:
   ```
   node -v
   npm -v
   git --version
   ```
   Each should print a version number. Send Claude what they print.

- [ ] Node.js installed (version: ______)
- [ ] Git installed (version: ______)

### 1.3 Create the project on GitHub
1. Sign in at github.com.
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `ona-iwa-mimo`
4. Choose **Private**. This matters: the code is the church's.
5. Leave "Add a README" and the other boxes **unticked**.
6. Click **Create repository**.
7. Tell Claude it is done and which GitHub account you used. Claude then puts the starter code in it.

- [ ] Repository created at github.com/______/ona-iwa-mimo

### 1.4 Download the project and run the importer
Do this after Claude says the code is on GitHub.
1. In Command Prompt:
   ```
   mkdir C:\dev
   cd C:\dev
   git clone https://github.com/YOUR-ACCOUNT/ona-iwa-mimo.git
   cd ona-iwa-mimo
   ```
2. Copy the six Word files (adult manual, Daily Divine Bread and Children's Manual, English and Yoruba) into `C:\dev\ona-iwa-mimo\content\source`.
3. In Command Prompt:
   ```
   npm install
   npm run import
   ```
4. It should say `Done. 52 lessons, 365 days, 52 children's lessons.` Open `content\out\report.md` in VS Code and read it.

- [ ] Importer runs on your computer

## Stage 2: Backend (Supabase)
Create the Supabase project, load the database design, and connect the importer. Detailed steps come when Stage 1 is done.

## Stage 3: Admin website (Netlify)

## Stage 4: Android app

## Stage 5: Community test

## Stage 6: Google Play
