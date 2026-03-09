# CA Client Tracker — Deployment Guide

Follow these steps in order. Each step takes 5–10 minutes. Total setup time: ~30 minutes.

---

## STEP 1 — Set up Supabase (your database)

1. Go to https://supabase.com and click **Start your project** (free account).
2. Create a new project. Give it a name like `ca-tracker`. Choose a strong database password and save it.
3. Wait ~2 minutes for the project to be ready.

### Create the database table

4. In the left sidebar, click **SQL Editor**.
5. Paste and run this SQL:

```sql
create table clients (
  id    uuid primary key default gen_random_uuid(),
  data  jsonb not null default '{}'::jsonb
);

-- Allow any logged-in user to read/write all clients
alter table clients enable row level security;

create policy "Authenticated users can do everything"
  on clients
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

6. Click **Run**. You should see "Success. No rows returned."

### Get your API keys

7. In the left sidebar, go to **Project Settings → API**.
8. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public** key (long string starting with `eyJ...`)

---

## STEP 2 — Set up the code

1. Install Node.js from https://nodejs.org (download the LTS version).

2. Download or unzip the `ca-tracker` project folder to your computer.

3. Open a terminal (Command Prompt on Windows, Terminal on Mac) and navigate to the folder:
```
cd path/to/ca-tracker
```

4. Install dependencies:
```
npm install
```

5. Create your environment file. In the `ca-tracker` folder, create a file called `.env.local` and paste:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
Replace the values with what you copied in Step 1.

6. Test it locally:
```
npm run dev
```
Open http://localhost:5173 in your browser. You should see the login screen.

---

## STEP 3 — Create staff accounts

Staff accounts are created through Supabase (not the app itself), so you control who gets access.

1. In Supabase, go to **Authentication → Users**.
2. Click **Invite user** and enter the email address of each staff member.
3. They will receive an email to set their password.
4. Repeat for each person who needs access.

To remove someone's access later: go to Authentication → Users → find the user → Delete.

---

## STEP 4 — Deploy to the internet (Vercel)

This makes the app accessible from any device anywhere.

1. Create a free account at https://github.com and push your `ca-tracker` folder as a new repository.
   - In GitHub, click **New repository**, name it `ca-tracker`, and follow the instructions to push your local folder.

2. Go to https://vercel.com and sign in with your GitHub account.

3. Click **Add New Project** → select your `ca-tracker` repository → click **Deploy**.

4. Before deploying, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

5. Click **Deploy**. In 1–2 minutes, Vercel gives you a URL like `ca-tracker-yourname.vercel.app`.

6. Share this URL with your staff. Bookmark it on all devices.

---

## STEP 5 — Custom domain (optional)

If you want a URL like `tracker.yourfirmname.com` instead of a Vercel URL:

1. Buy a domain from GoDaddy, Namecheap, or Google Domains (~₹800/year for a `.com`).
2. In Vercel → your project → **Settings → Domains**, add your domain.
3. Vercel will give you DNS records to add at your domain registrar.

---

## Summary of free services used

| Service  | What it does             | Cost          |
|----------|--------------------------|---------------|
| Supabase | Database + authentication | Free (up to 50,000 rows) |
| Vercel   | Hosting the web app       | Free          |
| GitHub   | Storing your code         | Free          |

The free tiers are more than sufficient for a firm with 10–30 clients.

---

## Ongoing maintenance

- **Adding staff**: Supabase → Authentication → Invite user
- **Removing staff**: Supabase → Authentication → Users → Delete
- **Data backup**: Supabase → Database → Backups (free tier has daily backups)
- **Updating the app**: Edit code locally → `git push` to GitHub → Vercel auto-redeploys

---

## Need help?

If you get stuck at any step, the most common issues are:

- **"Invalid API key"**: Double-check your `.env.local` file has no extra spaces
- **"Failed to fetch"**: Make sure your Supabase URL is correct and the project is active
- **Login not working**: Check Authentication → Users in Supabase and confirm the user's email is verified
