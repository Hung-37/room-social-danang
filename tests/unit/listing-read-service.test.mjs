import assert from 'node:assert/strict';
import test from 'node:test';
import { readWithDatabaseFallback } from '../../lib/policies/listing-read-service.js';

test('falls back to cache when database read fails', async () => {
  const result = await readWithDatabaseFallback({
    databaseConfigured: true,
    readDatabase: async () => {
      throw new Error('connection refused');
    },
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

test('public room reads refuse stale cache on database failure', async () => {
  let cacheReads = 0;
  await assert.rejects(
    readWithDatabaseFallback({
      databaseConfigured: true,
      allowCacheFallback: false,
      readDatabase: async () => {
        throw new Error('offline');
      },
      readCache: async () => {
        cacheReads++;
        return { data: [{ externalId: 'now-hidden' }], meta: {} };
      }
    }),
    /offline/
  );
  assert.equal(cacheReads, 0);
});
test('empty public database does not restore withdrawn rooms from cache', async () => {
  let cacheReads = 0;
  const result = await readWithDatabaseFallback({
    databaseConfigured: true,
    allowCacheFallback: false,
    readDatabase: async () => ({ data: [], meta: {} }),
    readCache: async () => {
      cacheReads++;
      return { data: [{ externalId: 'old-room' }], meta: {} };
    }
  });
  assert.deepEqual(result.data, []);
  assert.equal(cacheReads, 0);
});
