-- Full lead records, a private activity timeline, and calendar rules.
-- Public availability is answered by the server with the service role key.
-- Visitors never receive permission to read these tables.

ALTER TABLE public.clients ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inquiry_source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS requested_services TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(10,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contract_status TEXT NOT NULL DEFAULT 'Not Sent';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Unpaid';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inquiry_details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS performers_needed INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS performers_needed INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.availability_blocks ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.availability_blocks ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.availability_blocks ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.leads'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND con.conname NOT ILIKE '%contract%'
      AND con.conname NOT ILIKE '%payment%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check CHECK (status IN (
    'New Inquiry',
    'Needs Information',
    'Quote Sent',
    'Awaiting Response',
    'Contract Sent',
    'Awaiting Retainer',
    'Confirmed',
    'Lost',
    'Completed'
  ));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_contract_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_contract_status_check CHECK (contract_status IN ('Not Sent', 'Sent', 'Signed', 'Declined'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_payment_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_payment_status_check CHECK (payment_status IN ('Unpaid', 'Retainer Received', 'Paid', 'Refunded'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_inquiry_source_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_inquiry_source_check CHECK (
    inquiry_source IS NULL OR inquiry_source IN ('website', 'phone', 'email', 'instagram', 'referral', 'other')
  );

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_performers_needed_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_performers_needed_check CHECK (performers_needed BETWEEN 1 AND 12);

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_performers_needed_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_performers_needed_check CHECK (performers_needed BETWEEN 1 AND 12);

UPDATE public.leads
SET requested_services = service_type
WHERE requested_services IS NULL AND service_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  setup_buffer_minutes INTEGER NOT NULL DEFAULT 30 CHECK (setup_buffer_minutes BETWEEN 0 AND 720),
  breakdown_buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (breakdown_buffer_minutes BETWEEN 0 AND 720),
  travel_buffer_minutes INTEGER NOT NULL DEFAULT 90 CHECK (travel_buffer_minutes BETWEEN 0 AND 720),
  performer_count INTEGER NOT NULL DEFAULT 1 CHECK (performer_count BETWEEN 1 AND 12),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.business_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.business_settings IS
  'Calendar buffers and roster size. Times are interpreted in America/Los_Angeles.';

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'inquiry',
    'note',
    'status_change',
    'communication',
    'quote',
    'contract',
    'payment',
    'email',
    'calendar'
  )),
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_events IS
  'Timeline for a lead or booking. Later quotes, contracts, payments, and automated emails use the same table.';

INSERT INTO public.activity_events (lead_id, booking_id, event_type, title, body, occurred_at, created_by)
SELECT
  note.lead_id,
  note.booking_id,
  CASE WHEN note.note_type = 'Internal' THEN 'note' ELSE 'communication' END,
  note.note_type,
  note.content,
  note.created_at,
  note.created_by
FROM public.notes note
WHERE NOT EXISTS (
  SELECT 1 FROM public.activity_events existing
  WHERE existing.body = note.content
    AND existing.occurred_at = note.created_at
    AND existing.lead_id IS NOT DISTINCT FROM note.lead_id
    AND existing.booking_id IS NOT DISTINCT FROM note.booking_id
);

INSERT INTO public.activity_events (lead_id, event_type, title, body, occurred_at, metadata)
SELECT id, 'inquiry', 'Inquiry received', message, created_at, jsonb_build_object('imported', true)
FROM public.leads
WHERE message IS NOT NULL
  AND btrim(message) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.activity_events existing
    WHERE existing.lead_id = leads.id AND existing.event_type = 'inquiry'
  );

CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON public.leads (archived_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_lead ON public.activity_events (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_booking ON public.activity_events (booking_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.availability_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

ALTER TABLE public.availability_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.availability_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.availability_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_availability_check(
  p_ip_hash TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket_start TIMESTAMPTZ;
  seen INTEGER;
BEGIN
  IF p_ip_hash IS NULL OR length(p_ip_hash) < 16 OR length(p_ip_hash) > 128 THEN
    RETURN false;
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 OR p_limit < 1 OR p_limit > 100 THEN
    RETURN false;
  END IF;

  bucket_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.availability_rate_limits AS limits (ip_hash, window_start, request_count)
  VALUES (p_ip_hash, bucket_start, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET request_count = limits.request_count + 1
  RETURNING limits.request_count INTO seen;

  DELETE FROM public.availability_rate_limits AS old_limits
  WHERE old_limits.window_start < now() - interval '2 days';

  RETURN seen <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_availability_check(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_availability_check(TEXT, INTEGER, INTEGER) TO service_role;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.business_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.activity_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.business_settings TO authenticated;
GRANT ALL ON TABLE public.business_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;

DROP POLICY IF EXISTS "Admins can view business_settings" ON public.business_settings;
CREATE POLICY "Admins can view business_settings"
  ON public.business_settings FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can update business_settings" ON public.business_settings;
CREATE POLICY "Admins can update business_settings"
  ON public.business_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view activity_events" ON public.activity_events;
CREATE POLICY "Admins can view activity_events"
  ON public.activity_events FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can insert activity_events" ON public.activity_events;
CREATE POLICY "Admins can insert activity_events"
  ON public.activity_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update activity_events" ON public.activity_events;
CREATE POLICY "Admins can update activity_events"
  ON public.activity_events FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete activity_events" ON public.activity_events;
CREATE POLICY "Admins can delete activity_events"
  ON public.activity_events FOR DELETE TO authenticated USING (public.is_admin());
