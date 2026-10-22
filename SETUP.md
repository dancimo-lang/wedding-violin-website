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
