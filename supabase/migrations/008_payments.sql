-- Phase 2 payments: Zelle receipts and Stripe checkout.
-- Safe to run after 007. Do not run this from the app.
-- Do not run it against a live database from a deploy. Run it once in the
-- Supabase SQL Editor after you have a backup.
-- Re-running replaces the record function and the policies on the new tables.
-- It does not charge a card and it does not call Stripe.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS obligation_id UUID REFERENCES public.payment_obligations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chase_transaction_number TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_paid_on DATE;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check CHECK (
    method IS NULL OR method IN ('zelle', 'stripe_card', 'stripe_ach', 'manual')
  );

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_cents_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_cents_check CHECK (amount_cents IS NULL OR amount_cents >= 0);

COMMENT ON COLUMN public.payments.chase_transaction_number IS
  'Chase Zelle transaction number. One number can be recorded once.';
COMMENT ON COLUMN public.payments.method IS
  'zelle, stripe_card, stripe_ach, or manual. Null on rows from before phase 2.';

CREATE UNIQUE INDEX IF NOT EXISTS payments_chase_transaction_number_key
  ON public.payments (chase_transaction_number)
  WHERE chase_transaction_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_checkout_session_id_key
  ON public.payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_obligation_id_idx
  ON public.payments (obligation_id);

CREATE TABLE IF NOT EXISTS public.zelle_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chase_transaction_number TEXT NOT NULL,
  sender_name TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  sent_on DATE,
  memo TEXT,
  extracted_code TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('matched', 'unmatched', 'ignored')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  obligation_id UUID REFERENCES public.payment_obligations(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  couple_notified_at TIMESTAMPTZ,
  owner_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.zelle_receipts IS
  'One row per Chase Zelle transaction number. ignored has no DC code and is not emailed. unmatched has a code that did not match and is shown to the owner.';

CREATE UNIQUE INDEX IF NOT EXISTS zelle_receipts_transaction_key
  ON public.zelle_receipts (chase_transaction_number);

CREATE INDEX IF NOT EXISTS zelle_receipts_unmatched_idx
  ON public.zelle_receipts (created_at DESC)
  WHERE outcome = 'unmatched';

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.stripe_events IS
  'Stripe webhook event ids already handled. A repeated delivery is a no-op.';

CREATE TABLE IF NOT EXISTS public.stripe_checkout_sessions (
  id TEXT PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL REFERENCES public.payment_obligations(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('stripe_card', 'stripe_ach')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'paid', 'failed')),
  url TEXT,
  notified_kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.stripe_checkout_sessions IS
  'Hosted Checkout sessions started from the couple payment page. ACH stays processing until Stripe says the debit succeeded.';

ALTER TABLE public.zelle_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.zelle_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.stripe_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.stripe_checkout_sessions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.zelle_receipts TO authenticated;
GRANT SELECT ON TABLE public.stripe_checkout_sessions TO authenticated;
GRANT ALL ON TABLE public.zelle_receipts TO service_role;
GRANT ALL ON TABLE public.stripe_events TO service_role;
GRANT ALL ON TABLE public.stripe_checkout_sessions TO service_role;

DROP POLICY IF EXISTS "Admins can view zelle_receipts" ON public.zelle_receipts;
CREATE POLICY "Admins can view zelle_receipts"
  ON public.zelle_receipts FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view stripe_checkout_sessions" ON public.stripe_checkout_sessions;
CREATE POLICY "Admins can view stripe_checkout_sessions"
  ON public.stripe_checkout_sessions FOR SELECT TO authenticated USING (public.is_admin());

-- Writes go through the service role. The browser cannot insert a payment event.

CREATE OR REPLACE FUNCTION public.record_matched_payment(
  p_obligation_id uuid,
  p_amount_cents integer,
  p_method text,
  p_payment_status text,
  p_chase_transaction_number text,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_payer_name text,
  p_memo text,
  p_fee_cents integer,
  p_paid_at timestamptz,
  p_external_paid_on date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ob public.payment_obligations%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_type text;
  v_amount numeric;
  v_booking_id uuid;
  v_lead_id uuid;
BEGIN
  IF p_method NOT IN ('zelle', 'stripe_card', 'stripe_ach', 'manual') THEN
    RAISE EXCEPTION 'Unknown payment method.' USING ERRCODE = 'P0001';
  END IF;
  IF p_payment_status NOT IN ('Processing', 'Completed', 'Failed') THEN
    RAISE EXCEPTION 'Unknown payment status.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'Amount is missing.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ob
  FROM public.payment_obligations
  WHERE id = p_obligation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_open');
  END IF;
  IF v_ob.amount_cents <> p_amount_cents THEN
    RETURN jsonb_build_object('result', 'amount_mismatch');
  END IF;

  v_booking_id := v_ob.booking_id;
  SELECT lead_id INTO v_lead_id FROM public.bookings WHERE id = v_booking_id;

  IF NULLIF(btrim(COALESCE(p_chase_transaction_number, '')), '') IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.payments
    WHERE chase_transaction_number = btrim(p_chase_transaction_number)
    FOR UPDATE;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'result', 'duplicate',
        'payment_id', v_existing.id,
        'payment_status', v_existing.status,
        'kind', v_ob.kind,
        'booking_id', v_booking_id,
        'lead_id', v_lead_id
      );
    END IF;
  END IF;

  IF NULLIF(btrim(COALESCE(p_stripe_session_id, '')), '') IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.payments
    WHERE stripe_checkout_session_id = btrim(p_stripe_session_id)
    FOR UPDATE;
    IF FOUND THEN
      IF v_existing.status = 'Completed'
         OR p_payment_status = 'Processing'
         OR (v_existing.status = 'Failed' AND p_payment_status = 'Failed')
         OR (v_existing.status = 'Processing' AND p_payment_status = 'Processing') THEN
        RETURN jsonb_build_object(
          'result', 'duplicate',
          'payment_id', v_existing.id,
          'payment_status', v_existing.status,
          'kind', v_ob.kind,
          'booking_id', v_booking_id,
          'lead_id', v_lead_id
        );
      END IF;
      IF v_existing.status = 'Processing' AND p_payment_status IN ('Completed', 'Failed') THEN
        UPDATE public.payments
        SET
          status = p_payment_status,
          paid_at = CASE WHEN p_payment_status = 'Completed' THEN COALESCE(p_paid_at, NOW()) ELSE paid_at END,
          stripe_payment_intent_id = COALESCE(NULLIF(btrim(COALESCE(p_stripe_payment_intent_id, '')), ''), stripe_payment_intent_id),
          updated_at = NOW()
        WHERE id = v_existing.id
        RETURNING * INTO v_payment;
        IF p_payment_status = 'Completed' AND v_ob.status = 'open' THEN
          UPDATE public.payment_obligations
          SET status = 'paid', updated_at = NOW()
          WHERE id = v_ob.id AND status = 'open';
          PERFORM public.apply_payment_lead_status(v_booking_id);
        END IF;
        RETURN jsonb_build_object(
          'result', CASE WHEN p_payment_status = 'Completed' THEN 'upgraded' ELSE 'failed' END,
          'payment_id', v_payment.id,
          'payment_status', v_payment.status,
          'kind', v_ob.kind,
          'booking_id', v_booking_id,
          'lead_id', v_lead_id
        );
      END IF;
      IF v_existing.status = 'Failed' AND p_payment_status = 'Completed' THEN
        RETURN jsonb_build_object('result', 'not_open', 'kind', v_ob.kind, 'booking_id', v_booking_id);
      END IF;
    END IF;
  END IF;

  IF v_ob.status <> 'open' THEN
    RETURN jsonb_build_object('result', 'not_open', 'kind', v_ob.kind, 'booking_id', v_booking_id, 'lead_id', v_lead_id);
  END IF;

  v_type := CASE v_ob.kind WHEN 'retainer' THEN 'Retainer' ELSE 'Balance' END;
  v_amount := (p_amount_cents::numeric) / 100;

  BEGIN
    INSERT INTO public.payments (
      booking_id,
      amount,
      amount_cents,
      payment_type,
      status,
      method,
      obligation_id,
      chase_transaction_number,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      payer_name,
      memo,
      fee_cents,
      external_paid_on,
      paid_at,
      created_at,
      updated_at
    ) VALUES (
      v_booking_id,
      v_amount,
      p_amount_cents,
      v_type,
      p_payment_status,
      p_method,
      v_ob.id,
      NULLIF(btrim(COALESCE(p_chase_transaction_number, '')), ''),
      NULLIF(btrim(COALESCE(p_stripe_session_id, '')), ''),
      NULLIF(btrim(COALESCE(p_stripe_payment_intent_id, '')), ''),
      NULLIF(btrim(COALESCE(p_payer_name, '')), ''),
      NULLIF(btrim(COALESCE(p_memo, '')), ''),
      COALESCE(p_fee_cents, 0),
      p_external_paid_on,
      CASE WHEN p_payment_status = 'Completed' THEN COALESCE(p_paid_at, NOW()) ELSE NULL END,
      NOW(),
      NOW()
    )
    RETURNING * INTO v_payment;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('result', 'duplicate', 'kind', v_ob.kind, 'booking_id', v_booking_id, 'lead_id', v_lead_id);
  END;

  IF p_payment_status = 'Completed' THEN
    UPDATE public.payment_obligations
    SET status = 'paid', updated_at = NOW()
    WHERE id = v_ob.id AND status = 'open';
    PERFORM public.apply_payment_lead_status(v_booking_id);
  END IF;

  RETURN jsonb_build_object(
    'result', CASE p_payment_status WHEN 'Completed' THEN 'created' WHEN 'Failed' THEN 'failed' ELSE 'processing' END,
    'payment_id', v_payment.id,
    'payment_status', v_payment.status,
    'kind', v_ob.kind,
    'booking_id', v_booking_id,
    'lead_id', v_lead_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_payment_lead_status(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  SELECT lead_id INTO v_lead_id FROM public.bookings WHERE id = p_booking_id;
  IF v_lead_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.leads AS leads
  SET
    payment_status = CASE
      WHEN leads.payment_status = 'Refunded' THEN 'Refunded'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.payment_obligations
        WHERE booking_id = p_booking_id AND status = 'open'
      ) THEN 'Paid'
      WHEN EXISTS (
        SELECT 1 FROM public.payment_obligations
        WHERE booking_id = p_booking_id AND kind = 'retainer' AND status = 'paid'
      ) THEN CASE WHEN leads.payment_status = 'Paid' THEN 'Paid' ELSE 'Retainer Received' END
      ELSE leads.payment_status
    END,
    updated_at = NOW()
  WHERE leads.id = v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_matched_payment(
  uuid, integer, text, text, text, text, text, text, text, integer, timestamptz, date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_matched_payment(
  uuid, integer, text, text, text, text, text, text, text, integer, timestamptz, date
) TO service_role;

REVOKE ALL ON FUNCTION public.apply_payment_lead_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_lead_status(uuid) TO service_role;

COMMENT ON FUNCTION public.record_matched_payment(
  uuid, integer, text, text, text, text, text, text, text, integer, timestamptz, date
) IS
  'Records one payment against an open obligation. The Chase transaction number and the Stripe Checkout session id can each be stored once. Service role only.';
