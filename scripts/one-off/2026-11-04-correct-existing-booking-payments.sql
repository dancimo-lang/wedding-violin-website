-- Review only. Do not run this until the owner says yes.
-- Do not put this file in supabase/migrations. A deploy does not apply it.
-- It changes live bookings added on 2026-11-04. It sends no email.
--
-- After the payment-record change is deployed, the same correction can be done
-- on each booking page: set "Amount already paid" and save, or click
-- "Create payment link" when the amounts are already right. Use this script
-- only if you want the database change without using that page.
--
-- Run it once, in the Supabase SQL editor, as one script. If any check fails,
-- the transaction stops and nothing is saved.
-- Payment links work only after this pull request is deployed.
-- A link is https://danielcimo.com/pay?t=<token printed in the notices>
-- Do not run this and also click "Save payment record" for the same booking.

BEGIN;

-- Della Hayes, 2027-05-15, DC-2913.
-- The form stored a 50% retainer: $225 paid and $225 open.
-- The real record is $100 paid by Zelle and $350 open, due 2027-04-15.
DO $$
DECLARE
  v_booking uuid := '03de3c47-d98d-4296-b65b-4433dea3666a';
  v_paid uuid;
  v_token text;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = v_booking AND booking_code = 'DC-2913' AND total_price = 450.00
  ) THEN
    RAISE EXCEPTION 'Della Hayes booking was not the expected $450 row DC-2913.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_obligations
    WHERE id = 'deec83fd-9612-4fb4-88a0-e947fb867023'
      AND booking_id = v_booking AND kind = 'retainer' AND amount_cents = 22500 AND status = 'paid'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.payment_obligations
    WHERE id = '20bbb9b5-3489-44ba-8e4e-a072b11aac1f'
      AND booking_id = v_booking AND kind = 'balance' AND amount_cents = 22500 AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Della Hayes obligations are not the $225 paid / $225 open pair. Nothing was changed.';
  END IF;

  DELETE FROM public.payments
  WHERE id = '829679f9-2ad7-4df5-9efa-6c1dd9176566'
    AND booking_id = v_booking
    AND method = 'manual'
    AND amount_cents = 22500;

  UPDATE public.payment_obligations
  SET status = 'void', updated_at = NOW()
  WHERE booking_id = v_booking AND status <> 'void';

  INSERT INTO public.payment_obligations (booking_id, contract_id, booking_code, kind, amount_cents, status, due_on)
  VALUES (v_booking, NULL, 'DC-2913', 'retainer', 10000, 'open', NULL)
  RETURNING id INTO v_paid;

  INSERT INTO public.payment_obligations (booking_id, contract_id, booking_code, kind, amount_cents, status, due_on)
  VALUES (v_booking, NULL, 'DC-2913', 'balance', 35000, 'open', '2027-04-15');

  v_result := public.record_matched_payment(
    v_paid, 10000, 'manual', 'Completed',
    NULL, NULL, NULL,
    'Della Hayes',
    'Paid outside the site (Zelle). Added manually as an existing booking.',
    0, NOW(), NULL
  );
  IF v_result->>'result' IS DISTINCT FROM 'created' THEN
    RAISE EXCEPTION 'Della Hayes payment was not recorded: %', v_result;
  END IF;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  UPDATE public.bookings
  SET retainer_amount = 100.00, balance_due_date = '2027-04-15', updated_at = NOW()
  WHERE id = v_booking;

  UPDATE public.activity_events
  SET metadata = metadata || jsonb_build_object(
    'payment_status', 'partial',
    'paid_cents', 10000,
    'balance_due_on', '2027-04-15',
    'payment_token', v_token
  )
  WHERE booking_id = v_booking
    AND metadata->>'source' = 'existing_booking';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Della Hayes has no existing-booking marker.';
  END IF;

  UPDATE public.bookings
  SET special_requests = special_requests || E'\n\nCorrected on review: $100.00 was paid by Zelle. $350.00 is still owed, due 2027-04-15.'
  WHERE id = v_booking
    AND COALESCE(special_requests, '') NOT LIKE '%Corrected on review:%';

  RAISE NOTICE 'Della Hayes payment link token: %', v_token;
END $$;

-- Alecxis Meza, 2027-04-30, DC-5777.
-- Nothing has been paid. The old form stored two open halves of $750.
-- Replace them with one open $1,500 payment, due 2027-03-31.
DO $$
DECLARE
  v_booking uuid := 'a15dc994-1cc0-4557-b2ae-bd6e88cb03f2';
  v_token text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = v_booking AND booking_code = 'DC-5777' AND total_price = 1500.00
  ) THEN
    RAISE EXCEPTION 'Alecxis Meza booking was not the expected $1,500 row DC-5777.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE booking_id = v_booking) THEN
    RAISE EXCEPTION 'Alecxis Meza already has a payment row. Nothing was changed.';
  END IF;
  IF (
    SELECT COUNT(*) FROM public.payment_obligations
    WHERE booking_id = v_booking AND status = 'open' AND amount_cents = 75000
  ) <> 2 THEN
    RAISE EXCEPTION 'Alecxis Meza does not have two open $750 obligations. Nothing was changed.';
  END IF;

  UPDATE public.payment_obligations
  SET status = 'void', updated_at = NOW()
  WHERE booking_id = v_booking AND status = 'open';

  INSERT INTO public.payment_obligations (booking_id, contract_id, booking_code, kind, amount_cents, status, due_on)
  VALUES (v_booking, NULL, 'DC-5777', 'retainer', 150000, 'open', '2027-03-31');

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  UPDATE public.bookings
  SET retainer_amount = 1500.00, balance_due_date = '2027-03-31', updated_at = NOW()
  WHERE id = v_booking;

  UPDATE public.activity_events
  SET metadata = metadata || jsonb_build_object(
    'payment_status', 'nothing_paid',
    'paid_cents', 0,
    'balance_due_on', '2027-03-31',
    'payment_token', v_token
  )
  WHERE booking_id = v_booking
    AND metadata->>'source' = 'existing_booking';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alecxis Meza has no existing-booking marker.';
  END IF;

  UPDATE public.bookings
  SET special_requests = special_requests || E'\n\nCorrected on review: nothing has been paid. $1,500.00 is open as one payment, due 2027-03-31.'
  WHERE id = v_booking
    AND COALESCE(special_requests, '') NOT LIKE '%Corrected on review:%';

  RAISE NOTICE 'Alecxis Meza payment link token: %', v_token;
END $$;

-- Hailey Earnest DC-1869: two open payments of $1,500 (retainer and balance). Amounts stay.
-- Cynthia Virden DC-6577: $1,500 retainer paid and $1,500 balance open. Amounts stay.
-- This block only adds a payment link where one is not already stored.
-- Kali Greblo DC-3741 is paid in full and is checked, not changed.
DO $$
DECLARE
  v_token text;
  v_existing text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = 'b15c2881-5b71-4dd8-bc87-f1b285eee73d' AND booking_code = 'DC-1869' AND total_price = 3000.00
  ) THEN
    RAISE EXCEPTION 'Hailey Earnest booking was not the expected $3,000 row DC-1869.';
  END IF;
  IF (
    SELECT COUNT(*) FROM public.payment_obligations
    WHERE booking_id = 'b15c2881-5b71-4dd8-bc87-f1b285eee73d' AND status = 'open' AND amount_cents = 150000
  ) <> 2 THEN
    RAISE EXCEPTION 'Hailey Earnest does not have two open $1,500 obligations. Her amounts were not changed.';
  END IF;
  SELECT metadata->>'payment_token' INTO v_existing
  FROM public.activity_events
  WHERE booking_id = 'b15c2881-5b71-4dd8-bc87-f1b285eee73d'
    AND metadata->>'source' = 'existing_booking'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hailey Earnest has no existing-booking marker.';
  END IF;
  v_token := COALESCE(NULLIF(v_existing, ''), rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '='));
  UPDATE public.activity_events
  SET metadata = metadata || jsonb_build_object('payment_token', v_token, 'paid_cents', 0)
  WHERE booking_id = 'b15c2881-5b71-4dd8-bc87-f1b285eee73d'
    AND metadata->>'source' = 'existing_booking';
  RAISE NOTICE 'Hailey Earnest payment link token: %', v_token;

  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = '55c4ba64-17ec-4cea-a3c0-b91d669f4acf' AND booking_code = 'DC-6577' AND total_price = 3000.00
  ) THEN
    RAISE EXCEPTION 'Cynthia Virden booking was not the expected $3,000 row DC-6577.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_obligations
    WHERE booking_id = '55c4ba64-17ec-4cea-a3c0-b91d669f4acf' AND kind = 'balance' AND status = 'open' AND amount_cents = 150000
  ) OR NOT EXISTS (
    SELECT 1 FROM public.payment_obligations
    WHERE booking_id = '55c4ba64-17ec-4cea-a3c0-b91d669f4acf' AND kind = 'retainer' AND status = 'paid' AND amount_cents = 150000
  ) THEN
    RAISE EXCEPTION 'Cynthia Virden is not $1,500 paid and $1,500 open. Her amounts were not changed.';
  END IF;
  SELECT metadata->>'payment_token' INTO v_existing
  FROM public.activity_events
  WHERE booking_id = '55c4ba64-17ec-4cea-a3c0-b91d669f4acf'
    AND metadata->>'source' = 'existing_booking'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cynthia Virden has no existing-booking marker.';
  END IF;
  v_token := COALESCE(NULLIF(v_existing, ''), rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '='));
  UPDATE public.activity_events
  SET metadata = metadata || jsonb_build_object('payment_token', v_token, 'paid_cents', 150000)
  WHERE booking_id = '55c4ba64-17ec-4cea-a3c0-b91d669f4acf'
    AND metadata->>'source' = 'existing_booking';
  RAISE NOTICE 'Cynthia Virden payment link token: %', v_token;

  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = '433d4d95-c22c-498e-b7c1-a7cc4de3f177' AND booking_code = 'DC-3741' AND total_price = 525.00
  ) THEN
    RAISE EXCEPTION 'Kali Greblo booking was not the expected $525 row DC-3741.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_obligations
    WHERE booking_id = '433d4d95-c22c-498e-b7c1-a7cc4de3f177' AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Kali Greblo has an open balance. Nothing was changed.';
  END IF;
END $$;

COMMIT;
