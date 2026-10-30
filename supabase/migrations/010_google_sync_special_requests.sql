-- Google Calendar event notes now include special requests, package, and the
-- partner's name, so edits to those fields must queue an event update.
-- Function bodies match 005 (and the live definitions) plus the new checks.
-- No backfill here: run it separately once the new description code is live.

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
         AND OLD.special_requests IS NOT DISTINCT FROM NEW.special_requests
         AND OLD.package_id IS NOT DISTINCT FROM NEW.package_id
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
  IF NEW.name IS NOT DISTINCT FROM OLD.name
     AND NEW.partner_name IS NOT DISTINCT FROM OLD.partner_name
  THEN
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

DROP TRIGGER IF EXISTS clients_google_sync_name ON public.clients;
CREATE TRIGGER clients_google_sync_name
  AFTER UPDATE OF name, partner_name ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_google_sync_for_client_name();
