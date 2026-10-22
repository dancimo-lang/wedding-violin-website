# Chase Zelle forwarder

This Apps Script reads Chase “You received money with Zelle” mail in Gmail and posts each alert to the website. The site matches the memo to an open retainer or balance. Setup is about two minutes.

1. Open [script.google.com](https://script.google.com) while signed in as the Google account that receives the Chase alerts (dancimo@gmail.com). Create a project and replace the sample file with the full text of `Code.gs`.
2. Open **Project Settings → Script properties** and add two properties:
   - `ZELLE_INGEST_SECRET` — the same long random string you set as `ZELLE_INGEST_SECRET` on Vercel. Generate one with `openssl rand -base64 32`.
   - `ZELLE_INGEST_URL` — `https://danielcimo.com/api/payments/zelle`
3. In the editor, choose the function `setup` and click **Run**. Approve the Gmail and external-request permissions. `setup` creates the labels `Zelle/processed` and `Zelle/unmatched` and a trigger that runs every minute.
4. Send or wait for a Chase Zelle alert. A matched payment is labeled `Zelle/processed`. A payment that contains a booking code but does not match is labeled `Zelle/unmatched`. A network failure or a 5xx stays unlabeled so the next minute tries again.

The script only searches mail from `chase.com` whose subject contains “You received money with Zelle”, and it skips threads that already have one of those labels. Payments with no `DC-####` code are recorded on the site and labeled processed. They are not emailed.
