import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultCallBy, emptyLeadDraft, leadWritePayload, receivedOnFromRecord } from './leads';

test('a website inquiry suggests a call two days later and keeps a date already saved', () => {
  assert.equal(receivedOnFromRecord('2026-11-04T04:30:00.000Z'), '2026-11-03');
  assert.equal(defaultCallBy({ nextFollowUp: '', inquirySource: 'website', receivedOn: '2026-11-03' }), '2026-11-05');
  assert.equal(defaultCallBy({ nextFollowUp: '2026-11-10', inquirySource: 'website', receivedOn: '2026-11-03' }), '2026-11-10');
  assert.equal(defaultCallBy({ nextFollowUp: '', inquirySource: 'phone', receivedOn: '2026-11-03' }), '');
  assert.equal(defaultCallBy({ nextFollowUp: '', inquirySource: 'website', receivedOn: '' }), '');
});

test('saving a website inquiry stores the suggested call-by date and fills blank record defaults', () => {
  const payload = leadWritePayload({
    ...emptyLeadDraft(),
    clientName: 'Ada',
    inquirySource: '',
    status: '',
    receivedOn: '2026-11-03',
    message: 'Called, ceremony only.',
    requestedServices: 'Ceremony violin',
  });
  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  assert.equal(payload.lead.inquiry_source, 'website');
  assert.equal(payload.lead.status, 'New Inquiry');
  assert.equal(payload.lead.next_follow_up_date, '2026-11-05');
  assert.equal(payload.lead.message, 'Called, ceremony only.');
  assert.equal(payload.lead.requested_services, 'Ceremony violin');
});
