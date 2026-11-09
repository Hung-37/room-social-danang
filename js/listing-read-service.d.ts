type ListingReadResult = { data: unknown[]; meta: Record<string, unknown> };

export function readWithDatabaseFallback(options: {
  databaseConfigured: boolean;
  readDatabase: () => Promise<ListingReadResult>;
  readCache: () => Promise<ListingReadResult>;
}): Promise<ListingReadResult>;
