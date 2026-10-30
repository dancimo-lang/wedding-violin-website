import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingEventPayload } from '../google/events';
import {
  dollarsToCents,
  existingBookingNotes,
  isGoogleSyncExcluded,
  packagePriceCents,
  parseExistingBooking,
  planExistingPayments,
} from './existing-booking';

test('paid in full owes nothing', () => {
  const plan = planExistingPayments(100000, '2026-09-12', 'paid_in_full');
  assert.ok(!('error' in plan));
  assert.equal(plan.owedCents, 0);
  assert.equal(plan.paidCents, 100000);
  assert.deepEqual(plan.obligations.map((o) => [o.kind, o.amountCents, o.paid]), [
    ['retainer', 50000, true],
    ['balance', 50000, true],
  ]);
});

test('retainer paid owes only the balance, due 30 days before the wedding', () => {
  const plan = planExistingPayments(45001, '2026-09-12', 'retainer_paid');
  assert.ok(!('error' in plan));
  assert.equal(plan.retainerCents, 22501);
  assert.equal(plan.owedCents, 22500);
  assert.equal(plan.balanceDueDate, '2026-08-13');
  const balance = plan.obligations.find((o) => o.kind === 'balance');
  assert.equal(balance?.paid, false);
  assert.equal(balance?.dueOn, '2026-08-13');
});

test('nothing paid owes the whole total; $0 makes no obligations', () => {
  const plan = planExistingPayments(150000, '2027-01-02', 'nothing_paid');
  assert.ok(!('error' in plan));
  assert.equal(plan.owedCents, 150000);
  const free = planExistingPayments(0, '2027-01-02', 'paid_in_full');
  assert.ok(!('error' in free));
  assert.equal(free.obligations.length, 0);
  assert.equal(free.owedCents, 0);
});

test('package prices and dollar parsing', () => {
  assert.equal(packagePriceCents('A'), 45000);
  assert.equal(packagePriceCents('D'), 150000);
  assert.equal(packagePriceCents('FULL'), 300000);
  assert.equal(packagePriceCents('OTHER'), null);
  assert.equal(dollarsToCents('$1,000.5'), 100050);
  assert.equal(dollarsToCents('12.345'), null);
  assert.equal(dollarsToCents('-5'), null);
});

test('parse requires a name and date; email is optional; Google defaults off', () => {
  assert.ok('error' in parseExistingBooking({ weddingDate: '2026-09-12', package: 'A', totalPrice: '450', paymentStatus: 'paid_in_full' }));
  const ok = parseExistingBooking({
    client1Name: ' Sam ',
    weddingDate: '2026-09-12',
    package: 'A',
    totalPrice: '450',
    paymentStatus: 'paid_in_full',
    paymentMethod: 'zelle',
    email: 'Sam@Example.com',
  });
  assert.ok(!('error' in ok));
  assert.equal(ok.client1Name, 'Sam');
  assert.equal(ok.email, 'sam@example.com');
  assert.equal(ok.addToGoogle, false);
  assert.match(existingBookingNotes(ok), /Added manually.*Paid outside the site: Paid in full via Zelle/);
  assert.ok('error' in parseExistingBooking({ client1Name: 'x', weddingDate: '2026-09-12', package: 'A', totalPrice: '1', paymentStatus: 'x' }));
  assert.ok('error' in parseExistingBooking({ client1Name: 'x', weddingDate: '2026-09-12', startTime: '16:00', package: 'A', totalPrice: '1', paymentStatus: 'nothing_paid' }));
});

test('a marker with google_sync false keeps the booking off Google', () => {
  assert.equal(isGoogleSyncExcluded([{ source: 'existing_booking', google_sync: false }]), true);
  assert.equal(isGoogleSyncExcluded([{ source: 'existing_booking', google_sync: true }]), false);
  assert.equal(isGoogleSyncExcluded([null, { google_sync: false }]), false);
  const row = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'Confirmed',
    eventDate: '2026-09-12',
    startTime: '16:00',
    endTime: '17:00',
    venueName: null,
    venueAddress: null,
    serviceType: 'Wedding',
    clientName: 'Sam',
  };
  assert.ok(bookingEventPayload(row));
  assert.equal(bookingEventPayload({ ...row, googleSync: false }), null);
});
