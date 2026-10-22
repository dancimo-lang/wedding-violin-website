import assert from 'node:assert/strict';
import test from 'node:test';
import { findOpenObligations, generateBookingCode, isBookingCode } from './booking-code';
import { computeFees, finalPaymentDueDate, formatMoney, parseDollarInput, splitRetainer } from './money';
import { renderContractPdf } from './pdf';
import { guessPackageId } from './packages';
import { placeholdersIn, renderContract, templateSource, type StoredRenderFields, type SignatureOverlay } from './render';
import { signOnce } from './sign';
import { validateSignature } from './signers';
import { generateContractToken, hashContractText, isContractToken, tokensMatch } from './token';
import { contractFromAddress, contractReplyTo } from './mail';

const sampleFields: StoredRenderFields = {
  templateId: 'wedding-music',
  packageId: 'A',
  client1Name: 'Alex Rivera',
  client2Name: 'Jordan Lee',
  weddingDateIso: '2026-06-15',
  venueName: 'Madonna Inn',
  venueAddress: '100 Madonna Road, San Luis Obispo, CA',
  ceremonyStart: '16:00',
  ceremonyEnd: '16:30',
  cocktailStart: '17:00',
  cocktailEnd: '18:00',
  preludeStart: '15:30',
  otherDetails: 'Prelude in the garden',
  packageFeeCents: 45000,
  travelFeeCents: 5000,
  additionalFeesCents: 2500,
  discountCents: 1000,
  totalCents: 51500,
  retainerCents: 25750,
  balanceCents: 25750,
  finalPaymentDueDate: '2026-05-16',
};

const signedOverlay: SignatureOverlay = {
  client1SignedName: 'Alex Rivera',
  client2SignedName: 'Jordan Lee',
  signedOn: 'June 1, 2026',
  photoOptOut: false,
  musicianSignedName: '',
  musicianSignedOn: '',
};

test('retainer, balance, and the due date stay exact', () => {
  assert.equal(finalPaymentDueDate('2026-06-15'), '2026-05-16');
  assert.equal(finalPaymentDueDate('2026-03-01'), '2026-01-30');
  assert.equal(finalPaymentDueDate('2024-03-01'), '2024-01-31');
  assert.equal(finalPaymentDueDate('2026-02-31'), null);

  const even = computeFees({
    packageId: 'A',
    travelFeeCents: 5000,
    additionalFeesCents: 2500,
    discountCents: 1000,
    weddingDateIso: '2026-06-15',
  });
  assert.ok(!('error' in even));
  if ('error' in even) return;
  assert.equal(even.packageFeeCents, 45000);
  assert.equal(even.totalCents, 51500);
  assert.equal(even.retainerCents, 25750);
  assert.equal(even.balanceCents, 25750);
  assert.equal(even.retainerCents + even.balanceCents, even.totalCents);
  assert.equal(even.finalPaymentDueDate, '2026-05-16');

  const odd = splitRetainer(45001);
  assert.deepEqual(odd, { retainerCents: 22501, balanceCents: 22500 });

  const full = computeFees({
    packageId: 'FULL',
    travelFeeCents: 0,
    additionalFeesCents: 0,
    discountCents: 0,
    weddingDateIso: '2026-06-15',
  });
  assert.ok(!('error' in full));
  if ('error' in full) return;
  assert.equal(full.totalCents, 300000);
  assert.equal(full.retainerCents, 150000);
  assert.equal(full.balanceCents, 150000);

  const customFull = computeFees({
    packageId: 'FULL',
    travelFeeCents: 100,
    additionalFeesCents: 0,
    discountCents: 0,
    weddingDateIso: '2026-06-15',
  });
  assert.ok('error' in customFull);

  const tooMuchDiscount = computeFees({
    packageId: 'A',
    travelFeeCents: 0,
    additionalFeesCents: 0,
    discountCents: 45001,
    weddingDateIso: '2026-06-15',
  });
  assert.ok('error' in tooMuchDiscount);

  assert.equal(parseDollarInput('1,000.50'), 100050);
  assert.equal(parseDollarInput(''), 0);
  assert.equal(parseDollarInput('10.999'), null);
  assert.equal(formatMoney(51500), '515.00');
  assert.equal(formatMoney(300000), '3,000.00');
});

test('filled agreements keep the legal wording and have no placeholders', () => {
  const master = renderContract(sampleFields, signedOverlay);
  const full = renderContract(
    {
      ...sampleFields,
      templateId: 'full-wedding',
      packageId: 'FULL',
      packageFeeCents: 300000,
      travelFeeCents: 0,
      additionalFeesCents: 0,
      discountCents: 0,
      totalCents: 300000,
      retainerCents: 150000,
      balanceCents: 150000,
    },
    signedOverlay,
  );

  for (const text of [master, full]) {
    assert.equal(text.includes('{{'), false);
    assert.equal(placeholdersIn(text).length, 0);
  }

  assert.match(master, /The retainer is non-refundable once this Agreement has been signed and the retainer has been received\./);
  assert.match(master, /Live Duo Performance, \$300 per hour; DJ Services, \$200 per hour\./);
  assert.match(master, /☑ Package A: Solo Violin Ceremony — \$450/);
  assert.match(master, /☐ Package B: Solo Violin Ceremony & Cocktail Hour — \$1,000/);
  assert.match(master, /Selected Package: Package A: Solo Violin Ceremony/);
  assert.match(master, /Selected Package Fee: \$450\.00/);
  assert.match(master, /Travel Fee: \$50\.00/);
  assert.match(master, /Additional Agreed Fees: \$25\.00/);
  assert.match(master, /Discount \(if applicable\): −\$10\.00/);
  assert.match(master, /Total Contract Price: \$515\.00/);
  assert.match(master, /Retainer \(50% of Total Contract Price\): \$257\.50/);
  assert.match(master, /Remaining Balance \(50% of Total Contract Price\): \$257\.50/);
  assert.match(master, /Final Payment Due Date: May 16, 2026/);
  assert.match(master, /Wedding Date: June 15, 2026/);
  assert.match(master, /Alex Rivera and Jordan Lee/);
  assert.match(master, /Printed Name: Alex Rivera/);
  assert.match(master, /Signature: Jordan Lee/);
  assert.doesNotMatch(master, /Signature: Daniel Cimo/);

  assert.match(full, /The total fee for all services described in this Agreement is:\n\$3,000\.00/);
  assert.match(full, /A non-refundable retainer of \$1,500\.00 is required to reserve the event date\./);
  assert.match(full, /The remaining balance of \$1,500\.00 is due no later than 30 days prior to the wedding date\./);
  assert.match(full, /DJ Services: \$200 per hour/);
  assert.match(full, /Live Duo Performance: \$300 per hour/);
  assert.match(
    full,
    /unless the Client provides written notice prior to the event requesting otherwise\./,
  );
  assert.match(full, /☐ The Client opts out of promotional use of photographs and video clips from the event\./);
  assert.match(full, /Alex Rivera and Jordan Lee/);
  assert.match(full, /Event Date: June 15, 2026/);
  assert.match(full, /Event Time: 4:00 PM to 4:30 PM/);

  const opted = renderContract(sampleFields, { ...signedOverlay, photoOptOut: true });
  assert.match(opted, /☑ The Client opts out of promotional use of photographs and video clips from the event\./);
  assert.equal(templateSource('wedding-music').includes('{{PACKAGE_A_MARK}}'), true);
  assert.equal(templateSource('full-wedding').includes('$3,000.00'), true);
});

test('the same agreement text always hashes the same way, and signing locks it', () => {
  assert.equal(hashContractText('a'), 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
  const first = renderContract(sampleFields, signedOverlay);
  const second = renderContract(sampleFields, signedOverlay);
  assert.equal(first, second);
  assert.equal(hashContractText(first), hashContractText(second));

  const opted = renderContract(sampleFields, { ...signedOverlay, photoOptOut: true });
  assert.notEqual(hashContractText(first), hashContractText(opted));

  const signed = signOnce({ status: 'sent', signedText: null, contentSha256: null }, first);
  assert.equal(signed.ok, true);
  if (!signed.ok) return;
  assert.equal(signed.contentSha256, hashContractText(first));

  const repeat = signOnce(
    { status: 'signed', signedText: signed.signedText, contentSha256: signed.contentSha256 },
    opted,
  );
  assert.equal(repeat.ok, false);
  if (repeat.ok) return;
  assert.equal(repeat.contentSha256, signed.contentSha256);
  assert.equal(repeat.httpStatus, 409);

  const closed = signOnce({ status: 'void', signedText: null, contentSha256: null }, first);
  assert.equal(closed.ok, false);

  const executed = renderContract(sampleFields, {
    ...signedOverlay,
    musicianSignedName: 'Daniel Cimo',
    musicianSignedOn: 'June 2, 2026',
  });
  assert.match(executed, /Signature: Daniel Cimo/);
  assert.equal(hashContractText(first), hashContractText(renderContract(sampleFields, signedOverlay)));
  assert.notEqual(hashContractText(first), hashContractText(executed));
});

test('signing links use an unguessable token and reject anything else', () => {
  const token = generateContractToken(Buffer.alloc(32, 7));
  assert.equal(token, Buffer.alloc(32, 7).toString('base64url'));
  assert.equal(token.length, 43);
  assert.equal(isContractToken(token), true);
  assert.equal(tokensMatch(token, token), true);
  assert.equal(tokensMatch(token, generateContractToken(Buffer.alloc(32, 8))), false);
  assert.equal(tokensMatch('short', token), false);
  assert.equal(tokensMatch('', ''), false);
  assert.notEqual(generateContractToken(), generateContractToken());
  assert.equal(validateSignature({ client1Name: 'Alex', client2Name: '', agreed: true }), 'Enter the full legal name for Client 1.');
  assert.equal(validateSignature({ client1Name: 'Alex Rivera', client2Name: '', agreed: false }), 'Check the box to agree to this agreement.');
  assert.equal(validateSignature({ client1Name: 'Alex Rivera', client2Name: 'Jordan Lee', agreed: true }), null);
});

test('booking codes and open amounts can be matched later', () => {
  assert.equal(generateBookingCode(() => 0), 'DC-1000');
  assert.equal(isBookingCode('DC-4827'), true);
  assert.equal(isBookingCode('DC-482'), false);
  assert.equal(isBookingCode('dc-4827'), false);

  const rows = [
    { bookingCode: 'DC-4827', kind: 'balance' as const, amountCents: 150000, status: 'open' as const },
    { bookingCode: 'DC-4827', kind: 'retainer' as const, amountCents: 150000, status: 'open' as const },
    { bookingCode: 'DC-4827', kind: 'retainer' as const, amountCents: 150000, status: 'paid' as const },
    { bookingCode: 'DC-1111', kind: 'retainer' as const, amountCents: 150000, status: 'open' as const },
    { bookingCode: 'DC-4827', kind: 'retainer' as const, amountCents: 22500, status: 'void' as const },
  ];
  assert.deepEqual(
    findOpenObligations(rows, 'DC-4827', 150000).map((row) => row.kind),
    ['retainer', 'balance'],
  );
  assert.equal(findOpenObligations(rows, 'DC-4827', 22500).length, 0);
  assert.equal(findOpenObligations(rows, 'DC-0000', 150000).length, 0);
});

test('package choice follows the lead text', () => {
  assert.equal(guessPackageId({ service: 'Ceremony (Solo Violin)' }), 'A');
  assert.equal(guessPackageId({ service: 'Full Ceremony (Violin–Guitar Duo)', quotedPrice: 1000 }), 'C');
  assert.equal(guessPackageId({ packageInterest: 'Ceremony + Cocktail Hour Duo' }), 'D');
  assert.equal(guessPackageId({ service: 'Full Wedding + DJ', quotedPrice: 3000 }), 'FULL');
  assert.equal(guessPackageId({ service: 'solo violin ceremony and cocktail hour' }), 'B');
});

test('contract mail uses the contract sender, then the existing Resend sender', () => {
  assert.equal(contractFromAddress({ CONTRACT_FROM_EMAIL: 'contracts@example.com', RESEND_FROM: 'other@example.com' }), 'contracts@example.com');
  assert.equal(contractFromAddress({ RESEND_FROM: 'from@example.com', RESEND_FROM_EMAIL: 'legacy@example.com' }), 'from@example.com');
  assert.equal(contractFromAddress({ RESEND_FROM_EMAIL: 'legacy@example.com' }), 'legacy@example.com');
  assert.equal(contractFromAddress({}), null);
  assert.equal(contractReplyTo({}), 'dancimo@gmail.com');
  assert.equal(contractReplyTo({ CONTRACT_REPLY_TO: 'office@example.com' }), 'office@example.com');
});

test('a signed agreement can be turned into a PDF', async () => {
  const text = renderContract(sampleFields, signedOverlay);
  const pdf = await renderContractPdf(text);
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString('utf8'), '%PDF-');
  assert.ok(pdf.byteLength > 1000);
});
