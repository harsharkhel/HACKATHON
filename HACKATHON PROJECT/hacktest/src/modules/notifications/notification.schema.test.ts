import test from 'node:test';
import assert from 'node:assert/strict';
import { markNotificationReadSchema, listNotificationsQuerySchema } from './notification.schema';

test('listNotificationsQuerySchema accepts valid pagination query', () => {
  const result = listNotificationsQuerySchema.safeParse({
    query: { page: '1', limit: '10', unreadOnly: 'true' },
  });

  assert.equal(result.success, true);
});

test('markNotificationReadSchema rejects empty ids', () => {
  const result = markNotificationReadSchema.safeParse({
    params: { id: '' },
  });

  assert.equal(result.success, false);
});
