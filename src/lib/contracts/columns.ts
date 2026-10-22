/** Columns the admin browser may read. The signing token stays on the server. */
export const CONTRACT_LIST_COLUMNS = [
  'id',
  'lead_id',
  'booking_id',
  'status',
  'template_id',
  'package_id',
  'booking_code',
  'total_cents',
  'retainer_cents',
  'balance_cents',
  'final_payment_due_on',
  'photo_opt_out',
  'client1_name',
  'client2_name',
  'signed_at',
  'musician_signed_name',
  'musician_signed_at',
  'pdf_storage_path',
  'sent_at',
  'voided_at',
  'created_at',
].join(', ');

export type ContractListRow = {
  id: string;
  lead_id: string | null;
  booking_id: string | null;
  status: string;
  template_id: string | null;
  package_id: string | null;
  booking_code: string | null;
  total_cents: number | null;
  retainer_cents: number | null;
  balance_cents: number | null;
  final_payment_due_on: string | null;
  photo_opt_out: boolean;
  client1_name: string | null;
  client2_name: string | null;
  signed_at: string | null;
  musician_signed_name: string | null;
  musician_signed_at: string | null;
  pdf_storage_path: string | null;
  sent_at: string | null;
  voided_at: string | null;
  created_at: string;
};
