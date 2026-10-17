# ShopTill

Sales and stock for a small shop. Works offline. Free to host.

## What is in this folder
- `index.html`, `css/app.css`, `js/app.js`: the app (no build step, no installs)
- `manifest.webmanifest`, `sw.js`, `icons/`: make it installable and work offline
- `js/config.js`, `js/sync.js`, `supabase/`, `.github/`: optional cloud sync (see "Cloud sync" below)
- `tests/`: automatic checks (optional, needs Node.js)

## Put it online for free (about 10 minutes, GitHub Pages)
1. Create a free account at github.com and a new **public** repository named `shoptill`.
2. Upload everything in this folder (keep the folders `css`, `js`, `icons`).
3. In the repository: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
4. After a minute your shop address appears: `https://YOUR-NAME.github.io/shoptill/`.

## Install on the shop laptop
1. Open that address in **Chrome or Edge** on the laptop, once, while online.
2. Click the install icon in the address bar (or menu > **Install ShopTill**).
3. From then on, open ShopTill from the desktop or Start menu. It works with no internet.

## First day
1. Type the shop name and tap **Start**.
2. In **Stock**, type an item name. If it does not exist, fill in the form once: name, **your own description** (type, size, model, colour or quality), prices and quantity.
3. Next delivery: search the item, type the quantity, tap **Add stock**.
4. Have a list already? **Settings > Import items from Excel** (save the sheet as CSV).

## Updating the app
Replace the files in the repository. The laptop gets the new version the next time it opens with internet.

## Important: backups
Until cloud sync is added, all data lives on the laptop. In **Settings** tap **Download backup** every week and keep the file on a flash disk or email it to yourself. The app reminds you after 7 days.


## Cloud sync (free): backup in the cloud and reports on your phone
The app works without this. Add it when you are ready. Everything here is free (Supabase free plan, 500 MB).

1. Create a free account at supabase.com and a **New project** (pick the region nearest to Kenya, set a database password and keep it safe).
2. **SQL Editor > New query**: paste `supabase/schema.sql`, press **Run**.
3. **Authentication > Users > Add user > Create new user** (tick **Auto Confirm User**). Create two accounts: one for the shop **owner** (the laptop) and one for the **viewer** (your phone).
4. **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up", so nobody else can create an account.
5. **SQL Editor**: open `supabase/setup.sql`, replace the two example emails with the two you created, **Run**.
6. **Project Settings > API Keys**: copy the **Project URL** and the **Publishable key** (`sb_publishable_...`) into `js/config.js`, then upload the changed file to GitHub. If you only see an old `anon` key, click **Create new API keys** first (Supabase is retiring `anon` by the end of 2026). These two values are meant to be public. Never put the **secret** key, the `service_role` key or the database password in any file.
7. **Keep the free project awake**: in the GitHub repository go to **Settings > Secrets and variables > Actions** and add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The included workflow pings the database every 3 days. Supabase pauses free projects after a week of no activity.
8. **Laptop**: open the app, **Settings > Cloud sync**, sign in with the owner account. Items and sales upload by themselves whenever there is internet, and wait safely when there is none.
9. **Your phone**: open the site, tap **Start**, then **Settings > Cloud sync** and sign in with the viewer account. You get Reports and Stock, read only, refreshed every minute.

Safety rules built in: a second device never overwrites the cloud without you typing REPLACE; the viewer account cannot change anything (the database refuses it); a new laptop can copy everything back with **Restore from cloud** (type RESTORE).
The free plan has no automatic database backups, so keep downloading the weekly backup from Settings.

## Run the tests (optional)
```
cd tests && npm install && node run-tests.js && node sync-tests.js
```
`sync-tests.js` runs against a small simulated Supabase. `BACKEND=real node sync-tests.js` runs the same tests against a real PostgreSQL + PostgREST built from `supabase/schema.sql` (developer use; see `tests/real-backend.js`). Neither runs against supabase.com itself.
