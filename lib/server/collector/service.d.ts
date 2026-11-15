type CollectorSource = {
  id: string;
  name: string;
  permission: string;
  enabled: boolean;
  [key: string]: unknown;
};

type CollectorListing = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  clusterId: string | null;
  verificationStatus: 'needs_review' | 'verified' | 'rejected';
  trustScore: number;
  source: { name: string; url: string | null; permission: string };
  [key: string]: unknown;
};

export function collectConfiguredSources(options?: { sources?: CollectorSource[]; delayMs?: number; concurrency?: number }): Promise<{
  sources: CollectorSource[];
  runs: Array<{ sourceId: string; sourceName: string; status: string; count: number; listings?: CollectorListing[]; error?: string; warning?: string }>;
}>;

export function mergeCollectedRuns(runs: Array<{ listings?: CollectorListing[] }>): {
  sourceListings: CollectorListing[];
  listings: CollectorListing[];
  duplicates: number;
};
