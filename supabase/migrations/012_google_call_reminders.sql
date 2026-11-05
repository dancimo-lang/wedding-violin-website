-- 012: let the existing Google sync queue carry call reminders.
-- NOT APPLIED. The owner runs this on the live database. Do not apply it from a preview.
--
-- Call-by dates stay on leads.next_follow_up_date. The Google event id stays in
-- google_event_links, the same place booking events already live. The checks
-- below are the only reason a migration is required.

ALTER TABLE public.google_event_links DROP CONSTRAINT IF EXISTS google_event_links_source_table_check;
ALTER TABLE public.google_event_links
  ADD CONSTRAINT google_event_links_source_table_check
  CHECK (source_table IN ('bookings', 'availability_blocks', 'leads'));

ALTER TABLE public.google_sync_outbox DROP CONSTRAINT IF EXISTS google_sync_outbox_source_table_check;
ALTER TABLE public.google_sync_outbox
  ADD CONSTRAINT google_sync_outbox_source_table_check
  CHECK (source_table IN ('bookings', 'availability_blocks', 'leads'));

COMMENT ON TABLE public.google_event_links IS
  'Maps a booking, manual block, or call reminder to the Google event id derived from that row.';
