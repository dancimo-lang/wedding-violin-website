-- Soft-cancel bookings and keep a lead's status in step with its booking.
-- Safe to run after 005. Re-running this file replaces the functions and triggers.
--
-- Status vocabulary already in the database:
--   booking: Tentative, Confirmed, Cancelled, Completed
--   lead:    New Inquiry, Needs Information, Quote Sent, Awaiting Response,
--            Contract Sent, Awaiting Retainer, Confirmed, Lost, Completed
-- There is no "Cancelled" lead status. Cancelling the last occupying booking
-- moves that lead to Lost.
--
-- The decision rules match src/lib/schedule/booking-status.ts.
-- Setting a booking to Cancelled also makes migration 005's bookings_google_sync
-- trigger enqueue operation 'delete', which clears the mirrored Google event.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status_before_cancel TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS lead_status_before_cancel TEXT;

COMMENT ON COLUMN public.bookings.cancelled_at IS
  'When the booking was cancelled. The row stays so the timeline is kept.';
COMMENT ON COLUMN public.bookings.cancelled_by IS
  'Admin user who cancelled the booking. Set only by sync_booking_and_lead().';
COMMENT ON COLUMN public.bookings.cancel_reason IS
  'Optional note recorded when the booking was cancelled.';

UPDATE public.bookings
SET cancelled_at = COALESCE(cancelled_at, updated_at, created_at, NOW())
WHERE status = 'Cancelled'
  AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_active_event_date
  ON public.bookings (event_date)
  WHERE status IN ('Tentative', 'Confirmed', 'Completed');

-- A manual delete must not erase the timeline. The app does not delete bookings.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.activity_events'::regclass
      AND con.contype = 'f'
      AND att.attname = 'booking_id'
  LOOP
    EXECUTE format('ALTER TABLE public.activity_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.normalize_place(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(COALESCE(value, '')), '&', ' and ', 'g'),
          '[^a-z0-9]+', ' ', 'g'
        ),
        ' +', ' ', 'g'
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.synced_lead_status(
  p_booking_statuses text[],
  p_previous_lead_status text,
  p_preferred_pipeline text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  statuses text[];
  preferred text;
BEGIN
  statuses := COALESCE(p_booking_statuses, ARRAY[]::text[]);
  IF 'Confirmed' = ANY (statuses) THEN
    RETURN 'Confirmed';
  END IF;
  IF 'Completed' = ANY (statuses) THEN
    RETURN 'Completed';
  END IF;
  IF 'Tentative' = ANY (statuses) THEN
    preferred := p_preferred_pipeline;
    IF preferred IN (
      'New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response',
      'Contract Sent', 'Awaiting Retainer'
    ) THEN
      RETURN preferred;
    END IF;
    IF p_previous_lead_status IN (
      'New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response',
      'Contract Sent', 'Awaiting Retainer'
    ) THEN
      RETURN p_previous_lead_status;
    END IF;
    RETURN 'Awaiting Response';
  END IF;
  RETURN 'Lost';
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_conflict_reason(
  p_booking_id uuid,
  p_event_date date,
  p_start time,
  p_end time,
  p_venue_address text,
  p_venue_name text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_setup integer := 30;
  v_breakdown integer := 15;
  v_travel integer := 90;
  v_start timestamptz;
  v_end timestamptz;
  v_end_date date;
  v_missing boolean;
  other record;
  o_start timestamptz;
  o_end timestamptz;
  o_end_date date;
  o_missing boolean;
  v_gap numeric;
  addr_a text;
  addr_b text;
BEGIN
  SELECT
    COALESCE(settings.setup_buffer_minutes, 30),
    COALESCE(settings.breakdown_buffer_minutes, 15),
    COALESCE(settings.travel_buffer_minutes, 90)
  INTO v_setup, v_breakdown, v_travel
  FROM public.business_settings AS settings
  WHERE settings.id = 1;

  IF NOT FOUND THEN
    v_setup := 30;
    v_breakdown := 15;
    v_travel := 90;
  END IF;

  v_missing := p_start IS NULL OR p_end IS NULL OR p_event_date IS NULL;
  IF NOT v_missing THEN
    v_end_date := p_event_date;
    IF p_end <= p_start THEN
      v_end_date := p_event_date + 1;
    END IF;
    v_start := ((p_event_date + p_start) AT TIME ZONE 'America/Los_Angeles')
      - make_interval(mins => v_setup);
    v_end := ((v_end_date + p_end) AT TIME ZONE 'America/Los_Angeles')
      + make_interval(mins => v_breakdown);
    IF v_end <= v_start THEN
      v_missing := true;
    END IF;
  END IF;

  FOR other IN
    SELECT
      bookings.id,
      bookings.event_date,
      bookings.performance_start_time,
      bookings.performance_end_time,
      bookings.venue_address
    FROM public.bookings AS bookings
    WHERE bookings.status IN ('Tentative', 'Confirmed', 'Completed')
      AND bookings.id IS DISTINCT FROM p_booking_id
      AND p_event_date IS NOT NULL
      AND bookings.event_date BETWEEN p_event_date - 1 AND p_event_date + 1
    ORDER BY bookings.id
  LOOP
    o_missing := other.performance_start_time IS NULL OR other.performance_end_time IS NULL;
    IF NOT o_missing THEN
      o_end_date := other.event_date;
      IF other.performance_end_time <= other.performance_start_time THEN
        o_end_date := other.event_date + 1;
      END IF;
      o_start := ((other.event_date + other.performance_start_time) AT TIME ZONE 'America/Los_Angeles')
        - make_interval(mins => v_setup);
      o_end := ((o_end_date + other.performance_end_time) AT TIME ZONE 'America/Los_Angeles')
        + make_interval(mins => v_breakdown);
      IF o_end <= o_start THEN
        o_missing := true;
      END IF;
    END IF;

    IF v_missing OR o_missing THEN
      IF other.event_date = p_event_date THEN
        RETURN 'A start and end time are needed before this can be confirmed, because another booking is already on that date.';
      END IF;
      CONTINUE;
    END IF;

    IF v_start < o_end AND o_start < v_end THEN
      RETURN 'That time overlaps another booking, including setup and breakdown. Cancel or move the other booking first.';
    END IF;

    IF v_end <= o_start THEN
      v_gap := EXTRACT(EPOCH FROM (o_start - v_end)) / 60.0;
    ELSIF o_end <= v_start THEN
      v_gap := EXTRACT(EPOCH FROM (v_start - o_end)) / 60.0;
    ELSE
      CONTINUE;
    END IF;

    IF v_gap >= v_travel THEN
      CONTINUE;
    END IF;

    addr_a := public.normalize_place(p_venue_address);
    addr_b := public.normalize_place(other.venue_address);
    IF addr_a IS NOT NULL AND addr_b IS NOT NULL AND addr_a IS DISTINCT FROM addr_b THEN
      RETURN 'There is not enough travel time between this booking and another one.';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_booking_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(874521);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_booking_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_check boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_booking_hard_delete', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Bookings are cancelled, not deleted, so the timeline stays.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF current_setting('app.booking_status_sync', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Bookings are saved from the server so the lead and the calendar stay in step.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason
       OR NEW.status_before_cancel IS DISTINCT FROM OLD.status_before_cancel
       OR NEW.lead_status_before_cancel IS DISTINCT FROM OLD.lead_status_before_cancel
    THEN
      RAISE EXCEPTION 'Booking status and cancellation are changed only through the booking status step.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('Confirmed', 'Completed') THEN
    v_check := true;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM 'Cancelled' THEN
    v_check := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('Confirmed', 'Completed') AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.event_date IS DISTINCT FROM NEW.event_date
    OR OLD.performance_start_time IS DISTINCT FROM NEW.performance_start_time
    OR OLD.performance_end_time IS DISTINCT FROM NEW.performance_end_time
    OR OLD.venue_address IS DISTINCT FROM NEW.venue_address
  ) THEN
    v_check := true;
  END IF;

  IF v_check THEN
    v_reason := public.booking_conflict_reason(
      NEW.id,
      NEW.event_date,
      NEW.performance_start_time,
      NEW.performance_end_time,
      NEW.venue_address,
      NEW.venue_name
    );
    IF v_reason IS NOT NULL THEN
      RAISE EXCEPTION '%', v_reason USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_lead_status_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.booking_status_sync', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' AND NEW.status IN ('Confirmed', 'Completed') THEN
      RAISE EXCEPTION 'Confirm the booking from the server so the calendar blocks that date.'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Lead status is updated together with the booking, from the server.'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.archived_at IS NOT NULL
       AND OLD.archived_at IS NULL
       AND EXISTS (
         SELECT 1
         FROM public.bookings
         WHERE lead_id = NEW.id
           AND status IN ('Tentative', 'Confirmed')
       )
    THEN
      RAISE EXCEPTION 'This lead has an active booking. Cancel the booking before archiving.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_booking_cancelled(
  p_booking_id uuid,
  p_reason text,
  p_actor uuid
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_previous text;
  v_lead_status text;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not find that booking.' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.status = 'Cancelled' THEN
    RETURN v_booking;
  END IF;

  v_previous := v_booking.status;
  SELECT status INTO v_lead_status FROM public.leads WHERE id = v_booking.lead_id;

  UPDATE public.bookings
  SET
    status = 'Cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_actor,
    cancel_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
    status_before_cancel = v_previous,
    lead_status_before_cancel = v_lead_status,
    updated_at = NOW()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.activity_events (
    lead_id, booking_id, event_type, title, body, metadata, created_by
  ) VALUES (
    v_booking.lead_id,
    v_booking.id,
    'calendar',
    'Booking cancelled',
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    jsonb_build_object('action', 'booking_cancelled', 'previous_status', v_previous),
    p_actor
  );

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_lead_status(
  p_lead_id uuid,
  p_preferred_pipeline text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous text;
  v_statuses text[];
  v_next text;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT status INTO v_previous FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(array_agg(bookings.status), ARRAY[]::text[])
  INTO v_statuses
  FROM public.bookings AS bookings
  WHERE bookings.lead_id = p_lead_id
    AND bookings.status <> 'Cancelled';
  v_next := public.synced_lead_status(v_statuses, v_previous, p_preferred_pipeline);
  UPDATE public.leads
  SET status = v_next, updated_at = NOW()
  WHERE id = p_lead_id;
  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_booking_and_lead(
  p_action text,
  p_booking_id uuid,
  p_lead_id uuid,
  p_status text,
  p_reason text,
  p_actor uuid,
  p_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_old_status text;
  v_new_status text;
  v_lead_status text;
  v_preferred text;
  v_event_date date;
  v_start time;
  v_end time;
  v_setup time;
  v_breakdown time;
  v_venue_name text;
  v_venue_address text;
  v_service text;
  v_performers integer;
  v_price numeric;
  v_retainer numeric;
  v_retainer_due date;
  v_balance_due date;
  v_travel numeric;
  v_requests text;
  v_client_id uuid;
  v_lead_id uuid;
  v_title text;
  v_blocking text;
  v_cancelled_any boolean := false;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_actor) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN
    RAISE EXCEPTION 'The cancellation reason must be 500 characters or fewer.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.booking_status_sync', 'on', true);
  PERFORM pg_advisory_xact_lock(874521);
  p_fields := COALESCE(p_fields, '{}'::jsonb);

  IF p_action = 'archive_lead' THEN
    SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE lead_id = p_lead_id AND status IN ('Tentative', 'Confirmed')
    ) THEN
      RAISE EXCEPTION 'This lead has an active booking. Cancel the booking before archiving.'
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.leads
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = p_lead_id;
    INSERT INTO public.activity_events (lead_id, event_type, title, body, created_by)
    VALUES (
      p_lead_id,
      'status_change',
      'Lead archived',
      'Archived leads stay out of the open list. A cancelled booking stays on the timeline and does not block the calendar.',
      p_actor
    );
    RETURN jsonb_build_object(
      'ok', true, 'booking_id', NULL, 'booking_status', NULL,
      'lead_id', p_lead_id, 'lead_status', v_lead.status
    );
  END IF;

  IF p_action = 'restore_lead' THEN
    SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.leads
    SET archived_at = NULL, updated_at = NOW()
    WHERE id = p_lead_id;
    INSERT INTO public.activity_events (lead_id, event_type, title, created_by)
    VALUES (p_lead_id, 'status_change', 'Lead restored', p_actor);
    RETURN jsonb_build_object(
      'ok', true, 'booking_id', NULL, 'booking_status', NULL,
      'lead_id', p_lead_id, 'lead_status', v_lead.status
    );
  END IF;

  IF p_action = 'set_lead_status' THEN
    IF p_status IS NULL OR p_status NOT IN (
      'New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response',
      'Contract Sent', 'Awaiting Retainer', 'Confirmed', 'Lost', 'Completed'
    ) THEN
      RAISE EXCEPTION 'That lead status is not one this site uses.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
    END IF;
    IF p_status NOT IN ('Confirmed', 'Lost', 'Completed') THEN
      SELECT bookings.status
      INTO v_blocking
      FROM public.bookings AS bookings
      WHERE bookings.lead_id = p_lead_id
        AND bookings.status IN ('Confirmed', 'Completed')
      ORDER BY CASE bookings.status WHEN 'Confirmed' THEN 0 ELSE 1 END
      LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'This lead has a % booking. Cancel the booking before changing the lead to %.',
          lower(v_blocking), p_status
          USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.leads SET status = p_status, updated_at = NOW() WHERE id = p_lead_id;
      IF v_lead.status IS DISTINCT FROM p_status THEN
        INSERT INTO public.activity_events (lead_id, event_type, title, body, created_by)
        VALUES (
          p_lead_id, 'status_change', 'Record updated',
          'Status changed from ' || v_lead.status || ' to ' || p_status || '.',
          p_actor
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'booking_id', NULL, 'booking_status', NULL,
        'lead_id', p_lead_id, 'lead_status', p_status
      );
    END IF;

    IF p_status = 'Lost' THEN
      IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE lead_id = p_lead_id AND status = 'Completed'
      ) THEN
        RAISE EXCEPTION 'This lead has a completed booking. Leave the lead as Completed, or cancel that booking first.'
          USING ERRCODE = 'P0001';
      END IF;
      FOR v_booking IN
        SELECT * FROM public.bookings
        WHERE lead_id = p_lead_id AND status IN ('Tentative', 'Confirmed')
        ORDER BY id
      LOOP
        PERFORM public.mark_booking_cancelled(v_booking.id, p_reason, p_actor);
        v_cancelled_any := true;
      END LOOP;
      UPDATE public.leads SET status = 'Lost', updated_at = NOW() WHERE id = p_lead_id;
      IF NOT v_cancelled_any AND v_lead.status IS DISTINCT FROM 'Lost' THEN
        INSERT INTO public.activity_events (lead_id, event_type, title, body, created_by)
        VALUES (
          p_lead_id, 'status_change', 'Record updated',
          'Status changed from ' || v_lead.status || ' to Lost.',
          p_actor
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'booking_id', NULL,
        'booking_status', CASE WHEN v_cancelled_any THEN 'Cancelled' ELSE NULL END,
        'lead_id', p_lead_id, 'lead_status', 'Lost'
      );
    END IF;

    SELECT bookings.id
    INTO p_booking_id
    FROM public.bookings AS bookings
    WHERE bookings.lead_id = p_lead_id
      AND bookings.status <> 'Cancelled'
    ORDER BY bookings.created_at DESC
    LIMIT 1;

    IF p_booking_id IS NULL AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE lead_id = p_lead_id AND status = 'Cancelled'
    ) THEN
      IF p_status = 'Confirmed' THEN
        RAISE EXCEPTION 'This lead''s booking is cancelled. Restore the booking before marking the lead confirmed.'
          USING ERRCODE = 'P0001';
      END IF;
      RAISE EXCEPTION 'This lead''s booking is cancelled. Restore the booking before marking the lead completed.'
        USING ERRCODE = 'P0001';
    END IF;

    IF p_status = 'Completed' AND p_booking_id IS NULL THEN
      UPDATE public.leads SET status = 'Completed', updated_at = NOW() WHERE id = p_lead_id;
      IF v_lead.status IS DISTINCT FROM 'Completed' THEN
        INSERT INTO public.activity_events (lead_id, event_type, title, body, created_by)
        VALUES (
          p_lead_id, 'status_change', 'Record updated',
          'Status changed from ' || v_lead.status || ' to Completed.',
          p_actor
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'booking_id', NULL, 'booking_status', NULL,
        'lead_id', p_lead_id, 'lead_status', 'Completed'
      );
    END IF;

    IF p_booking_id IS NULL THEN
      IF v_lead.client_id IS NULL THEN
        RAISE EXCEPTION 'Add a client before confirming this lead.' USING ERRCODE = 'P0001';
      END IF;
      p_fields := p_fields || jsonb_build_object(
        'client_id', v_lead.client_id,
        'lead_id', v_lead.id,
        'event_date', COALESCE(NULLIF(p_fields->>'event_date', ''), v_lead.event_date::text),
        'venue_name', COALESCE(NULLIF(p_fields->>'venue_name', ''), v_lead.venue_name),
        'venue_address', COALESCE(NULLIF(p_fields->>'venue_address', ''), v_lead.venue_address),
        'service_type', COALESCE(
          NULLIF(p_fields->>'service_type', ''),
          NULLIF(v_lead.service_type, ''),
          NULLIF(v_lead.requested_services, ''),
          'Performance'
        ),
        'performance_start_time', COALESCE(NULLIF(p_fields->>'performance_start_time', ''), v_lead.performance_start_time::text),
        'performance_end_time', COALESCE(NULLIF(p_fields->>'performance_end_time', ''), v_lead.performance_end_time::text),
        'performers_needed', COALESCE(NULLIF(p_fields->>'performers_needed', '')::integer, v_lead.performers_needed, 1),
        'total_price', COALESCE(NULLIF(p_fields->>'total_price', '')::numeric, v_lead.quoted_price, 0),
        'special_requests', COALESCE(NULLIF(p_fields->>'special_requests', ''), v_lead.message)
      );
      IF NULLIF(p_fields->>'event_date', '') IS NULL THEN
        RAISE EXCEPTION 'Add an event date before confirming this lead.' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    p_action := 'apply_booking';
  END IF;

  IF p_action = 'restore_booking' THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not find that booking.' USING ERRCODE = 'P0001';
    END IF;
    IF v_booking.status <> 'Cancelled' THEN
      RAISE EXCEPTION 'Only a cancelled booking can be restored.' USING ERRCODE = 'P0001';
    END IF;
    v_preferred := v_booking.lead_status_before_cancel;
    v_new_status := COALESCE(NULLIF(v_booking.status_before_cancel, ''), 'Tentative');
    IF v_new_status NOT IN ('Tentative', 'Confirmed', 'Completed') THEN
      v_new_status := 'Tentative';
    END IF;
    UPDATE public.bookings
    SET
      status = v_new_status,
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancel_reason = NULL,
      status_before_cancel = NULL,
      lead_status_before_cancel = NULL,
      updated_at = NOW()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;
    v_lead_status := public.refresh_lead_status(v_booking.lead_id, v_preferred);
    INSERT INTO public.activity_events (lead_id, booking_id, event_type, title, body, created_by)
    VALUES (
      v_booking.lead_id, v_booking.id, 'calendar', 'Booking restored.',
      v_booking.event_date::text, p_actor
    );
    RETURN jsonb_build_object(
      'ok', true,
      'booking_id', v_booking.id,
      'booking_status', v_booking.status,
      'lead_id', v_booking.lead_id,
      'lead_status', v_lead_status
    );
  END IF;

  IF p_action <> 'apply_booking' THEN
    RAISE EXCEPTION 'Unknown booking action.' USING ERRCODE = 'P0001';
  END IF;

  v_new_status := COALESCE(p_status, 'Tentative');
  IF v_new_status NOT IN ('Tentative', 'Confirmed', 'Cancelled', 'Completed') THEN
    RAISE EXCEPTION 'That booking status is not one this site uses.' USING ERRCODE = 'P0001';
  END IF;

  IF p_booking_id IS NOT NULL AND v_new_status = 'Cancelled' THEN
    v_booking := public.mark_booking_cancelled(p_booking_id, p_reason, p_actor);
    v_lead_status := public.refresh_lead_status(v_booking.lead_id, NULL);
    RETURN jsonb_build_object(
      'ok', true,
      'booking_id', v_booking.id,
      'booking_status', v_booking.status,
      'lead_id', v_booking.lead_id,
      'lead_status', v_lead_status
    );
  END IF;

  IF p_booking_id IS NULL THEN
    v_old_status := NULL;
    v_client_id := NULLIF(p_fields->>'client_id', '')::uuid;
    v_lead_id := COALESCE(p_lead_id, NULLIF(p_fields->>'lead_id', '')::uuid);
    v_event_date := NULL;
    v_venue_name := NULL;
    v_venue_address := NULL;
    v_service := 'Performance';
    v_start := NULL;
    v_end := NULL;
    v_setup := NULL;
    v_breakdown := NULL;
    v_travel := NULL;
    v_price := 0;
    v_retainer := NULL;
    v_retainer_due := NULL;
    v_balance_due := NULL;
    v_requests := NULL;
    v_performers := 1;
    v_preferred := NULL;
    IF v_new_status NOT IN ('Tentative', 'Confirmed', 'Completed') THEN
      RAISE EXCEPTION 'Choose tentative, confirmed, or completed for a new booking.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not find that booking.' USING ERRCODE = 'P0001';
    END IF;
    v_old_status := v_booking.status;
    v_preferred := v_booking.lead_status_before_cancel;
    v_client_id := v_booking.client_id;
    v_lead_id := COALESCE(p_lead_id, v_booking.lead_id);
    v_event_date := v_booking.event_date;
    v_venue_name := v_booking.venue_name;
    v_venue_address := v_booking.venue_address;
    v_service := v_booking.service_type;
    v_start := v_booking.performance_start_time;
    v_end := v_booking.performance_end_time;
    v_setup := v_booking.setup_time;
    v_breakdown := v_booking.breakdown_time;
    v_travel := v_booking.travel_buffer_hours;
    v_price := v_booking.total_price;
    v_retainer := v_booking.retainer_amount;
    v_retainer_due := v_booking.retainer_due_date;
    v_balance_due := v_booking.balance_due_date;
    v_requests := v_booking.special_requests;
    v_performers := COALESCE(v_booking.performers_needed, 1);
  END IF;

  IF p_fields ? 'client_id' AND NULLIF(p_fields->>'client_id', '') IS NOT NULL THEN
    v_client_id := (p_fields->>'client_id')::uuid;
  END IF;
  IF p_fields ? 'event_date' AND NULLIF(p_fields->>'event_date', '') IS NOT NULL THEN
    v_event_date := (p_fields->>'event_date')::date;
  END IF;
  IF p_fields ? 'venue_name' THEN
    v_venue_name := NULLIF(p_fields->>'venue_name', '');
  END IF;
  IF p_fields ? 'venue_address' THEN
    v_venue_address := NULLIF(p_fields->>'venue_address', '');
  END IF;
  IF p_fields ? 'service_type' AND NULLIF(p_fields->>'service_type', '') IS NOT NULL THEN
    v_service := p_fields->>'service_type';
  END IF;
  IF p_fields ? 'performance_start_time' THEN
    v_start := NULLIF(p_fields->>'performance_start_time', '')::time;
  END IF;
  IF p_fields ? 'performance_end_time' THEN
    v_end := NULLIF(p_fields->>'performance_end_time', '')::time;
  END IF;
  IF p_fields ? 'setup_time' THEN
    v_setup := NULLIF(p_fields->>'setup_time', '')::time;
  END IF;
  IF p_fields ? 'breakdown_time' THEN
    v_breakdown := NULLIF(p_fields->>'breakdown_time', '')::time;
  END IF;
  IF p_fields ? 'travel_buffer_hours' THEN
    v_travel := NULLIF(p_fields->>'travel_buffer_hours', '')::numeric;
  END IF;
  IF p_fields ? 'total_price' AND NULLIF(p_fields->>'total_price', '') IS NOT NULL THEN
    v_price := (p_fields->>'total_price')::numeric;
  END IF;
  IF p_fields ? 'retainer_amount' THEN
    v_retainer := NULLIF(p_fields->>'retainer_amount', '')::numeric;
  END IF;
  IF p_fields ? 'retainer_due_date' THEN
    v_retainer_due := NULLIF(p_fields->>'retainer_due_date', '')::date;
  END IF;
  IF p_fields ? 'balance_due_date' THEN
    v_balance_due := NULLIF(p_fields->>'balance_due_date', '')::date;
  END IF;
  IF p_fields ? 'special_requests' THEN
    v_requests := NULLIF(p_fields->>'special_requests', '');
  END IF;
  IF p_fields ? 'performers_needed' AND NULLIF(p_fields->>'performers_needed', '') IS NOT NULL THEN
    v_performers := (p_fields->>'performers_needed')::integer;
  END IF;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'A client is required.' USING ERRCODE = 'P0001';
  END IF;
  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Add an event date before saving this booking.' USING ERRCODE = 'P0001';
  END IF;
  IF v_performers < 1 OR v_performers > 12 THEN
    RAISE EXCEPTION 'Musicians needed must be from 1 to 12.' USING ERRCODE = 'P0001';
  END IF;
  IF v_service IS NULL OR btrim(v_service) = '' THEN
    v_service := 'Performance';
  END IF;

  IF p_booking_id IS NULL THEN
    INSERT INTO public.bookings (
      client_id, lead_id, status, event_date, venue_name, venue_address, service_type,
      performance_start_time, performance_end_time, setup_time, breakdown_time,
      travel_buffer_hours, total_price, retainer_amount, retainer_due_date, balance_due_date,
      special_requests, performers_needed
    ) VALUES (
      v_client_id, v_lead_id, v_new_status, v_event_date, v_venue_name, v_venue_address, v_service,
      v_start, v_end, v_setup, v_breakdown, v_travel, v_price, v_retainer, v_retainer_due,
      v_balance_due, v_requests, v_performers
    )
    RETURNING * INTO v_booking;
  ELSE
    UPDATE public.bookings
    SET
      client_id = v_client_id,
      lead_id = v_lead_id,
      status = v_new_status,
      event_date = v_event_date,
      venue_name = v_venue_name,
      venue_address = v_venue_address,
      service_type = v_service,
      performance_start_time = v_start,
      performance_end_time = v_end,
      setup_time = v_setup,
      breakdown_time = v_breakdown,
      travel_buffer_hours = v_travel,
      total_price = v_price,
      retainer_amount = v_retainer,
      retainer_due_date = v_retainer_due,
      balance_due_date = v_balance_due,
      special_requests = v_requests,
      performers_needed = v_performers,
      cancelled_at = CASE WHEN v_new_status = 'Cancelled' THEN cancelled_at ELSE NULL END,
      cancelled_by = CASE WHEN v_new_status = 'Cancelled' THEN cancelled_by ELSE NULL END,
      cancel_reason = CASE WHEN v_new_status = 'Cancelled' THEN cancel_reason ELSE NULL END,
      status_before_cancel = CASE WHEN v_new_status = 'Cancelled' THEN status_before_cancel ELSE NULL END,
      lead_status_before_cancel = CASE WHEN v_new_status = 'Cancelled' THEN lead_status_before_cancel ELSE NULL END,
      updated_at = NOW()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;
  END IF;

  v_title := NULL;
  IF v_booking.lead_id IS NOT NULL THEN
    SELECT status INTO v_lead_status FROM public.leads WHERE id = v_booking.lead_id;
  ELSE
    v_lead_status := NULL;
  END IF;
  IF v_new_status = 'Tentative' THEN
    v_preferred := public.refresh_lead_status(v_booking.lead_id, v_preferred);
  ELSE
    v_preferred := public.refresh_lead_status(v_booking.lead_id, NULL);
  END IF;

  IF v_old_status IS DISTINCT FROM v_booking.status THEN
    v_title := CASE v_booking.status
      WHEN 'Confirmed' THEN 'Booking confirmed. This time now blocks the calendar.'
      WHEN 'Completed' THEN 'Booking marked completed.'
      WHEN 'Tentative' THEN 'Tentative hold placed on the calendar.'
      ELSE 'Record updated'
    END;
    INSERT INTO public.activity_events (lead_id, booking_id, event_type, title, body, created_by)
    VALUES (v_booking.lead_id, v_booking.id, 'calendar', v_title, v_booking.event_date::text, p_actor);
  ELSIF v_lead_status IS DISTINCT FROM v_preferred AND v_preferred IS NOT NULL THEN
    INSERT INTO public.activity_events (lead_id, booking_id, event_type, title, body, created_by)
    VALUES (
      v_booking.lead_id,
      v_booking.id,
      'status_change',
      'Record updated',
      'Status changed from ' || COALESCE(v_lead_status, 'unset') || ' to ' || v_preferred || '.',
      p_actor
    );
  END IF;
  v_lead_status := v_preferred;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'booking_status', v_booking.status,
    'lead_id', v_booking.lead_id,
    'lead_status', v_lead_status
  );
END;
$$;

COMMENT ON FUNCTION public.sync_booking_and_lead(text, uuid, uuid, text, text, uuid, jsonb) IS
  'Admin-only transaction for booking cancel, restore, confirm, and lead status. Service role calls it after the server checks the admin session.';

DROP TRIGGER IF EXISTS bookings_lock_writes ON public.bookings;
CREATE TRIGGER bookings_lock_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.lock_booking_writes();

DROP TRIGGER IF EXISTS bookings_guard_write ON public.bookings;
CREATE TRIGGER bookings_guard_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_booking_write();

DROP TRIGGER IF EXISTS leads_guard_status_write ON public.leads;
CREATE TRIGGER leads_guard_status_write
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lead_status_write();

-- Non-admins already fail is_admin() on every booking policy.
-- Admins also cannot update status or cancellation columns from the browser.
-- Only sync_booking_and_lead(), running as the function owner, writes those columns.
REVOKE DELETE ON TABLE public.bookings FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;

REVOKE UPDATE ON TABLE public.bookings FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  lead_id,
  client_id,
  event_date,
  venue_name,
  venue_address,
  service_type,
  package_id,
  performance_start_time,
  performance_end_time,
  setup_time,
  breakdown_time,
  travel_buffer_hours,
  total_price,
  retainer_amount,
  retainer_due_date,
  balance_due_date,
  special_requests,
  performers_needed,
  updated_at
) ON public.bookings TO authenticated;

REVOKE UPDATE ON TABLE public.leads FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  client_id,
  event_date,
  venue_name,
  venue_address,
  service_type,
  package_interest,
  performance_start_time,
  performance_end_time,
  estimated_duration_hours,
  guest_count,
  budget_range,
  how_they_found_us,
  message,
  quoted_price,
  updated_at,
  next_follow_up_date,
  inquiry_source,
  requested_services,
  budget_amount,
  contract_status,
  payment_status,
  inquiry_details,
  performers_needed
) ON public.leads TO authenticated;

REVOKE ALL ON FUNCTION public.normalize_place(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_place(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.booking_conflict_reason(uuid, date, time, time, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_conflict_reason(uuid, date, time, time, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.synced_lead_status(text[], text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_booking_cancelled(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_lead_status(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lock_booking_writes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_booking_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_lead_status_write() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_booking_writes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_booking_write() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_lead_status_write() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_booking_and_lead(text, uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_booking_and_lead(text, uuid, uuid, text, text, uuid, jsonb) TO service_role;

DO $grant$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.synced_lead_status(text[], text, text) TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.mark_booking_cancelled(uuid, text, uuid) TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.refresh_lead_status(uuid, text) TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.booking_conflict_reason(uuid, date, time, time, text, text) TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.normalize_place(text) TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.lock_booking_writes() TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.guard_booking_write() TO %I', current_user);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.guard_lead_status_write() TO %I', current_user);
END
$grant$;
