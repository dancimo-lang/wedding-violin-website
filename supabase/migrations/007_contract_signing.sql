-- Built-in wedding agreements. Safe to run after 006. Do not run this from the app.
-- Re-running replaces the lock function and the storage policies.
--
-- Public visitors never receive permission on these rows. The signing page
-- calls the server with an unguessable token, and the server uses the service
-- role key. Admins keep full access through is_admin().
--
-- payment_obligations is the lookup shape for a later Chase Zelle matcher.
-- This migration does not record payments.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_code TEXT;

COMMENT ON COLUMN public.bookings.booking_code IS
  'Short code printed for the couple, such as DC-4827. A later Zelle matcher reads this code from the payment memo. It is not a secret.';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_code_key
  ON public.bookings (booking_code)
  WHERE booking_code IS NOT NULL;

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS auto_countersign_contracts BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_settings.auto_countersign_contracts IS
  'When true, Daniel Cimo is recorded as the musician signature at the moment the client signs.';

-- The original contracts table only stored a status and a URL.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.contracts'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.contracts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.contracts
SET status = CASE status
  WHEN 'Not Sent' THEN 'draft'
  WHEN 'Sent' THEN 'sent'
  WHEN 'Viewed' THEN 'viewed'
  WHEN 'Signed' THEN 'signed'
  WHEN 'Cancelled' THEN 'void'
  ELSE lower(status)
END;

ALTER TABLE public.contracts ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS package_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS render_fields JSONB;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_text TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS executed_text TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS content_sha256 TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS photo_opt_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client1_name TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client2_name TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client_signed_ip TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client_signed_user_agent TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS musician_signed_name TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS musician_signed_at TIMESTAMPTZ;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS booking_code TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS package_fee_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS travel_fee_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS additional_fees_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS discount_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS total_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS retainer_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS balance_cents INTEGER;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS final_payment_due_on DATE;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'void'));

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_template_package_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_template_package_check CHECK (
    template_id IS NULL
    OR package_id IS NULL
    OR (template_id = 'full-wedding' AND package_id = 'FULL')
    OR (template_id = 'wedding-music' AND package_id IN ('A', 'B', 'C', 'D'))
  );

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_package_fee_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_package_fee_check CHECK (
    package_id IS NULL
    OR package_fee_cents IS NULL
    OR (package_id = 'A' AND package_fee_cents = 45000)
    OR (package_id = 'B' AND package_fee_cents = 100000)
    OR (package_id = 'C' AND package_fee_cents = 100000)
    OR (package_id = 'D' AND package_fee_cents = 150000)
    OR (package_id = 'FULL' AND package_fee_cents = 300000)
  );

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_amounts_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_amounts_check CHECK (
    (
      package_fee_cents IS NULL
      AND travel_fee_cents IS NULL
      AND additional_fees_cents IS NULL
      AND discount_cents IS NULL
      AND total_cents IS NULL
      AND retainer_cents IS NULL
      AND balance_cents IS NULL
    )
    OR (
      package_fee_cents >= 0
      AND travel_fee_cents >= 0
      AND additional_fees_cents >= 0
      AND discount_cents >= 0
      AND total_cents >= 0
      AND retainer_cents >= 0
      AND balance_cents >= 0
      AND total_cents = package_fee_cents + travel_fee_cents + additional_fees_cents - discount_cents
      AND retainer_cents + balance_cents = total_cents
      AND (
        package_id IS DISTINCT FROM 'FULL'
        OR (travel_fee_cents = 0 AND additional_fees_cents = 0 AND discount_cents = 0)
      )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS contracts_access_token_key
  ON public.contracts (access_token)
  WHERE access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_active_per_booking
  ON public.contracts (booking_id)
  WHERE status IN ('sent', 'viewed', 'signed') AND booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_lead_id ON public.contracts (lead_id);

COMMENT ON COLUMN public.contracts.access_token IS
  'Unguessable signing-link token. Only the server looks a contract up by this value.';
COMMENT ON COLUMN public.contracts.signed_text IS
  'Exact agreement text hashed when the client signs. It does not change afterward.';
COMMENT ON COLUMN public.contracts.content_sha256 IS
  'SHA-256 hex of signed_text.';
COMMENT ON COLUMN public.contracts.executed_text IS
  'signed_text with the musician signature filled in, once the owner countersigns.';

CREATE OR REPLACE FUNCTION public.protect_signed_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    IF NEW.status IS DISTINCT FROM 'signed' THEN
      RAISE EXCEPTION 'A signed agreement cannot be changed.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.signed_text IS DISTINCT FROM OLD.signed_text
       OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
       OR NEW.client1_name IS DISTINCT FROM OLD.client1_name
       OR NEW.client2_name IS DISTINCT FROM OLD.client2_name
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.client_signed_ip IS DISTINCT FROM OLD.client_signed_ip
       OR NEW.client_signed_user_agent IS DISTINCT FROM OLD.client_signed_user_agent
       OR NEW.photo_opt_out IS DISTINCT FROM OLD.photo_opt_out
       OR NEW.access_token IS DISTINCT FROM OLD.access_token
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.render_fields IS DISTINCT FROM OLD.render_fields
       OR NEW.package_fee_cents IS DISTINCT FROM OLD.package_fee_cents
       OR NEW.travel_fee_cents IS DISTINCT FROM OLD.travel_fee_cents
       OR NEW.additional_fees_cents IS DISTINCT FROM OLD.additional_fees_cents
       OR NEW.discount_cents IS DISTINCT FROM OLD.discount_cents
       OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
       OR NEW.retainer_cents IS DISTINCT FROM OLD.retainer_cents
       OR NEW.balance_cents IS DISTINCT FROM OLD.balance_cents
       OR NEW.final_payment_due_on IS DISTINCT FROM OLD.final_payment_due_on
       OR NEW.booking_code IS DISTINCT FROM OLD.booking_code
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
    THEN
      RAISE EXCEPTION 'A signed agreement is locked.' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.musician_signed_at IS NOT NULL AND (
      NEW.musician_signed_at IS DISTINCT FROM OLD.musician_signed_at
      OR NEW.musician_signed_name IS DISTINCT FROM OLD.musician_signed_name
      OR NEW.executed_text IS DISTINCT FROM OLD.executed_text
    ) THEN
      RAISE EXCEPTION 'The musician signature is already recorded.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.status = 'signed' AND OLD.status NOT IN ('sent', 'viewed') THEN
    RAISE EXCEPTION 'This agreement is not open for signature.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_protect_signed ON public.contracts;
CREATE TRIGGER contracts_protect_signed
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_contract();

REVOKE ALL ON FUNCTION public.protect_signed_contract() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_signed_contract() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.payment_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  booking_code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retainer', 'balance')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
  due_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.payment_obligations IS
  'Open retainer and balance amounts. Phase 2 can match a Chase Zelle alert with: booking_code = memo code AND amount_cents = alert amount AND status = open. When both halves are the same amount, prefer kind = retainer while it is still open. This table does not take payment.';

CREATE UNIQUE INDEX IF NOT EXISTS payment_obligations_one_open_kind
  ON public.payment_obligations (booking_id, kind)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS payment_obligations_open_match
  ON public.payment_obligations (booking_code, amount_cents)
  WHERE status = 'open';

ALTER TABLE public.payment_obligations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_obligations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_obligations TO authenticated;
GRANT ALL ON TABLE public.payment_obligations TO service_role;

DROP POLICY IF EXISTS "Admins can view payment_obligations" ON public.payment_obligations;
CREATE POLICY "Admins can view payment_obligations"
  ON public.payment_obligations FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can insert payment_obligations" ON public.payment_obligations;
CREATE POLICY "Admins can insert payment_obligations"
  ON public.payment_obligations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update payment_obligations" ON public.payment_obligations;
CREATE POLICY "Admins can update payment_obligations"
  ON public.payment_obligations FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete payment_obligations" ON public.payment_obligations;
CREATE POLICY "Admins can delete payment_obligations"
  ON public.payment_obligations FOR DELETE TO authenticated USING (public.is_admin());

-- Contracts already have admin policies from migration 003. Visitors still have none.
REVOKE ALL ON TABLE public.contracts FROM anon;
REVOKE ALL ON TABLE public.payment_obligations FROM anon;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins can read contract files" ON storage.objects;
CREATE POLICY "Admins can read contract files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can insert contract files" ON storage.objects;
CREATE POLICY "Admins can insert contract files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update contract files" ON storage.objects;
CREATE POLICY "Admins can update contract files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts' AND public.is_admin())
  WITH CHECK (bucket_id = 'contracts' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete contract files" ON storage.objects;
CREATE POLICY "Admins can delete contract files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND public.is_admin());
