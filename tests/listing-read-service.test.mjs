import assert from 'node:assert/strict';
import test from 'node:test';
import { readWithDatabaseFallback } from '../js/listing-read-service.js';

test('falls back to cache when database read fails', async () => {
  const result = await readWithDatabaseFallback({
    databaseConfigured: true,
    readDatabase: async () => { throw new Error('connection refused'); },
    readCache: async () => ({ data: [{ externalId: 'cached-1' }], meta: { storage: 'file_cache' } })
  });

  assert.deepEqual(result.data, [{ externalId: 'cached-1' }]);
  assert.equal(result.meta.storage, 'file_cache');
  assert.equal(result.meta.databaseFallback, true);
  assert.equal(result.meta.databaseError, 'connection refused');
});

test('uses database result when database is available', async () => {
  const result = await readWithDatabaseFallback({
    databaseConfigured: true,
    readDatabase: async () => ({ data: [{ externalId: 'db-1' }], meta: {} }),
    readCache: async () => ({ data: [{ externalId: 'cached-1' }], meta: {} })
  });

  assert.deepEqual(result.data, [{ externalId: 'db-1' }]);
  assert.equal(result.meta.storage, 'database');
  assert.equal(result.meta.databaseFallback, undefined);
});
