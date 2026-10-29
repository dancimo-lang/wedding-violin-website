# Chase Zelle forwarder

This Apps Script reads Chase “You received money with Zelle” mail in Gmail and posts each alert to the website. The site matches the memo to an open retainer or balance.

Use a separate Apps Script project for a protected preview. The production project should keep posting to `https://danielcimo.com`.

The script searches mail from `chase.com` whose subject contains “You received money with Zelle”, newer than 30 days, and skips threads that already have `Zelle/processed` or `Zelle/unmatched`.

## What the labels mean

- `Zelle/processed` — the site accepted the payment. A memo with no `DC-####` code is recorded and labeled processed. It is not emailed.
- `Zelle/unmatched` — the site read the payment and it does not match one open retainer or balance, or the alert itself could not be read. These are not retried.
- No Zelle label — the post never got a normal answer. The next minute tries again. This covers a network error and any response that is not HTTP 2xx, including a Vercel protection page. A 4xx or 5xx is not labeled `Zelle/unmatched`.

An alert older than `ZELLE_ONLY_AFTER` is also left unlabeled, so changing that date later can still pick it up. Gmail stops offering it after 30 days.

## Production

1. Open [script.google.com](https://script.google.com) while signed in as the Google account that receives the Chase alerts (dancimo@gmail.com). Create a project and replace the sample file with the full text of `Code.gs`.
2. Open **Project Settings → Script properties** and add:
   - `ZELLE_INGEST_SECRET` — the same long random string you set as `ZELLE_INGEST_SECRET` on the Vercel Production environment. Generate one with `openssl rand -base64 32`.
   - `ZELLE_INGEST_URL` — `https://danielcimo.com/api/payments/zelle`
   - `ZELLE_ONLY_AFTER` — optional, but set it before the first run. An ISO date, `YYYY-MM-DD`. Alerts whose **Sent on** date is earlier than this are not posted, so the first run does not forward 30 days of old lesson payments. An alert sent on this date is included. Example: turning the forwarder on for payments from October 29, 2026 onward means `2026-10-29`. Leave the property blank to post every unlabeled alert from the last 30 days.
   - `VERCEL_BYPASS_SECRET` — leave this blank for production. A blank value sends no bypass header.
3. In the editor, choose the function `setup` and click **Run**. Approve the Gmail and external-request permissions. `setup` creates the labels `Zelle/processed` and `Zelle/unmatched` and a trigger that runs every minute.
4. Send or wait for a Chase Zelle alert whose Sent on date is on or after `ZELLE_ONLY_AFTER`.

## Preview testing

Deployment Protection can stay on. The forwarder reaches the preview by sending the automation bypass secret as the `x-vercel-protection-bypass` header.

1. Create a second Apps Script project, so the production trigger is left alone. Paste `Code.gs` and run `setup` once, the same way as production.
2. In Vercel, open the project → **Settings → Deployment Protection → Protection Bypass for Automation**, and create a secret (for example, “Zelle preview”). Copy that secret. It is also the value Vercel stores as `VERCEL_AUTOMATION_BYPASS_SECRET` when that secret is the one selected for deployments.
3. Set the preview’s `ZELLE_INGEST_SECRET` on the Vercel Preview environment. It can match production or be a different string. The script property has to match the preview.
4. Copy the preview deployment origin (the `https://….vercel.app` host for the deployment you want to test).
5. Script properties for this preview project:
   - `ZELLE_INGEST_SECRET` — the Preview environment secret.
   - `ZELLE_INGEST_URL` — `https://<preview-host>/api/payments/zelle`
   - `VERCEL_BYPASS_SECRET` — the Protection Bypass for Automation secret. When this property is set, each post includes `x-vercel-protection-bypass`. When it is blank or unset, that header is omitted.
   - `ZELLE_ONLY_AFTER` — today’s date, `YYYY-MM-DD`, so old lesson payments are not posted to the preview. Move it earlier only for an alert you intend to replay. Those threads stay unlabeled until a run posts them.
6. Run `processZelleAlerts` once from the editor, or wait for the minute trigger. A protection failure stays unlabeled and is tried again. After the preview test, leave this project’s URL and bypass secret off the production project.
