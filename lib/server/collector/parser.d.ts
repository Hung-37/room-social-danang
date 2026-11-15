export type CollectorPermission = 'public_api' | 'public_feed' | 'public_html' | 'official_meta_api' | 'manual_review' | 'local_file';

export type CollectorSource = {
  id: string;
  name: string;
  type: string;
  url: string;
  permission: CollectorPermission;
  enabled: boolean;
  keywords?: string[];
  note: string;
  listingSelectors?: {
    itemSelector: string;
    titleSelector: string;
    descriptionSelector: string;
    priceSelector: string;
    areaSelector: string;
    addressSelector: string;
  };
};

export type NormalizedListing = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  clusterId: string | null;
  source: { name: string; url: string | null; collectedAt?: string; permission: string };
  verificationStatus: 'needs_review' | 'verified' | 'rejected';
  trustScore: number;
  imageUrl?: string | null;
  phone?: string | null;
};

export type CollectorInput = {
  item: Record<string, unknown>;
  source: Pick<CollectorSource, 'name' | 'url' | 'permission'> & { keywords?: string[] };
};

export declare const DEFAULT_RELEVANCE_KEYWORDS: string[];
export declare const publicSources: CollectorSource[];
export declare function isPublicFeedUrl(value: unknown): boolean;
export declare function isPlaceholderListingUrl(value: unknown): boolean;
export declare function sanitizeListingSummary(value: unknown): string;
export declare function normalizeListing(item: Record<string, unknown>, source: CollectorSource): NormalizedListing;
export declare function deduplicateListings<T>(listings: T[]): T[];
export declare function collectListings(inputs: CollectorInput[]): {
  listings: NormalizedListing[];
  stats: { received: number; rejected: number; irrelevant: number; duplicates: number; needsReview: number };
};
export declare function fetchPublicListings(source: CollectorSource): Promise<NormalizedListing[]>;
export declare function fetchHtmlListings(source: CollectorSource): Promise<NormalizedListing[]>;
export declare function fetchLocalFileData(source: CollectorSource): Promise<NormalizedListing[]>;
export declare function checkPublicSource(source: Partial<CollectorSource>): Promise<Record<string, unknown>>;
export declare function parseGenericHtmlListings(html: string, source: CollectorSource): NormalizedListing[];
export declare function checkRobotsAllowed(value: string, fetchImpl?: typeof fetch): Promise<{ allowed: boolean; checked: boolean; warning: string | null }>;
export declare function fetchGenericUrlListings(url: string, fetchImpl?: typeof fetch, options?: { maxPages?: number }): Promise<{
  listings: NormalizedListing[];
  format: 'json' | 'rss' | 'html';
  robots: { allowed: boolean; checked: boolean; warning: string | null };
  pages: number;
  warnings: string[];
}>;
