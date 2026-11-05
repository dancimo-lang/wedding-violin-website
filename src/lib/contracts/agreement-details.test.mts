import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agreementForStorage,
  agreementGaps,
  calendarPerformanceTimes,
  agreementNote,
  buildSavedAgreement,
  contractRequestBody,
  emptyAgreement,
  formValueFromDraft,
  mergeAgreement,
  preludeAfterCeremonyChange,
  preludeFromCeremony,
  readAgreement,
  readAgreementNote,
} from './agreement-details';

const base = {
  client1Name: 'Ada',
  client2Name: '',
  email: 'ada@example.com',
  weddingDate: '2026-06-14',
  leadEventDate: '2026-06-14',
  bookingEventDate: '',
  venueName: 'Madonna Inn',
  venueAddress: '100 Madonna Road, San Luis Obispo, CA 93405',
  ceremonyStart: '16:00',
  ceremonyEnd: '17:00',
  preludeStart: '',
  preludeEnd: '',
  cocktailStart: '',
  cocktailEnd: '',
  receptionStart: '',
  receptionEnd: '',
  otherDetails: '',
  travelFee: '0',
  additionalFees: '0',
  additionalFeesDescription: '',
  discount: '0',
  eventType: '',
  performanceDescription: '',
  performanceFee: '',
  quotedPrice: null,
  datesDiffer: false,
} as const;

test('agreement json merges into inquiry details without dropping the website snapshot', () => {
  const merged = mergeAgreement(
    { source: 'website', message: 'Hello', venueAddress: 'keep me' },
    { ...emptyAgreement(), packageId: 'B', cocktailStart: '17:00', cocktailEnd: '18:00' },
  );
  assert.equal(merged.source, 'website');
  assert.equal(merged.message, 'Hello');
  assert.equal(merged.venueAddress, 'keep me');
  const agreement = readAgreement(merged);
  assert.equal(agreement.packageId, 'B');
  assert.equal(agreement.cocktailEnd, '18:00');
  assert.equal(readAgreement({ source: 'website' }).packageId, '');
});

test('agreement note is separate from a custom-song note', () => {
  const note = agreementNote({ ...emptyAgreement(), packageId: 'C', otherDetails: 'First dance' });
  assert.equal(readAgreementNote(note)?.otherDetails, 'First dance');
  assert.equal(readAgreementNote('{"kind":"custom-songs","songs":["A","",""]}'), null);
  assert.equal(readAgreementNote('Call the couple'), null);
});

test('send checklist follows the package rules and defaults full-wedding reception start', () => {
  const ceremonyOnly = agreementGaps({ ...base, packageId: 'A' });
  assert.deepEqual(ceremonyOnly, []);

  const cocktail = agreementGaps({ ...base, packageId: 'B' });
  assert.deepEqual(
    cocktail.map((gap) => gap.label),
    ['Cocktail hour start time', 'Cocktail hour end time'],
  );

  const full = agreementGaps({
    ...base,
    packageId: 'FULL',
    cocktailStart: '17:00',
    cocktailEnd: '18:00',
  });
  assert.deepEqual(
    full.map((gap) => gap.label),
    ['Reception end time'],
  );

  const privateEvent = agreementGaps({
    ...base,
    packageId: 'EVENT',
    ceremonyEnd: '',
  });
  assert.deepEqual(
    privateEvent.map((gap) => gap.label),
    ['Event type', 'Performance description', 'Performance fee'],
  );
  assert.equal(privateEvent.some((gap) => gap.label === 'Event end time'), false);
});

test('saved agreement keeps ceremony times on the columns and reception start from cocktail end', () => {
  const saved = buildSavedAgreement({
    lead: {
      event_date: '2026-06-14',
      venue_name: 'Lead venue',
      performance_start_time: '15:00:00',
      inquiry_details: { source: 'website', agreement: { packageId: 'FULL', cocktailStart: '17:00', cocktailEnd: '18:00' } },
    },
    booking: {
      event_date: '2026-06-14',
      venue_name: 'Booking venue',
      performance_start_time: '16:00:00',
      performance_end_time: '16:30:00',
    },
    client: { name: 'Ada', email: 'ada@example.com', partner_name: 'Ben' },
    agreement: { ...emptyAgreement(), packageId: 'FULL', cocktailStart: '17:00', cocktailEnd: '18:00' },
  });
  assert.equal(saved.venueName, 'Booking venue');
  assert.equal(saved.ceremonyStart, '16:00');
  assert.equal(saved.ceremonyEnd, '16:30');
  assert.equal(saved.receptionStart, '18:00');
  assert.equal(saved.datesDiffer, false);
  const body = contractRequestBody({ leadId: 'lead', bookingId: 'booking' }, saved);
  assert.equal(body.receptionStart, '18:00');
  assert.equal(body.discount, '0');
  assert.equal('performanceFee' in body, false);
});

test('calendar block runs through reception while the ceremony end stays on the agreement', () => {
  const value = formValueFromDraft({
    eventDate: '2026-06-14',
    venueName: 'Hall',
    venueAddress: '1 Main',
    performanceStart: '16:00',
    performanceEnd: '16:30',
    agreement: {
      ...emptyAgreement(),
      packageId: 'FULL',
      ceremonyStart: '16:00',
      ceremonyEnd: '16:30',
      preludeStart: '15:30',
      cocktailStart: '16:30',
      cocktailEnd: '17:30',
      receptionEnd: '21:00',
    },
  });
  assert.deepEqual(calendarPerformanceTimes(value), { start: '15:30', end: '21:00' });
  assert.equal(agreementForStorage(value).ceremonyEnd, '16:30');
  assert.equal(agreementForStorage(value).receptionStart, '17:30');
});

test('full wedding stores the displayed reception start', () => {
  const stored = agreementForStorage({
    ...formValueFromDraft({
      eventDate: '2026-06-14',
      venueName: 'Hall',
      venueAddress: '1 Main',
      performanceStart: '16:00',
      performanceEnd: '17:00',
      agreement: { ...emptyAgreement(), packageId: 'FULL', cocktailStart: '17:00', cocktailEnd: '18:00' },
    }),
  });
  assert.equal(stored.receptionStart, '18:00');
});

test('prelude follows the ceremony until the times are typed by hand', () => {
  assert.deepEqual(preludeFromCeremony('16:00'), { preludeStart: '15:30', preludeEnd: '16:00' });
  assert.deepEqual(preludeFromCeremony('00:10'), { preludeStart: '23:40', preludeEnd: '00:10' });
  assert.equal(preludeFromCeremony(''), null);

  const empty = { ceremonyStart: '', preludeStart: '', preludeEnd: '' };
  assert.deepEqual(preludeAfterCeremonyChange(empty, '16:00'), { preludeStart: '15:30', preludeEnd: '16:00' });

  const auto = { ceremonyStart: '16:00', preludeStart: '15:30', preludeEnd: '16:00' };
  assert.deepEqual(preludeAfterCeremonyChange(auto, '17:00'), { preludeStart: '16:30', preludeEnd: '17:00' });
  assert.deepEqual(preludeAfterCeremonyChange(auto, ''), { preludeStart: '', preludeEnd: '' });

  const typed = { ceremonyStart: '16:00', preludeStart: '15:00', preludeEnd: '15:45' };
  assert.equal(preludeAfterCeremonyChange(typed, '17:00'), null);

  const cleared = { ceremonyStart: '16:00', preludeStart: '', preludeEnd: '' };
  assert.deepEqual(preludeAfterCeremonyChange(cleared, '17:00'), { preludeStart: '16:30', preludeEnd: '17:00' });
});
