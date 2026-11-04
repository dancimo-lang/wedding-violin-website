import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingEventPayload } from '../google/events';
import {
  dollarsToCents,
  existingBookingNotes,
  isGoogleSyncExcluded,
  isReplaceableOutsidePayment,
  packagePriceCents,
  parseExistingBooking,
  planExistingPayments,
} from './existing-booking';

test('$450 with $100 paid owes $350 on the chosen date', () => {
  const plan = planExistingPayments(45000, '2027-05-15', 10000, '2027-04-15');
  assert.ok(!('error' in plan));
  assert.equal(plan.paidCents, 10000);
  assert.equal(plan.owedCents, 35000);
  assert.equal(plan.balanceDueDate, '2027-04-15');
  assert.deepEqual(plan.obligations.map((row) => [row.kind, row.amountCents, row.paid, row.dueOn]), [
    ['retainer', 10000, true, null],
    ['balance', 35000, false, '2027-04-15'],
  ]);
});

test('a $1,500 booking with nothing paid has one open $1,500 record', () => {
  const plan = planExistingPayments(150000, '2027-04-30', 0, null);
  assert.ok(!('error' in plan));
  assert.equal(plan.owedCents, 150000);
  assert.equal(plan.paidCents, 0);
  assert.equal(plan.balanceDueDate, '2027-03-31');
  assert.equal(plan.obligations.length, 1);
  assert.equal(plan.obligations[0]?.kind, 'retainer');
  assert.equal(plan.obligations[0]?.amountCents, 150000);
  assert.equal(plan.obligations[0]?.paid, false);
});

test('paid in full owes nothing and a blank due date is 30 days before the wedding', () => {
  const plan = planExistingPayments(52500, '2027-04-24', 52500);
  assert.ok(!('error' in plan));
  assert.equal(plan.owedCents, 0);
  assert.equal(plan.paidCents, 52500);
  assert.equal(plan.balanceDueDate, '2027-03-25');
  assert.deepEqual(plan.obligations.map((row) => [row.kind, row.amountCents, row.paid]), [
    ['retainer', 52500, true],
  ]);
  const free = planExistingPayments(0, '2027-01-02', 0);
  assert.ok(!('error' in free));
  assert.equal(free.obligations.length, 0);
  assert.equal(free.owedCents, 0);
});

test('the amount already paid cannot exceed the total', () => {
  const plan = planExistingPayments(45000, '2027-05-15', 45100);
  assert.ok('error' in plan);
});

test('package prices and dollar parsing', () => {
  assert.equal(packagePriceCents('A'), 45000);
  assert.equal(packagePriceCents('D'), 150000);
  assert.equal(packagePriceCents('FULL'), 300000);
  assert.equal(packagePriceCents('OTHER'), null);
  assert.equal(dollarsToCents('$1,000.5'), 100050);
  assert.equal(dollarsToCents('0'), 0);
  assert.equal(dollarsToCents('12.345'), null);
  assert.equal(dollarsToCents('-5'), null);
});

test('parse takes the amount paid instead of a retainer preset', () => {
  assert.ok('error' in parseExistingBooking({ weddingDate: '2027-05-15', package: 'A', totalPrice: '450', amountPaid: '100' }));
  const ok = parseExistingBooking({
    client1Name: ' Della ',
    weddingDate: '2027-05-15',
    package: 'A',
    totalPrice: '450',
    amountPaid: '100',
    balanceDueDate: '2027-04-15',
    paymentMethod: 'zelle',
    email: 'Della@Example.com',
  });
  assert.ok(!('error' in ok));
  assert.equal(ok.client1Name, 'Della');
  assert.equal(ok.email, 'della@example.com');
  assert.equal(ok.paidCents, 10000);
  assert.equal(ok.totalCents, 45000);
  assert.equal(ok.paymentStatus, 'partial');
  assert.equal(ok.balanceDueDate, '2027-04-15');
  assert.equal(ok.addToGoogle, false);
  assert.match(existingBookingNotes(ok), /Paid outside the site: \$100\.00 of \$450\.00 via Zelle/);
  assert.match(existingBookingNotes(ok), /\$350\.00 is still owed, due 2027-04-15/);
  const nothing = parseExistingBooking({
    client1Name: 'Alecxis',
    weddingDate: '2027-04-30',
    package: 'D',
    totalPrice: '1500',
    amountPaid: '0',
  });
  assert.ok(!('error' in nothing));
  assert.equal(nothing.paymentStatus, 'nothing_paid');
  assert.equal(nothing.paidCents, 0);
  assert.ok('error' in parseExistingBooking({ client1Name: 'x', weddingDate: '2027-05-15', package: 'A', totalPrice: '450', amountPaid: '500' }));
  assert.ok('error' in parseExistingBooking({ client1Name: 'x', weddingDate: '2027-05-15', startTime: '16:00', package: 'A', totalPrice: '450', amountPaid: '0' }));
});

test('only the manual outside-site payment can be replaced', () => {
  assert.equal(isReplaceableOutsidePayment({
    method: 'manual',
    status: 'Completed',
    memo: 'Paid outside the site (Zelle). Added manually as an existing booking.',
  }), true);
  assert.equal(isReplaceableOutsidePayment({ method: 'zelle', status: 'Completed', memo: 'Paid outside the site (Zelle). Added manually as an existing booking.' }), false);
  assert.equal(isReplaceableOutsidePayment({ method: 'manual', status: 'Completed', memo: 'Paid at the wedding.' }), false);
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
