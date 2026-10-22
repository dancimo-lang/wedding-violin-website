# Daniel Cimo Violin - Booking System Setup

This guide is for putting the private booking admin on the existing website. The public pages do not change. The live site still deploys from the `main` branch. Do not merge this work into `main`, and do not point the live Vercel project at it, until the steps below are done.

## What you need

- The Supabase project already used for this booking system
- The Resend account already used for contact emails
- Access to the Vercel project, when you are ready to deploy this branch

## 1. Add the secret keys

Create a file named `.env.local` in the project folder. Copy `.env.example` and fill in the real values. `.env.local` is ignored by git. Do not commit it.

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
CONTACT_EMAIL=dancimo@gmail.com

BLOB_READ_WRITE_TOKEN=your-blob-token
```

In Supabase, open **Project Settings → API**.

- The project URL and the `anon` `public` key go in the two `NEXT_PUBLIC_` lines. Those are safe to use in the browser.
- The `service_role` `secret` key goes in `SUPABASE_SERVICE_ROLE_KEY`. This key can read and change every row, so it must stay on the server. Never put it in a `NEXT_PUBLIC_` variable, in the website code, or in an email.

## 2. Update the database

Open the Supabase **SQL Editor** and run the migration files in this order, if you have not already:

1. `supabase/migrations/001_initial_schema.sql` — creates the booking tables. Skip this if those tables already exist.
2. `supabase/migrations/002_rls_policies.sql` — the first version of the permissions. Skip this if you already ran it.
3. `supabase/migrations/003_admin_only_access.sql` — **run this now.** It replaces the old rule that let any signed-in person read client records. After this file, only people on the admin list can see or change clients, leads, bookings, notes, and the other private tables.

The public contact form still works. It saves inquiries through the server, using the service role key, which never goes to the browser.

## 3. Create your login and add yourself as the only admin

1. In Supabase, open **Authentication → Users**.
2. Click **Add user** and create the account you will use to sign in. Use your own email and a long password. Turn on **Auto Confirm User** if that choice is shown.
3. If that email is `dancimo@gmail.com`, migration 003 tries to add the account for you. If you created the user *after* running the migration, or you use a different email, open the SQL Editor and run this, with your real email:

```sql
INSERT INTO public.admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE lower(email) = lower('dancimo@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
```

4. Check the result in **Table Editor → admins**. There should be one row, and it should be you.

Signing in is not enough by itself. A Supabase account that is not in the `admins` table cannot open `/admin` and cannot read client records.

## 4. Turn off public sign-up

The admin list is the real lock, but visitors should not be able to create accounts on your project.

1. In Supabase, open **Authentication → Sign In / Providers** (sometimes labeled **Providers**).
2. Open **Email**.
3. Turn **off** “Allow new users to sign up” (the wording may be “Enable sign ups”).
4. Save.

Leave your own user in place. You can still add another owner later from **Authentication → Users**, then add that person to `admins` with the SQL above. Do not turn public sign-up back on.

The file `supabase/config.toml` turns public sign-up off for a local Supabase started with the Supabase CLI. That file does not change the hosted project by itself. Do not run a command that pushes this config to the hosted project unless you intend to change those hosted settings. Use the dashboard steps above for the live database.

## 5. Run the site on your computer

```bash
npm install
npm run dev
```

Open http://localhost:3000/login and sign in with the admin user from step 3. The dashboard is http://localhost:3000/admin.

Sign Out ends the session. After that, opening `/admin` sends you back to the login page. Refreshing the dashboard while you are signed in should keep you signed in.

The old shared password on the sheet-music page has been removed. Adding a tune is now at http://localhost:3000/admin/add-tune and uses the same login as the rest of the admin area.

## 6. Check the contact form

1. Open http://localhost:3000/booking and send a test inquiry.
2. In Supabase **Table Editor**, confirm a row appeared in `clients` and a row with status “New Inquiry” appeared in `leads`.
3. Sign in and confirm that lead shows under **Leads**.
4. The form still emails you and the client when `RESEND_API_KEY` is set and the sender domain is verified. Saving the inquiry does not depend on the email going out.

## 7. Deploy only when you mean to

The live website deploys from `main`. This booking work lives on `booking-system`. Deploying it will replace the live site with this branch, so wait until the database steps above are finished.

When you are ready:

1. In Vercel, add the same environment variables listed in section 1. Mark `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `BLOB_READ_WRITE_TOKEN` as sensitive.
2. Deploy the `booking-system` branch, or merge it into `main` only after you have checked login on a preview.
3. Open `/login` on the deployed site, sign in, open a lead, refresh the page, then sign out and confirm `/admin` asks you to sign in again.

## How the private data is protected

- Login uses a cookie session that the server checks. The admin pages are not protected only by code running in the browser.
- Every `/admin` page, and the tune-upload APIs, require a signed-in user who is in the `admins` table.
- The database itself rejects reads and edits from anyone else, including someone who creates their own Supabase account.
- The contact form is the only public way to create an inquiry. It checks the form fields and does not send back client records.
- There is no shared admin password in the code.

## If something does not work

**The login page says the email or password is incorrect.** The user does not exist, the password is wrong, or the user was not confirmed. Check **Authentication → Users**.

**The login page says the account is not on the admin list.** The password worked, but there is no matching row in `admins`. Run the SQL in section 3.

**Leads from the contact form do not appear.** Run migration 003, confirm your user is in `admins`, then sign out and sign in again. The older “check localStorage” advice no longer applies.

**A visitor can create an account.** Turn off public sign-up in section 4. They still should not see client data unless you also add them to `admins`.

**Emails do not send.** Check the Resend API key and that the sender domain is verified. The inquiry should still be saved.

## Security notes

- Never commit `.env.local`.
- Never share the service role key.
- Do not put the service role key in any variable that starts with `NEXT_PUBLIC_`.
- Keep public sign-up turned off.
- Keep only the owner in the `admins` table.

## 8. Lead records and the calendar

After the admin login from the previous section is working, open the Supabase **SQL Editor** and run `supabase/migrations/004_lead_records_and_calendar.sql`. Run it once. It adds the rest of the lead fields, the activity timeline, calendar buffers, and the limit that protects the public date check.

No new secret keys are required. The public date check uses the service role key you already added as `SUPABASE_SERVICE_ROLE_KEY`.

Then:

1. Sign in and open **Settings**. The defaults are 30 minutes to set up, 15 minutes to pack up, and 90 minutes of travel between different street addresses. Change those if your driving is usually longer. The musician count is the largest group you can bring to one event, including yourself.
2. Open **Calendar**. Confirmed bookings block time. Tentative holds stay on the calendar but the public check will say the date needs you to confirm it. You can also block a date or a time range by hand.
3. Open **Leads** to search, filter, sort, edit, and archive. Add a lead when someone calls, emails, or messages you on Instagram. On the lead page, use **Confirm and block calendar** when the date is really booked. Archiving hides a lead. It does not free a confirmed date. Cancel the booking for that.
4. The public booking page has a date check. It can only answer “appears available,” “unavailable,” or “needs you to confirm.” It never shows client names or venues. If the check cannot be sure, it asks you to confirm rather than promising the date. One visitor can check about 30 dates a minute and 40 an hour, so the calendar cannot be copied in bulk.

Times are Pacific Time, for San Luis Obispo, including the spring and fall clock changes.

Google Calendar is connected in the next section. This website still decides travel time and tentative holds. Google busy times block only the hours they cover.

## 9. Connect your Google Calendar

Do this after sections 1 through 8 are working. You connect your own Google account once, from the admin Settings page. Visitors never see Google, and they never see the names of your other appointments.

What this does:

- Bookings you create or confirm on the website, and blocks you add by hand, are copied onto a Google calendar named **Weddings (website)**.
- If you change the time or cancel that booking, the Google event changes or disappears. Cancelling keeps the booking on this site. It does not delete it.
- The private note on a block stays on this website. It is not sent to Google.
- The website reads the busy times on your main Google calendar and blocks only those hours. A meeting from 2:00 to 3:00 blocks 2:00 to 3:00. It does not block the rest of that day. An all-day event blocks the span of that all-day event.
- Events the website itself put on **Weddings (website)** are not read back, so a wedding is not counted twice.
- If Google is disconnected, or the busy times are more than about two hours old, the public date check will not say a date “appears available.” It will say the date needs you to confirm it.

### Create the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) and sign in with the Google account you want on the calendar. Use the account that already has your personal appointments.
2. At the top, open the project menu and click **New project**. Name it something you will recognize, such as `Daniel Cimo Violin`. Create it, then make sure that project is selected.
3. Open the menu (three lines) → **APIs & Services** → **Library**.
4. Search for **Google Calendar API**. Open it and click **Enable**.

### Set the permission screen

1. Go to **APIs & Services** → **OAuth consent screen** (Google sometimes labels this **Google Auth platform**).
2. If Google asks for a user type:
   - Choose **Internal** if this Google account is a Google Workspace account for a business you administer. Internal is the simple path.
   - Choose **External** if this is a normal Gmail account.
3. App name: `Daniel Cimo Violin`. User support email and developer contact email: your email. Save.
4. On the scopes step, click **Add or remove scopes** and add these four, then update and save:

   - `https://www.googleapis.com/auth/calendar.app.created` — lets the site create the Weddings calendar and edit events on it
   - `https://www.googleapis.com/auth/calendar.events` — backup, used only if that Weddings calendar cannot be created, so events can go on your main calendar
   - `https://www.googleapis.com/auth/calendar.freebusy` — lets the site see when you are busy, without reading event titles
   - `https://www.googleapis.com/auth/userinfo.email` — lets the Settings page show which Google account is connected

5. If the app is **External**, open **Audience** (or **Publishing status**) and click **Publish app**. The status must say **In production**, not **Testing**.
   - Testing mode expires the connection after 7 days. You would have to click Reconnect every week.
   - In production, Google may show a warning that the app is not verified. That is expected for a private site. On that screen choose **Advanced**, then **Go to Daniel Cimo Violin (unsafe)**. Only you use this connection. You do not need to submit the app for Google’s review unless you want that warning to go away.

### Create the OAuth client

1. Go to **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
2. Application type: **Web application**. Name it `Website`.
3. Under **Authorized redirect URIs**, add both of these. They must match character for character, including `http` versus `https`:

   - `http://localhost:3000/api/admin/google/callback`
   - `https://danielcimo.com/api/admin/google/callback`

   If you also use `www.danielcimo.com`, add `https://www.danielcimo.com/api/admin/google/callback` as well. The value you put in `GOOGLE_OAUTH_REDIRECT_URI` has to be one of these.
4. Create it. Copy the **Client ID** and the **Client secret**. Leave this page open until they are pasted somewhere safe. Do not email them or put them in the website code.

### Make two secret keys

On your computer, in Terminal, run this twice. Use the first result for the encryption key and the second for the cron secret. They must be different.

```bash
openssl rand -base64 32
```

### Put the values on your computer

Open `.env.local` in the project folder (the same file from section 1). Add these lines. None of them start with `NEXT_PUBLIC_`.

```bash
GOOGLE_CLIENT_ID=the-client-id-from-google
GOOGLE_CLIENT_SECRET=the-client-secret-from-google
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/admin/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=the-first-openssl-result
CRON_SECRET=the-second-openssl-result
```

Save the file. Do not commit it. Git is already set to ignore `.env.local`.

### Put the same values on Vercel

1. Open the Vercel project → **Settings** → **Environment Variables**.
2. Add the same five names and values. For the live site, set `GOOGLE_OAUTH_REDIRECT_URI` to `https://danielcimo.com/api/admin/google/callback` (or the `www` version if that is the real address).
3. Mark `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET` as sensitive.
4. Apply them to the environment you will deploy. Do not add a `NEXT_PUBLIC_` copy of any of them.

The encryption key must be the same in `.env.local` and on Vercel if you ever copy the database between them. If you change the encryption key later, open Settings and click **Reconnect Google**. The old saved connection cannot be read with a new key.

### Update the database

In the Supabase **SQL Editor**, run `supabase/migrations/005_google_calendar.sql` once. It adds the connection row, the link between a booking and its Google event, a waiting list of changes, and a table of busy times. Busy times have a start and an end only. They do not store event titles.

The connection table is not readable from the browser. The Settings page asks the server, and the server checks that you are the admin before it answers. It never sends the refresh token to the browser.

### Connect from the website

1. Restart the local site (`npm run dev`) so it sees the new `.env.local` values.
2. Sign in and open **Settings**.
3. Click **Connect Google Calendar**.
4. Sign in to Google if it asks, allow the permissions, and accept the unverified-app warning if it appears.
5. You should land back on Settings with “Google Calendar is connected,” your Google email, and the calendar name **Weddings (website)**.
6. Open [Google Calendar](https://calendar.google.com/) and confirm that calendar is in the list. New bookings and blocks from the website show up there after you save them. The save also asks the server to sync. If that request fails, the change stays in a waiting list until the next sync.

**Disconnect** on the same page stops the sync and removes the saved key. It does not delete the Weddings calendar or the events already on it.

**Reconnect Google** appears if Google rejects the saved key. Click it and allow access again. Until you do, the public date check will not say a date appears available.

### Keep busy times fresh

The file `vercel.json` asks Vercel to call `https://your-site/api/cron/google-sync` once a day, at 15:00 UTC. Vercel sends `Authorization: Bearer` plus the `CRON_SECRET` you saved. The route refuses any other caller.

Vercel’s Hobby plan only allows a cron job to run once a day. Busy times older than about two hours are treated as stale, so on Hobby the public date check will usually say a date needs you to confirm it, even when the day is empty. That is deliberate. It will not promise a date is free when it has not looked at Google recently.

To make “appears available” work again, use one of these:

- Vercel Pro, and change the schedule in `vercel.json` to every 10 or 15 minutes, for example `*/15 * * * *`.
- Or Supabase **pg_cron** with the **pg_net** extension, calling the same URL every 10 or 15 minutes. In the Supabase SQL editor, after those extensions are on, you can schedule it like this. Replace the secret with your real `CRON_SECRET` at the moment you run it. Do not save the secret into a file that gets committed.

```sql
select cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$select net.http_get(
      url := 'https://danielcimo.com/api/cron/google-sync',
      headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
    )$$
);
```

You can also click **Sync now** on Settings any time. Saving a booking, a hold, or a block asks for a sync as well.

### If something does not work

**Settings says the Google keys are not set.** The dev server was started before `.env.local` changed, or a name is misspelled. Restart `npm run dev`. On Vercel, confirm the five variables exist and redeploy.

**Google says redirect URI mismatch.** The URI in Google Cloud and `GOOGLE_OAUTH_REDIRECT_URI` are not identical. Check `http` versus `https`, and whether you included `www`.

**The connection dies after a week.** The consent screen is still in Testing. Publish it to In production, then click Reconnect Google.

**A personal appointment blocks the whole day.** It should not. Only the start and end of that appointment are busy. An all-day Google event does block that whole day. Refresh the admin calendar after Sync now and look for a darker gray “Google Calendar” chip on that day only.

**A wedding shows up twice.** The busy check reads your main calendar and skips the Weddings calendar. If the site had to use your primary calendar instead, it subtracts the events it created. Click Sync now. If a duplicate remains, delete the older copy in Google; the website copy will be rewritten.

## 10. Cancel a booking without erasing its history

After sections 1 through 9, open the Supabase **SQL Editor** and run `supabase/migrations/006_booking_cancel_and_status_sync.sql` once. It is safe to run after migration 005. Running it again replaces the same functions. It does not need a new secret, and it does not change the live site until you deploy the code that calls it.

What changes:

- **Cancel booking** replaces delete. The booking stays, with the time it was cancelled, who cancelled it, and an optional reason. The timeline stays with it, and a “Booking cancelled” entry is added.
- A cancelled booking no longer blocks the calendar or the public date check. The same save asks Google to remove the mirrored event. If Google is offline, that removal waits in the existing list until the next sync.
- Confirming a booking also marks its lead **Confirmed**, in one step. The database rejects the confirm when that time overlaps another booking, including setup and breakdown.
- Cancelling the last booking on a lead marks the lead **Lost**. Leads do not have a separate Cancelled status. If another booking for that lead is still confirmed or completed, the lead keeps that status.
- Restoring a cancelled booking puts it back only when the time is still free.
- Archiving a lead is blocked while a tentative or confirmed booking is still on the calendar. Cancel the booking first. A completed booking can stay.
- The browser cannot set booking status, cancellation fields, or lead status on its own. Those changes go through the server, which checks that you are the admin. The service role key stays in `SUPABASE_SERVICE_ROLE_KEY`. Do not copy it into a `NEXT_PUBLIC_` variable.

## 11. Sign wedding agreements on the site

After sections 1 through 10, open the Supabase **SQL Editor** and run `supabase/migrations/007_contract_signing.sql` once. Do not run it from the app, and do not point it at a database you have not backed up. Running it again replaces the lock function and the private file policies. It does not take a payment.

What it adds:

- Columns on `contracts` for the filled agreement, the signing token, the client signature, the musician signature, and the SHA-256 of the exact text the client signed.
- `bookings.booking_code`, a short code such as `DC-4827`.
- `payment_obligations`, one open retainer row and one open balance row. A later Zelle matcher can look up `booking_code` plus `amount_cents` where `status` is `open`. When both amounts match, prefer the retainer. This migration does not connect a bank or Stripe.
- A private Storage bucket named `contracts`. The browser cannot read it. Download goes through the admin server.
- A setting, `auto_countersign_contracts`, which is off until you turn it on under **Settings**.

Environment variables, in addition to the Resend key you already use:

- `CONTRACT_FROM_EMAIL` or `RESEND_FROM`. If neither is set, agreement email uses `RESEND_FROM_EMAIL`.
- `CONTRACT_REPLY_TO`. Optional. Defaults to `dancimo@gmail.com`.
- `CONTACT_EMAIL`. The signed PDF is also sent here. Defaults to `dancimo@gmail.com`.
- `CONTRACT_PUBLIC_ORIGIN`. Optional. Set it to `https://danielcimo.com` if a signing link is built with the wrong host.

`SUPABASE_SERVICE_ROLE_KEY` stays server-only. Do not create a `NEXT_PUBLIC_` copy.

Then sign in, open a lead or a booking, choose **Create contract**, check the preview, and choose **Send for signature**. The couple opens `/contract?t=` plus the token in that email. After they sign, the PDF is stored in the private bucket and emailed. Use **Countersign** on the lead or booking unless Settings is set to record your signature automatically. **Void** and **Resend** apply only before the client signs.

## 12. Take Zelle and card or bank payments

After section 11, open the Supabase **SQL Editor** and run `supabase/migrations/008_payments.sql` once. Do not run it from the app, and do not point it at a database you have not backed up. Running it again replaces the payment function. It does not charge anyone.

What it adds:

- Columns on `payments` for the method, the amount in cents, the Chase transaction number, and the Stripe Checkout session.
- `zelle_receipts`, one row per Chase transaction number. A memo with no `DC-####` code is stored as ignored and is not emailed. A code that does not match an open amount is unmatched and shows under **Admin → Payments**.
- `stripe_events` and `stripe_checkout_sessions`, so a repeated Stripe webhook does not record the payment twice.

Then set these on Vercel (and in `.env.local` if you try payments on your computer). All of them stay on the server. Do not create a `NEXT_PUBLIC_` copy.

- `ZELLE_INGEST_SECRET`. A long random string. The same value goes in the Apps Script property of that name.
- `STRIPE_SECRET_KEY`. The Stripe secret key (`sk_`), not the publishable key.
- `STRIPE_WEBHOOK_SECRET`. From the Stripe webhook endpoint below.
- `ZELLE_RECIPIENT_DISPLAY` and `ZELLE_RECIPIENT_CONTACT` are optional. When they are unset, the couple sees Daniel Cimo and (224) 678-2799.
- Fee settings are optional. When unset, a card payment adds Stripe's published US card rate (2.9% + 30¢) as its own line, and a bank payment does not add the published ACH rate (0.8%, capped at $5). Set `STRIPE_PASS_CARD_FEE=false` or `STRIPE_PASS_ACH_FEE=true` to change that.

In Stripe, add a webhook endpoint:

`https://danielcimo.com/api/payments/stripe/webhook`

Send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

The Zelle QR used on the payment page and in payment email is `public/images/zelle-qr.png`. Replace that file with a new export from Chase if the code changes, and redeploy. Do not substitute a generated code.

The Apps Script that reads Chase alerts is `scripts/gmail-zelle-forwarder/`. Its README is the two-minute setup: paste `Code.gs`, set the two script properties, run `setup` once.

A thank-you email after the wedding is not sent. The daily cron is already used for Google Calendar, and this plan does not add another one.

