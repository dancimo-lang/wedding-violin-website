export const LEAD_STATUSES = [
  'New Inquiry',
  'Needs Information',
  'Quote Sent',
  'Awaiting Response',
  'Contract Sent',
  'Awaiting Retainer',
  'Confirmed',
  'Lost',
  'Completed',
] as const;

export const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Signed', 'Declined'] as const;
export const PAYMENT_STATUSES = ['Unpaid', 'Retainer Received', 'Paid', 'Refunded'] as const;

export const INQUIRY_SOURCES = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const;

export const HOW_FOUND_OPTIONS = [
  'Google',
  'Instagram',
  'Referral',
  'Wedding vendor',
  'Returning client',
  'Other',
] as const;

export const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export type LeadDraft = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  partnerName: string;
  inquirySource: string;
  status: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  requestedServices: string;
  performanceStart: string;
  performanceEnd: string;
  estimatedDuration: string;
  guestCount: string;
  budget: string;
  howFound: string;
  message: string;
  quotedPrice: string;
  contractStatus: string;
  paymentStatus: string;
  nextFollowUp: string;
  performersNeeded: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  partner_name: string | null;
};

export function emptyLeadDraft(): LeadDraft {
  return {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    partnerName: '',
    inquirySource: 'phone',
    status: 'New Inquiry',
    eventDate: '',
    venueName: '',
    venueAddress: '',
    requestedServices: '',
    performanceStart: '',
    performanceEnd: '',
    estimatedDuration: '',
    guestCount: '',
    budget: '',
    howFound: '',
    message: '',
    quotedPrice: '',
    contractStatus: 'Not Sent',
    paymentStatus: 'Unpaid',
    nextFollowUp: '',
    performersNeeded: '1',
  };
}

export function statusClass(status: string) {
  switch (status) {
    case 'New Inquiry':
      return 'bg-blue-100 text-blue-800';
    case 'Needs Information':
      return 'bg-yellow-100 text-yellow-800';
    case 'Quote Sent':
      return 'bg-purple-100 text-purple-800';
    case 'Awaiting Response':
      return 'bg-orange-100 text-orange-800';
    case 'Contract Sent':
      return 'bg-indigo-100 text-indigo-800';
    case 'Awaiting Retainer':
      return 'bg-pink-100 text-pink-800';
    case 'Confirmed':
      return 'bg-green-100 text-green-800';
    case 'Completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'Lost':
      return 'bg-red-100 text-red-800';
    case 'Tentative':
      return 'bg-amber-100 text-amber-800';
    case 'Cancelled':
      return 'bg-gray-200 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function sourceLabel(source: string | null | undefined) {
  return INQUIRY_SOURCES.find((item) => item.value === source)?.label || source || '—';
}

function blank(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function durationFromTimes(start: string, end: string) {
  if (!start || !end) return null;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return null;
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

export function leadWritePayload(draft: LeadDraft) {
  const email = draft.clientEmail.trim().toLowerCase();
  if (!draft.clientName.trim()) return { ok: false as const, error: 'Enter the client name.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Enter a valid email, or leave it blank.' };
  }
  const performers = Number(draft.performersNeeded);
  if (!Number.isInteger(performers) || performers < 1 || performers > 12) {
    return { ok: false as const, error: 'Musicians needed must be from 1 to 12.' };
  }
  const budgetAmount = numberOrNull(draft.budget);
  const duration = draft.estimatedDuration.trim()
    ? numberOrNull(draft.estimatedDuration)
    : durationFromTimes(draft.performanceStart, draft.performanceEnd);

  return {
    ok: true as const,
    client: {
      name: draft.clientName.trim(),
      email: email || null,
      phone: blank(draft.clientPhone),
      partner_name: blank(draft.partnerName),
    },
    lead: {
      status: draft.status,
      inquiry_source: draft.inquirySource || null,
      event_date: draft.eventDate || null,
      venue_name: blank(draft.venueName),
      venue_address: blank(draft.venueAddress),
      service_type: blank(draft.requestedServices),
      requested_services: blank(draft.requestedServices),
      performance_start_time: draft.performanceStart || null,
      performance_end_time: draft.performanceEnd || null,
      estimated_duration_hours: duration,
      guest_count: draft.guestCount.trim() ? numberOrNull(draft.guestCount) : null,
      budget_range: blank(draft.budget),
      budget_amount: budgetAmount,
      how_they_found_us: blank(draft.howFound),
      message: blank(draft.message),
      quoted_price: draft.quotedPrice.trim() ? numberOrNull(draft.quotedPrice) : null,
      contract_status: draft.contractStatus,
      payment_status: draft.paymentStatus,
      next_follow_up_date: draft.nextFollowUp || null,
      performers_needed: performers,
    },
  };
}

export function draftFromRecords(
  lead: Record<string, unknown>,
  client: ClientRecord | null,
): LeadDraft {
  const text = (key: string) => (typeof lead[key] === 'string' || typeof lead[key] === 'number' ? String(lead[key] ?? '') : '');
  const time = (key: string) => text(key).slice(0, 5);
  return {
    clientName: client?.name || '',
    clientEmail: client?.email || '',
    clientPhone: client?.phone || '',
    partnerName: client?.partner_name || '',
    inquirySource: text('inquiry_source') || 'other',
    status: text('status') || 'New Inquiry',
    eventDate: text('event_date'),
    venueName: text('venue_name'),
    venueAddress: text('venue_address'),
    requestedServices: text('requested_services') || text('service_type'),
    performanceStart: time('performance_start_time'),
    performanceEnd: time('performance_end_time'),
    estimatedDuration: text('estimated_duration_hours'),
    guestCount: text('guest_count'),
    budget: text('budget_range') || text('budget_amount'),
    howFound: text('how_they_found_us'),
    message: text('message'),
    quotedPrice: text('quoted_price'),
    contractStatus: text('contract_status') || 'Not Sent',
    paymentStatus: text('payment_status') || 'Unpaid',
    nextFollowUp: text('next_follow_up_date'),
    performersNeeded: text('performers_needed') || '1',
  };
}
