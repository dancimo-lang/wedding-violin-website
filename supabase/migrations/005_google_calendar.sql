-- Google Calendar connection, event mapping, sync outbox, and busy cache.
-- The refresh token never leaves the server. Admin pages read status through
-- google_calendar_status(), which checks is_admin() and returns no secrets.
-- Busy rows store start and end only. Event titles and block reasons are not stored.

CREATE TABLE IF NOT EXISTS public.google_calendar_connection (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  google_email TEXT,
  calendar_id TEXT,
  calendar_summary TEXT,
  calendar_mode TEXT CHECK (calendar_mode IN ('dedicated', 'primary')),
  refresh_token_ciphertext TEXT,
  refresh_token_iv TEXT,
  refresh_token_tag TEXT,
  scopes TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'reconnect_required')),
  connected_at TIMESTAMPTZ,
  busy_synced_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.google_calendar_connection IS
  'Single Google connection for the site owner. Service role only. The refresh token columns are AES-256-GCM ciphertext, never a raw token.';

CREATE TABLE IF NOT EXISTS public.google_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL CHECK (source_table IN ('bookings', 'availability_blocks')),
  source_id UUID NOT NULL,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id)
);

COMMENT ON TABLE public.google_event_links IS
  'Maps a booking or manual block to the Google event id derived from that row.';

CREATE TABLE IF NOT EXISTS public.google_sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL CHECK (source_table IN ('bookings', 'availability_blocks')),
  source_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS google_sync_outbox_created_idx
  ON public.google_sync_outbox (created_at, attempts);

COMMENT ON TABLE public.google_sync_outbox IS
  'Rows waiting to be pushed to Google. Filled by triggers. Drained by the admin sync route and the cron route.';

CREATE TABLE IF NOT EXISTS public.google_busy_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS google_busy_times_range_idx
  ON public.google_busy_times (starts_at, ends_at);

COMMENT ON TABLE public.google_busy_times IS
  'Busy windows copied from the owner primary calendar. No titles, descriptions, or attendees.';

ALTER TABLE public.google_calendar_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_event_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sync_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_busy_times ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.google_calendar_connection FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.google_event_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.google_sync_outbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.google_busy_times FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.google_calendar_connection TO service_role;
GRANT ALL ON TABLE public.google_event_links TO service_role;
GRANT ALL ON TABLE public.google_sync_outbox TO service_role;
GRANT ALL ON TABLE public.google_busy_times TO service_role;

GRANT SELECT ON TABLE public.google_event_links TO authenticated;
GRANT SELECT ON TABLE public.google_busy_times TO authenticated;

DROP POLICY IF EXISTS "Admins can view google_event_links" ON public.google_event_links;
CREATE POLICY "Admins can view google_event_links"
  ON public.google_event_links
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view google_busy_times" ON public.google_busy_times;
CREATE POLICY "Admins can view google_busy_times"
  ON public.google_busy_times
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No policies on the connection or the outbox. Authenticated and anon have no grants.
-- The service role bypasses RLS and is the only writer.

CREATE OR REPLACE FUNCTION public.google_calendar_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'connected', connection.status = 'connected',
    'needs_reconnect', connection.status = 'reconnect_required',
    'email', connection.google_email,
    'calendar_summary', connection.calendar_summary,
    'calendar_mode', connection.calendar_mode,
    'busy_synced_at', connection.busy_synced_at,
    'last_error', CASE
      WHEN connection.status = 'reconnect_required' THEN connection.last_error
      ELSE NULL
    END
  )
  INTO result
  FROM public.google_calendar_connection AS connection
  WHERE connection.id = 1;

  RETURN COALESCE(result, jsonb_build_object(
    'connected', false,
    'needs_reconnect', false,
    'email', NULL,
    'calendar_summary', NULL,
    'calendar_mode', NULL,
    'busy_synced_at', NULL,
    'last_error', NULL
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.google_calendar_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_calendar_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_google_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id uuid;
  op text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    op := 'delete';
  ELSE
    row_id := NEW.id;
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'bookings' THEN
      IF OLD.status IS NOT DISTINCT FROM NEW.status
         AND OLD.event_date IS NOT DISTINCT FROM NEW.event_date
         AND OLD.performance_start_time IS NOT DISTINCT FROM NEW.performance_start_time
         AND OLD.performance_end_time IS NOT DISTINCT FROM NEW.performance_end_time
         AND OLD.venue_name IS NOT DISTINCT FROM NEW.venue_name
         AND OLD.venue_address IS NOT DISTINCT FROM NEW.venue_address
         AND OLD.service_type IS NOT DISTINCT FROM NEW.service_type
         AND OLD.client_id IS NOT DISTINCT FROM NEW.client_id
      THEN
        RETURN NEW;
      END IF;
    ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'availability_blocks' THEN
      -- Reason is private and is not copied to Google, so a reason-only edit does not sync.
      IF OLD.start_date IS NOT DISTINCT FROM NEW.start_date
         AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date
         AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
         AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time
         AND OLD.all_day IS NOT DISTINCT FROM NEW.all_day
         AND OLD.block_type IS NOT DISTINCT FROM NEW.block_type
      THEN
        RETURN NEW;
      END IF;
    END IF;

    op := 'upsert';
    IF TG_TABLE_NAME = 'bookings' AND NEW.status IS DISTINCT FROM 'Tentative'
       AND NEW.status IS DISTINCT FROM 'Confirmed'
       AND NEW.status IS DISTINCT FROM 'Completed'
    THEN
      op := 'delete';
    END IF;
  END IF;

  INSERT INTO public.google_sync_outbox (source_table, source_id, operation)
  VALUES (TG_TABLE_NAME, row_id, op);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_google_sync_for_client_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.google_sync_outbox (source_table, source_id, operation)
  SELECT 'bookings', bookings.id, 'upsert'
  FROM public.bookings
  WHERE bookings.client_id = NEW.id
    AND bookings.status IN ('Tentative', 'Confirmed', 'Completed');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_google_calendar_sync() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enqueue_google_sync_for_client_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_google_calendar_sync() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_google_sync_for_client_name() TO authenticated, service_role;

DROP TRIGGER IF EXISTS bookings_google_sync ON public.bookings;
CREATE TRIGGER bookings_google_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_google_calendar_sync();

DROP TRIGGER IF EXISTS availability_blocks_google_sync ON public.availability_blocks;
CREATE TRIGGER availability_blocks_google_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.availability_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_google_calendar_sync();

DROP TRIGGER IF EXISTS clients_google_sync_name ON public.clients;
CREATE TRIGGER clients_google_sync_name
  AFTER UPDATE OF name ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_google_sync_for_client_name();
