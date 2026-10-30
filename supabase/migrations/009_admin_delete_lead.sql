-- Hard-delete one inquiry and the records that belong to it.
-- Safe to run after 008. Do not run this from the app or a deploy.
-- Run it once in the Supabase SQL Editor after review.
-- Re-running replaces admin_delete_lead(). It does not change the booking
-- or signed-contract guards.
--
-- guard_booking_write still rejects a booking DELETE unless this function
-- has set app.allow_booking_hard_delete for its own transaction.
-- protect_signed_contract still rejects updates to a signed agreement,
-- including the lead_id clear that ON DELETE SET NULL would attempt.
-- This function deletes those agreements itself before the lead goes away.
-- activity_events.booking_id and zelle_receipts.booking_id are ON DELETE
-- SET NULL, so those rows are deleted here instead of being left behind.
--
-- Deleting a booking still runs bookings_google_sync, which queues a
-- Google Calendar delete the same way a cancellation does.

CREATE OR REPLACE FUNCTION public.admin_delete_lead(
  p_lead_id uuid,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_seen_client uuid;
  v_booking_ids uuid[];
  v_pdf_paths text[];
  v_client_deleted boolean := false;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_actor) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(874521);

  SELECT client_id
  INTO v_client_id
  FROM public.leads
  WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the client before the lead, matching the order the lead form uses
  -- when it saves a client and then the inquiry.
  IF v_client_id IS NOT NULL THEN
    PERFORM 1
    FROM public.clients
    WHERE id = v_client_id
    FOR UPDATE;
  END IF;

  SELECT client_id
  INTO v_seen_client
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not find that lead.' USING ERRCODE = 'P0001';
  END IF;
  IF v_seen_client IS DISTINCT FROM v_client_id THEN
    RAISE EXCEPTION 'This inquiry changed while it was being deleted. Try again.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(locked.id), ARRAY[]::uuid[])
  INTO v_booking_ids
  FROM (
    SELECT id
    FROM public.bookings
    WHERE lead_id = p_lead_id
    FOR UPDATE
  ) AS locked;

  SELECT COALESCE(array_agg(DISTINCT btrim(pdf_storage_path)), ARRAY[]::text[])
  INTO v_pdf_paths
  FROM public.contracts
  WHERE (lead_id = p_lead_id OR booking_id = ANY(v_booking_ids))
    AND pdf_storage_path IS NOT NULL
    AND btrim(pdf_storage_path) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    AND position('..' IN pdf_storage_path) = 0;

  -- Transaction-local. A later statement on another connection cannot see it,
  -- and it is gone when this function's transaction ends.
  PERFORM set_config('app.allow_booking_hard_delete', 'on', true);

  DELETE FROM public.activity_events
  WHERE lead_id = p_lead_id
     OR booking_id = ANY(v_booking_ids);

  DELETE FROM public.zelle_receipts
  WHERE booking_id = ANY(v_booking_ids)
     OR obligation_id IN (
       SELECT id FROM public.payment_obligations WHERE booking_id = ANY(v_booking_ids)
     )
     OR payment_id IN (
       SELECT id FROM public.payments WHERE booking_id = ANY(v_booking_ids)
     );

  -- Explicit DELETE, not the lead's ON DELETE SET NULL, so a signed agreement
  -- is removed instead of updated. protect_signed_contract blocks that update.
  DELETE FROM public.contracts
  WHERE lead_id = p_lead_id
     OR booking_id = ANY(v_booking_ids);

  DELETE FROM public.stripe_checkout_sessions
  WHERE booking_id = ANY(v_booking_ids)
     OR obligation_id IN (
       SELECT id FROM public.payment_obligations WHERE booking_id = ANY(v_booking_ids)
     );

  DELETE FROM public.payments
  WHERE booking_id = ANY(v_booking_ids);

  DELETE FROM public.payment_obligations
  WHERE booking_id = ANY(v_booking_ids);

  DELETE FROM public.notes
  WHERE lead_id = p_lead_id
     OR booking_id = ANY(v_booking_ids);

  DELETE FROM public.communications
  WHERE lead_id = p_lead_id
     OR booking_id = ANY(v_booking_ids);

  DELETE FROM public.follow_up_tasks
  WHERE lead_id = p_lead_id
     OR booking_id = ANY(v_booking_ids);

  -- bookings_google_sync queues operation 'delete' for each removed booking.
  DELETE FROM public.bookings
  WHERE id = ANY(v_booking_ids);

  DELETE FROM public.leads
  WHERE id = p_lead_id;

  IF v_client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.leads WHERE client_id = v_client_id)
     AND NOT EXISTS (SELECT 1 FROM public.bookings WHERE client_id = v_client_id)
  THEN
    DELETE FROM public.clients WHERE id = v_client_id;
    v_client_deleted := FOUND;
  END IF;

  -- Best effort, and only for paths recorded on this inquiry's agreements.
  -- A storage error must not undo the row deletes above; the server removes
  -- any file this statement could not reach.
  IF cardinality(v_pdf_paths) > 0 THEN
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = 'contracts'
        AND name = ANY(v_pdf_paths);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'lead_id', p_lead_id,
    'client_id', v_client_id,
    'client_deleted', v_client_deleted,
    'booking_ids', to_jsonb(v_booking_ids),
    'pdf_paths', to_jsonb(v_pdf_paths)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_lead(uuid, uuid) IS
  'Admin-only hard delete of one lead, its bookings, contracts, payments, and timeline. Sets app.allow_booking_hard_delete for this transaction only. Execute is limited to service_role.';

REVOKE ALL ON FUNCTION public.admin_delete_lead(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_lead(uuid, uuid) TO service_role;
