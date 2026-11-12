import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { deduplicateListings, isPlaceholderListingUrl, sanitizeListingSummary } from '@/lib/collector/parser.js';

export const SCRAPED_DATA_FILE = join(process.cwd(), 'data', 'cached-listings.json');
const TEMPLATE_DATA_FILE = join(process.cwd(), 'fixtures', 'listings.json');
const STALE_AFTER_MS = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1) * 24 * 60 * 60 * 1000;
let listingsCache: unknown[] | null = null;
let listingsCacheMtime = -1;

type StoredListing = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  clusterId: string | null;
  source: { name: string; url: string | null; permission?: string };
  verificationStatus: string;
  trustScore: number;
  phone?: string | null;
  imageUrl?: string | null;
  aiAnalysis?: unknown;
};

function listingTimestamp(item: Record<string, unknown>) {
  const value = item.lastSeenAt ?? item.updatedAt;
  const timestamp = value ? Date.parse(String(value)) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function isListingStale(item: Record<string, unknown>, now = Date.now()) {
  return item.stale === true || now - listingTimestamp(item) > STALE_AFTER_MS;
}

export function readScrapedListings(options: { includeStale?: boolean } = {}): unknown[] {
  if (!existsSync(SCRAPED_DATA_FILE)) return [];

  const mtime = statSync(SCRAPED_DATA_FILE).mtimeMs;
  if (listingsCache && listingsCacheMtime === mtime) {
    return options.includeStale === false
      ? listingsCache.filter((item) => !item || typeof item !== 'object' || !isListingStale(item as Record<string, unknown>))
      : listingsCache;
  }

  const content = JSON.parse(readFileSync(SCRAPED_DATA_FILE, 'utf-8')) as unknown;
  if (!Array.isArray(content)) throw new Error('File dữ liệu cào phải là một mảng JSON.');
  listingsCache = content.filter((item) => (
    !item || typeof item !== 'object'
    || !isPlaceholderListingUrl((item as { sourceUrl?: unknown }).sourceUrl as string)
  ));
  listingsCacheMtime = mtime;
  return options.includeStale === false
    ? listingsCache.filter((item) => !item || typeof item !== 'object' || !isListingStale(item as Record<string, unknown>))
    : listingsCache;
}

export function writeScrapedListings(listings: StoredListing[]) {
  mkdirSync(dirname(SCRAPED_DATA_FILE), { recursive: true });
  const existing = readScrapedListings() as Array<Record<string, unknown>>;
  const merged = new Map(existing.map((listing) => [String(listing.externalId), listing]));
  const incomingListings = deduplicateListings(listings);

  for (const listing of incomingListings) {
    const previous = merged.get(listing.externalId);
    const previousStatus = String(previous?.verificationStatus ?? '');
    merged.set(listing.externalId, {
      externalId: listing.externalId,
      title: listing.title,
      summary: sanitizeListingSummary(listing.summary),
      price: listing.price,
      area: listing.area,
      address: listing.address,
      clusterId: listing.clusterId,
      sourceName: listing.source.name,
      sourceUrl: listing.source.url,
      verificationStatus: previousStatus === 'verified' || previousStatus === 'rejected'
        ? previousStatus
        : listing.verificationStatus,
      trustScore: listing.trustScore,
      phone: listing.phone ?? null,
      imageUrl: listing.imageUrl ?? null,
      aiAnalysis: listing.aiAnalysis,
      lastSeenAt: new Date().toISOString(),
      stale: false,
      updatedAt: new Date().toISOString()
    });
  }

  const now = Date.now();
  // A crawl is a snapshot, not an instruction to delete records absent from
  // that snapshot. Keep old records across temporary source failures.
  const retainedListings: Array<Record<string, unknown>> = [...merged.values()]
    .map((listing): Record<string, unknown> => ({
      ...listing,
      lastSeenAt: listing.lastSeenAt ?? listing.updatedAt ?? new Date(now).toISOString(),
      stale: isListingStale(listing, now)
    }));
  const uniqueListings = deduplicateListings(retainedListings.map((listing) => ({
    ...listing,
    source: {
      name: String(listing.sourceName ?? 'Nguồn dữ liệu'),
      url: typeof listing.sourceUrl === 'string' ? listing.sourceUrl : null,
      permission: String(listing.permission ?? 'unknown')
    },
    summary: sanitizeListingSummary(listing.summary),
    title: String(listing.title ?? ''),
    price: typeof listing.price === 'number' ? listing.price : null,
    area: typeof listing.area === 'number' ? listing.area : null,
    clusterId: typeof listing.clusterId === 'string' ? listing.clusterId : null,
    trustScore: typeof listing.trustScore === 'number' ? listing.trustScore : 20
  })));
  writeJsonAtomically(SCRAPED_DATA_FILE, uniqueListings);

  return incomingListings.length;
}

export function updateScrapedListingStatus(externalId: string, status: string) {
  const listings = readScrapedListings() as Array<Record<string, unknown>>;
  const listing = listings.find((item) => String(item.externalId) === externalId);
  if (!listing) return false;

  listing.verificationStatus = status;
  listing.updatedAt = new Date().toISOString();
  mkdirSync(dirname(SCRAPED_DATA_FILE), { recursive: true });
  writeJsonAtomically(SCRAPED_DATA_FILE, listings);
  return true;
}

export function writeJsonAtomically(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  renameSync(temporaryPath, filePath);
  if (filePath === SCRAPED_DATA_FILE) {
    listingsCache = null;
    listingsCacheMtime = -1;
  }
}

export function readTemplateListings(): unknown[] {
  if (!existsSync(TEMPLATE_DATA_FILE)) return [];
  const content = JSON.parse(readFileSync(TEMPLATE_DATA_FILE, 'utf-8')) as unknown;
  if (!Array.isArray(content)) throw new Error('File fixtures/listings.json phải là một mảng JSON.');
  return content;
}
