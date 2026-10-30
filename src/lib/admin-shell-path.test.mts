import assert from 'node:assert/strict';
import test from 'node:test';
import { adminDetailShell, adminRecordId } from './admin-shell-path';

test('detail urls rewrite to a static shell and list pages do not', () => {
  assert.equal(adminDetailShell('/admin/bookings/11111111-1111-1111-1111-111111111111'), '/admin/bookings/entry');
  assert.equal(adminDetailShell('/admin/leads/22222222-2222-2222-2222-222222222222'), '/admin/leads/entry');
  assert.equal(adminDetailShell('/admin/bookings'), null);
  assert.equal(adminDetailShell('/admin/leads'), null);
  assert.equal(adminDetailShell('/admin/leads/new'), null);
  assert.equal(adminDetailShell('/admin/bookings/entry'), null);
  assert.equal(adminDetailShell('/admin/settings'), null);
});

test('the shell reads the id from the browser path', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  assert.equal(adminRecordId(`/admin/bookings/${id}`, 'bookings'), id);
  assert.equal(adminRecordId(`/admin/leads/${id}`, 'leads'), id);
  assert.equal(adminRecordId('/admin/leads/new', 'leads'), '');
  assert.equal(adminRecordId('/admin/bookings/entry', 'bookings'), '');
});

test('the add existing booking page is not rewritten to a booking detail', () => {
  assert.equal(adminDetailShell('/admin/bookings/existing'), null);
  assert.equal(adminRecordId('/admin/bookings/existing', 'bookings'), '');
});
