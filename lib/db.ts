import mysql, { type Pool } from 'mysql2/promise';
import type { ListingFilters } from '@/lib/types';
export type { ListingFilters } from '@/lib/types';

type Listing = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  phone?: string | null;
  imageUrl?: string | null;
  clusterId: string | null;
  source: { name: string; url: string | null; permission: string };
  verificationStatus: string;
  trustScore: number;
  aiAnalysis?: unknown;
};


let pool: Pool | undefined;
const LISTING_STALE_DAYS = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);

export function hasDatabaseConfig() {
  return Boolean(process.env.MYSQL_URL && process.env.MYSQL_URL.trim());
}

function getPool() {
  if (!hasDatabaseConfig()) throw new Error('MYSQL_URL is not configured.');
  pool ??= mysql.createPool({ uri: process.env.MYSQL_URL, connectionLimit: 10, waitForConnections: true, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0 });
  return pool;
}

export async function saveListings(listings: Listing[]) {
  if (!hasDatabaseConfig()) {
    console.log('Database not configured, skipping save');
    return 0;
  }

  try {
    const connection = getPool();
    let saved = 0;

    // Batch writes reduce one network round-trip per listing to one per 50 rows.
    for (let index = 0; index < listings.length; index += 50) {
      const batch = listings.slice(index, index + 50);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flatMap((listing) => [
        listing.externalId, listing.title, listing.summary, listing.price, listing.area, listing.address,
        listing.phone ?? null, listing.imageUrl ?? null, listing.clusterId, listing.source.name, listing.source.url,
        listing.source.permission, listing.verificationStatus, listing.trustScore
      ]);
      try {
        await connection.query(
          `INSERT INTO listings
            (external_id, title, summary, price, area_m2, address, phone, image_url, cluster_id, source_name, source_url, permission, verification_status, trust_score)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
            title = VALUES(title), summary = VALUES(summary), price = VALUES(price), area_m2 = VALUES(area_m2),
            address = VALUES(address), phone = VALUES(phone), image_url = VALUES(image_url), cluster_id = VALUES(cluster_id),
            trust_score = VALUES(trust_score),
            verification_status = IF(listings.verification_status IN ('verified', 'rejected'), listings.verification_status, VALUES(verification_status)),
            updated_at = CURRENT_TIMESTAMP`, values
        );
        saved += batch.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: string })?.code;
        if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'PROTOCOL_CONNECTION_LOST') {
          console.warn('MySQL unavailable; falling back to file cache only.', { code, message });
          return saved;
        }
        console.error(`Failed to save listing batch starting at ${index}:`, error);
      }
    }

    return saved;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    console.warn('Database save skipped because MySQL is unavailable.', { code, message });
    return 0;
  }
}

export async function getListings(limit = 100, offset = 0, includePending = false, search = '', clusterId = '', filters: ListingFilters = {}) {
  const orderBy = filters.sort === 'price_asc' ? 'price ASC, updated_at DESC'
    : filters.sort === 'price_desc' ? 'price DESC, updated_at DESC'
      : filters.sort === 'area_desc' ? 'area_m2 DESC, updated_at DESC' : 'updated_at DESC';
  const [rows] = await getPool().query(
    `SELECT external_id AS externalId, title, summary, price, area_m2 AS area, address,
            cluster_id AS clusterId, source_name AS sourceName, source_url AS sourceUrl,
            phone, image_url AS imageUrl, verification_status AS verificationStatus,
            trust_score AS trustScore, updated_at AS updatedAt
     FROM listings
     WHERE (? = 1 OR verification_status = 'verified')
       AND (? = 1 OR updated_at >= DATE_SUB(NOW(), INTERVAL ${LISTING_STALE_DAYS} DAY))
       AND (? IS NULL OR price >= ?)
       AND (? IS NULL OR price <= ?)
       AND (? IS NULL OR area_m2 >= ?)
       AND (? IS NULL OR area_m2 <= ?)
       AND (? = '' OR title LIKE CONCAT('%', ?, '%') OR summary LIKE CONCAT('%', ?, '%') OR address LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR cluster_id = ?)
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [includePending ? 1 : 0, includePending ? 1 : 0,
      filters.minPrice ?? null, filters.minPrice ?? null, filters.maxPrice ?? null, filters.maxPrice ?? null,
      filters.minArea ?? null, filters.minArea ?? null, filters.maxArea ?? null, filters.maxArea ?? null,
      search, search, search, search, clusterId, clusterId,
      Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)]
  );
  return rows as Array<{
    externalId: string; title: string; summary: string; price: number | null; area: number | null;
    address: string | null; clusterId: string | null; sourceName: string; sourceUrl: string | null;
    phone: string | null; imageUrl: string | null; verificationStatus: string; trustScore: number; updatedAt: string;
  }>;
}

export async function getListingCounts(search = '', clusterId = '', includePending = false, filters: ListingFilters = {}) {
  const [rows] = await getPool().query(
    `SELECT
       SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS publishedCount,
       SUM(CASE WHEN verification_status = 'needs_review' THEN 1 ELSE 0 END) AS pendingCount,
       SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount
     FROM listings
     WHERE verification_status IN ('verified', 'needs_review', 'rejected')
       AND (? = 1 OR updated_at >= DATE_SUB(NOW(), INTERVAL ${LISTING_STALE_DAYS} DAY))
       AND (? IS NULL OR price >= ?)
       AND (? IS NULL OR price <= ?)
       AND (? IS NULL OR area_m2 >= ?)
       AND (? IS NULL OR area_m2 <= ?)
       AND (? = '' OR title LIKE CONCAT('%', ?, '%') OR summary LIKE CONCAT('%', ?, '%') OR address LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR cluster_id = ?)`,
    [includePending ? 1 : 0,
      filters.minPrice ?? null, filters.minPrice ?? null, filters.maxPrice ?? null, filters.maxPrice ?? null,
      filters.minArea ?? null, filters.minArea ?? null, filters.maxArea ?? null, filters.maxArea ?? null,
      search, search, search, search, clusterId, clusterId]
  );
  const counts = (rows as Array<{ publishedCount: number | string | null; pendingCount: number | string | null; rejectedCount: number | string | null }>)[0];
  return {
    publishedCount: Number(counts?.publishedCount ?? 0),
    pendingCount: Number(counts?.pendingCount ?? 0),
    rejectedCount: Number(counts?.rejectedCount ?? 0)
  };
}

export async function getListingById(externalId: string) {
  const [rows] = await getPool().query(
    `SELECT external_id AS externalId, title, summary, price, area_m2 AS area, address,
            cluster_id AS clusterId, source_name AS sourceName, source_url AS sourceUrl,
            phone, image_url AS imageUrl, verification_status AS verificationStatus,
            trust_score AS trustScore, updated_at AS updatedAt
     FROM listings
    WHERE external_id = ? AND verification_status = 'verified'
      AND updated_at >= DATE_SUB(NOW(), INTERVAL ${LISTING_STALE_DAYS} DAY)`,
    [externalId]
  );
  const listings = rows as Array<{
    externalId: string; title: string; summary: string; price: number | null; area: number | null;
    address: string | null; clusterId: string | null; sourceName: string; sourceUrl: string | null;
    phone: string | null; imageUrl: string | null; verificationStatus: string; trustScore: number; updatedAt: string;
  }>;
  return listings[0] || null;
}

export async function updateListingStatus(externalId: string, status: string) {
  const connection = getPool();
  await connection.execute(
    `UPDATE listings SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE external_id = ?`,
    [status, externalId]
  );
}

export async function updateListingTrust(externalId: string, trustScore: number) {
  const connection = getPool();
  await connection.execute(
    `UPDATE listings SET trust_score = ?, updated_at = CURRENT_TIMESTAMP WHERE external_id = ?`,
    [trustScore, externalId]
  );
}

export async function updateListingCluster(externalId: string, clusterId: string) {
  const connection = getPool();
  await connection.execute(
    `UPDATE listings SET cluster_id = ?, updated_at = CURRENT_TIMESTAMP WHERE external_id = ?`,
    [clusterId, externalId]
  );
}
