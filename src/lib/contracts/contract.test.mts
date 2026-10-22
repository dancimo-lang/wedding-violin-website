import assert from 'node:assert/strict';
import test from 'node:test';
import { findOpenObligations, generateBookingCode, isBookingCode } from './booking-code';
import { computeFees, finalPaymentDueDate, formatMoney, parseDollarInput, splitRetainer } from './money';
import { renderContractPdf } from './pdf';
import { DUO_DJ_OVERTIME, guessPackageId, SOLO_VIOLIN_OVERTIME, weddingMusicOvertimeClause } from './packages';
import {
  normalizeStoredFields,
  performanceTimeOrderMessage,
  placeholdersIn,
  renderContract,
  templateSource,
  type StoredRenderFields,
  type SignatureOverlay,
} from './render';
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
  assert.equal(
    SOLO_VIOLIN_OVERTIME,
    "Additional performance time requested on the day of the event may be provided at the Musician's discretion, subject to availability, and will be billed at $200 per hour for solo violin, in half-hour increments ($100 per half hour).",
  );
  assert.equal(
    DUO_DJ_OVERTIME,
    "Additional performance time requested on the day of the event may be provided at the Musician's discretion, subject to availability, and will be billed as follows: Live Duo Performance, $300 per hour; DJ Services, $200 per hour. Partial hours will be rounded to the nearest half-hour.",
  );
  assert.equal(weddingMusicOvertimeClause('A'), SOLO_VIOLIN_OVERTIME);
  assert.equal(weddingMusicOvertimeClause('B'), SOLO_VIOLIN_OVERTIME);
  assert.equal(weddingMusicOvertimeClause('C'), DUO_DJ_OVERTIME);
  assert.equal(weddingMusicOvertimeClause('D'), DUO_DJ_OVERTIME);
  assert.ok(master.includes(DUO_DJ_OVERTIME));
  assert.equal(master.split(DUO_DJ_OVERTIME).length, 2);
  assert.equal(master.includes(SOLO_VIOLIN_OVERTIME), false);

  const packageB = renderContract({ ...sampleFields, packageId: 'B' }, signedOverlay);
  assert.match(packageB, /☑ Package B: Solo Violin Ceremony & Cocktail Hour — \$1,000/);
  assert.match(packageB, /Selected Package: Package B: Solo Violin Ceremony & Cocktail Hour/);
  assert.ok(packageB.includes(DUO_DJ_OVERTIME));
  assert.equal(packageB.includes(SOLO_VIOLIN_OVERTIME), false);
  assert.equal(packageB.includes('{{'), false);

  for (const packageId of ['C', 'D'] as const) {
    const duo = renderContract({ ...sampleFields, packageId }, signedOverlay);
    assert.ok(duo.includes(DUO_DJ_OVERTIME));
    assert.equal(duo.split(DUO_DJ_OVERTIME).length, 2);
    assert.equal(duo.includes(SOLO_VIOLIN_OVERTIME), false);
    assert.equal(duo.includes('{{'), false);
  }
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
  assert.equal(full.includes(SOLO_VIOLIN_OVERTIME), false);
  assert.equal(full.includes('half-hour increments'), false);
  assert.match(full, /DJ Services: \$200 per hour\nLive Duo Performance: \$300 per hour\nPartial hours will be rounded to the nearest half-hour\./);
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

test('a new agreement prints only the selected package, and an older one keeps every option', () => {
  const legacy = renderContract({ ...sampleFields, packageId: 'B' }, signedOverlay);
  assert.match(legacy, /☑ Package B: Solo Violin Ceremony & Cocktail Hour — \$1,000/);
  assert.match(legacy, /☐ Package A: Solo Violin Ceremony — \$450/);
  assert.match(legacy, /☐ Package C: Violin & Guitar Duo Ceremony — \$1,000/);
  assert.match(legacy, /☐ Package D: Violin & Guitar Duo Ceremony & Cocktail Hour — \$1,500/);

  const packageB = renderContract({ ...sampleFields, packageId: 'B', renderEdition: 2 }, signedOverlay);
  assert.equal(packageB.includes('{{'), false);
  assert.equal(packageB.includes('☑'), false);
  assert.equal(packageB.includes('☐ Package'), false);
  assert.match(packageB, /☐ The Client opts out of promotional use of photographs and video clips from the event\./);
  assert.doesNotMatch(packageB, /Package A: Solo Violin Ceremony — \$450/);
  assert.doesNotMatch(packageB, /Includes everything in Package A/);
  assert.doesNotMatch(packageB, /Package C: Violin & Guitar Duo Ceremony/);
  assert.doesNotMatch(packageB, /Package D: Violin & Guitar Duo Ceremony & Cocktail Hour/);
  const packageBServices = `Package B: Solo Violin Ceremony & Cocktail Hour — $1,000
Includes:
Up to 30 minutes of pre-ceremony music as guests arrive
Live solo violin for the wedding party entrance, bridal entrance, and recessional
Music during other portions of the ceremony as agreed upon
Sound amplification for the violin
Up to three (3) custom song requests arranged for solo violin
Music consultation and coordination of ceremony selections
Live solo violin performance during cocktail hour
Cocktail-hour repertoire tailored to the Client's musical preferences
Music across styles such as classical, jazz, Celtic, folk, pop, and other selections within the Musician's repertoire
Selected Package: Package B: Solo Violin Ceremony & Cocktail Hour`;
  assert.ok(packageB.includes(packageBServices));
  for (const line of packageBServices.split('\n')) {
    if (line.startsWith('Selected Package:')) continue;
    assert.equal(templateSource('wedding-music').includes(line), true, line);
  }
  assert.ok(packageB.includes(SOLO_VIOLIN_OVERTIME));
  assert.equal(packageB.split(SOLO_VIOLIN_OVERTIME).length, 2);
  assert.equal(packageB.includes('Live Duo Performance'), false);
  assert.equal(packageB.includes('DJ Services'), false);
  assert.ok(legacy.includes(DUO_DJ_OVERTIME));
  assert.match(packageB, /For packages that include cocktail hour, the Client may provide preferred musical styles and specific song requests\./);

  const head = '1. Package Selection\n';
  const fees = '2. Fee Summary and Payment\n';
  const overtime = 'Additional performance time requested on the day of the event';
  assert.equal(packageB.slice(0, packageB.indexOf(head)), legacy.slice(0, legacy.indexOf(head)));
  assert.equal(
    packageB.slice(packageB.indexOf(fees), packageB.indexOf(overtime)),
    legacy.slice(legacy.indexOf(fees), legacy.indexOf(overtime)),
  );
  assert.equal(packageB.slice(packageB.indexOf('\n\n6. Venue')), legacy.slice(legacy.indexOf('\n\n6. Venue')));

  const packageA = renderContract({ ...sampleFields, renderEdition: 2 }, signedOverlay);
  assert.match(packageA, /Package A: Solo Violin Ceremony — \$450\nIncludes:\nUp to 30 minutes of pre-ceremony music as guests arrive\n/);
  assert.doesNotMatch(packageA, /Package B: Solo Violin Ceremony & Cocktail Hour — \$1,000/);
  assert.equal(packageA.includes('☑'), false);
  assert.ok(packageA.includes(SOLO_VIOLIN_OVERTIME));
  assert.equal(packageA.split(SOLO_VIOLIN_OVERTIME).length, 2);
  assert.equal(packageA.includes('Live Duo Performance'), false);
  assert.equal(packageA.includes('DJ Services'), false);
  assert.equal(packageA.includes('{{'), false);

  const packageD = renderContract({ ...sampleFields, packageId: 'D', renderEdition: 2 }, signedOverlay);
  const packageDServices = `Package D: Violin & Guitar Duo Ceremony & Cocktail Hour — $1,500
Includes:
Up to 30 minutes of pre-ceremony music as guests arrive
Live violin and acoustic guitar duo for the wedding ceremony
Music for the wedding party entrance, bridal entrance, and recessional
Music during other portions of the ceremony as agreed upon
Sound equipment and amplification for the ceremony
Wireless microphones for the couple and officiant, as needed and subject to the agreed setup
Up to three (3) custom song requests arranged for violin and guitar
Music consultation and coordination of ceremony selections
Live violin and acoustic guitar duo performance during cocktail hour
Cocktail-hour repertoire tailored to the Client's musical preferences
Music across styles such as classical, jazz, bossa nova, tango, Celtic, folk, pop, and other selections within the musicians' repertoires
Sound equipment and amplification appropriate for the performance areas
Selected Package: Package D: Violin & Guitar Duo Ceremony & Cocktail Hour`;
  assert.ok(packageD.includes(packageDServices));
  for (const line of packageDServices.split('\n')) {
    if (line.startsWith('Selected Package:')) continue;
    assert.equal(templateSource('wedding-music').includes(line), true, line);
  }
  assert.doesNotMatch(packageD, /Package C: Violin & Guitar Duo Ceremony — \$1,000/);
  assert.doesNotMatch(packageD, /Includes everything in Package C/);
  assert.equal(packageD.includes('☑'), false);
  assert.ok(packageD.includes(DUO_DJ_OVERTIME));
  assert.equal(packageD.split(DUO_DJ_OVERTIME).length, 2);
  assert.equal(packageD.includes(SOLO_VIOLIN_OVERTIME), false);
  assert.equal(packageD.includes('{{'), false);
  const packageC = renderContract({ ...sampleFields, packageId: 'C', renderEdition: 2 }, signedOverlay);
  assert.ok(packageC.includes(DUO_DJ_OVERTIME));
  assert.equal(packageC.split(DUO_DJ_OVERTIME).length, 2);
  assert.equal(packageC.includes(SOLO_VIOLIN_OVERTIME), false);
  assert.equal(packageC.includes('{{'), false);

  const storedLegacy = normalizeStoredFields(sampleFields);
  assert.equal(storedLegacy?.renderEdition, undefined);
  assert.equal(renderContract(storedLegacy ?? sampleFields, signedOverlay), renderContract(sampleFields, signedOverlay));
  const storedNext = normalizeStoredFields({ ...sampleFields, packageId: 'B', renderEdition: 2 });
  assert.equal(storedNext?.renderEdition, 2);
  assert.equal(renderContract(storedNext ?? sampleFields, signedOverlay), packageB);
});

test('a backwards ceremony or cocktail time blocks sending', () => {
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:00', ceremonyEnd: '16:30', cocktailStart: '17:00', cocktailEnd: '18:00' }),
    '',
  );
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:00', ceremonyEnd: '16:00', cocktailStart: '', cocktailEnd: '' }),
    '',
  );
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:30', ceremonyEnd: '', cocktailStart: '18:00', cocktailEnd: '' }),
    '',
  );
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:30', ceremonyEnd: '16:00', cocktailStart: '17:00', cocktailEnd: '18:00' }),
    'Ceremony end is before ceremony start. Fix the times before sending this agreement.',
  );
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:00', ceremonyEnd: '16:30', cocktailStart: '18:00', cocktailEnd: '17:00' }),
    'Cocktail hour end is before cocktail hour start. Fix the times before sending this agreement.',
  );
  assert.equal(
    performanceTimeOrderMessage({ ceremonyStart: '16:30', ceremonyEnd: '16:00', cocktailStart: '18:00', cocktailEnd: '17:00' }),
    'Ceremony end is before ceremony start. Cocktail hour end is before cocktail hour start. Fix the times before sending this agreement.',
  );
});

test('the same agreement text always hashes the same way, and signing locks it', () => {
  assert.equal(hashContractText('a'), 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
  const first = renderContract(sampleFields, signedOverlay);
  const second = renderContract(sampleFields, signedOverlay);
  assert.equal(first, second);
  assert.equal(hashContractText(first), hashContractText(second));
  // Agreements created before package-specific text still hash to this checklist document.
  assert.equal(hashContractText(first), 'a8c2659bf8dfa7272110624a5a1659c908b5004e5f9c6da6bf0b8c91f10a72a3');

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
