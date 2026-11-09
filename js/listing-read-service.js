export async function readWithDatabaseFallback({ databaseConfigured, readDatabase, readCache }) {
  if (databaseConfigured) {
    try {
      const result = await readDatabase();
      // A configured but empty database must not hide the durable file cache.
      if (!result.data?.length) {
        const fallback = await readCache();
        if (fallback.data?.length) {
          return { ...fallback, meta: { ...fallback.meta, storage: 'file_cache', databaseEmptyFallback: true } };
        }
      }
      return { ...result, meta: { ...result.meta, storage: 'database' } };
    } catch (error) {
      const fallback = await readCache();
      return {
        ...fallback,
        meta: {
          ...fallback.meta,
          databaseFallback: true,
          databaseError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  return readCache();
}
