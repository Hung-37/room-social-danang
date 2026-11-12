import { lockListingOwner, reviewRevisionSql } from "./listing-eligibility";
import { MutationError } from "./mutation-errors";
import schemaContract from "@/database/schema-contract.json";
import { withListingWriteLock } from "./listing-write-lock";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import {
  getDatabasePool as getPool,
  hasDatabaseConfig,
} from "@/lib/mysql-pool";
export { hasDatabaseConfig } from "@/lib/mysql-pool";
import type { ListingFilters } from "@/lib/types";
export type { ListingFilters } from "@/lib/types";

type Listing = {
  externalId: string;
  ownerExternalId?: string;
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

const LISTING_STALE_DAYS = Math.max(
  Number(process.env.LISTING_STALE_DAYS) || 30,
  1,
);

export async function saveListings(
  listings: Listing[],
  existingConnection?: PoolConnection,
) {
  if (!hasDatabaseConfig()) {
    console.log("Database not configured, skipping save");
    return 0;
  }

  try {
    const write = async (connection: PoolConnection) => {
      let saved = 0;

      // Batch writes reduce one network round-trip per listing to one per 50 rows.
      for (let index = 0; index < listings.length; index += 50) {
        const candidates = listings.slice(index, index + 50);
        const [removed] = await connection.query<RowDataPacket[]>(
          `SELECT external_id FROM listing_deletions WHERE external_id IN (${candidates.map(() => "?").join(",")})`,
          candidates.map((listing) => listing.externalId),
        );
        const removedIds = new Set(
          removed.map((row) => String(row.external_id)),
        );
        const batch = candidates.filter(
          (listing) => !removedIds.has(listing.externalId),
        );
        if (!batch.length) continue;
        const placeholders = batch
          .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .join(", ");
        const values = batch.flatMap((listing) => [
          listing.externalId,
          listing.title,
          listing.summary,
          listing.price,
          listing.area,
          listing.address,
          listing.phone ?? null,
          listing.imageUrl ?? null,
          listing.clusterId,
          listing.source.name,
          listing.source.url,
          listing.source.permission,
          listing.verificationStatus,
          listing.trustScore,
          listing.ownerExternalId ?? null,
        ]);
        try {
          await connection.query(
            `INSERT INTO listings
            (external_id, title, summary, price, area_m2, address, phone, image_url, cluster_id, source_name, source_url, permission, verification_status, trust_score, owner_external_id)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
            verification_status=IF(listings.verification_status IN ('rejected','hidden','rented'),listings.verification_status,IF(listings.verification_status='verified' AND title<=>VALUES(title) AND summary<=>VALUES(summary) AND price<=>VALUES(price) AND area_m2<=>VALUES(area_m2) AND address<=>VALUES(address) AND image_url<=>VALUES(image_url),'verified','needs_review')),
            title = VALUES(title), summary = VALUES(summary), price = VALUES(price), area_m2 = VALUES(area_m2),
            address = VALUES(address), phone = VALUES(phone), image_url = VALUES(image_url), cluster_id = VALUES(cluster_id),
            trust_score = VALUES(trust_score),
            updated_at = CURRENT_TIMESTAMP`,
            values,
          );
          saved += batch.length;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const code = (error as { code?: string })?.code;
          if (
            code === "ECONNREFUSED" ||
            code === "ETIMEDOUT" ||
            code === "PROTOCOL_CONNECTION_LOST"
          ) {
            console.warn("MySQL unavailable; batch not saved.", {
              code,
              message,
            });
            return saved;
          }
          console.error(
            `Failed to save listing batch starting at ${index}:`,
            error,
          );
        }
      }

      return saved;
    };
    return existingConnection
      ? await write(existingConnection)
      : await withListingWriteLock(write);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    console.warn("Database save skipped because MySQL is unavailable.", {
      code,
      message,
    });
    return 0;
  }
}

export async function getListings(
  limit = 100,
  offset = 0,
  includePending = false,
  search = "",
  clusterId = "",
  filters: ListingFilters = {},
) {
  const orderBy =
    filters.sort === "price_asc"
      ? "price ASC, updated_at DESC, id DESC"
      : filters.sort === "price_desc"
        ? "price DESC, updated_at DESC, id DESC"
        : filters.sort === "area_desc"
          ? "area_m2 DESC, updated_at DESC, id DESC"
          : "updated_at DESC, id DESC";
  const [rows] = await getPool().query(
    `SELECT external_id AS externalId, title, summary, price, area_m2 AS area, address,
            cluster_id AS clusterId, source_name AS sourceName, source_url AS sourceUrl,
            phone, image_url AS imageUrl, verification_status AS verificationStatus,
            trust_score AS trustScore, updated_at AS updatedAt, ${includePending ? reviewRevisionSql : "NULL"} AS reviewRevision
     FROM listings
     WHERE (? = 1 OR verification_status = 'verified')
       AND (? = 1 OR updated_at >= DATE_SUB(NOW(), INTERVAL ${LISTING_STALE_DAYS} DAY))
       AND (? IS NULL OR price >= ?)
       AND (? IS NULL OR price <= ?)
       AND (? IS NULL OR area_m2 >= ?)
       AND (? IS NULL OR area_m2 <= ?)
       AND (? = '' OR title LIKE CONCAT('%', ?, '%') OR summary LIKE CONCAT('%', ?, '%') OR address LIKE CONCAT('%', ?, '%') OR source_name LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR cluster_id = ?)
       AND (? = '' OR verification_status = ?)
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [
      includePending ? 1 : 0,
      includePending ? 1 : 0,
      filters.minPrice ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.maxPrice ?? null,
      filters.minArea ?? null,
      filters.minArea ?? null,
      filters.maxArea ?? null,
      filters.maxArea ?? null,
      search,
      search,
      search,
      search,
      search,
      clusterId,
      clusterId,
      filters.status ?? "",
      filters.status ?? "",
      Math.min(Math.max(limit, 1), 200),
      Math.max(offset, 0),
    ],
  );
  return rows as Array<{
    reviewRevision: string;
    externalId: string;
    title: string;
    summary: string;
    price: number | null;
    area: number | null;
    address: string | null;
    clusterId: string | null;
    sourceName: string;
    sourceUrl: string | null;
    phone: string | null;
    imageUrl: string | null;
    verificationStatus: string;
    trustScore: number;
    updatedAt: string;
  }>;
}

export async function getListingCounts(
  search = "",
  clusterId = "",
  includePending = false,
  filters: ListingFilters = {},
) {
  const [rows] = await getPool().query(
    `SELECT
       SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS publishedCount,
       SUM(CASE WHEN verification_status = 'needs_review' THEN 1 ELSE 0 END) AS pendingCount,
       SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount,
       SUM(CASE WHEN verification_status = 'hidden' THEN 1 ELSE 0 END) AS hiddenCount,
       SUM(CASE WHEN verification_status = 'rented' THEN 1 ELSE 0 END) AS rentedCount
     FROM listings
     WHERE verification_status IN ('verified', 'needs_review', 'rejected', 'hidden', 'rented')
       AND (? = 1 OR updated_at >= DATE_SUB(NOW(), INTERVAL ${LISTING_STALE_DAYS} DAY))
       AND (? IS NULL OR price >= ?)
       AND (? IS NULL OR price <= ?)
       AND (? IS NULL OR area_m2 >= ?)
       AND (? IS NULL OR area_m2 <= ?)
       AND (? = '' OR title LIKE CONCAT('%', ?, '%') OR summary LIKE CONCAT('%', ?, '%') OR address LIKE CONCAT('%', ?, '%') OR source_name LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR cluster_id = ?)
       AND (? = '' OR verification_status = ?)`,
    [
      includePending ? 1 : 0,
      filters.minPrice ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.maxPrice ?? null,
      filters.minArea ?? null,
      filters.minArea ?? null,
      filters.maxArea ?? null,
      filters.maxArea ?? null,
      search,
      search,
      search,
      search,
      search,
      clusterId,
      clusterId,
      filters.status ?? "",
      filters.status ?? "",
    ],
  );
  const counts = (
    rows as Array<{
      publishedCount: number | string | null;
      pendingCount: number | string | null;
      rejectedCount: number | string | null;
      hiddenCount: number | string | null;
      rentedCount: number | string | null;
    }>
  )[0];
  return {
    publishedCount: Number(counts?.publishedCount ?? 0),
    pendingCount: Number(counts?.pendingCount ?? 0),
    rejectedCount: Number(counts?.rejectedCount ?? 0),
    hiddenCount: Number(counts?.hiddenCount ?? 0),
    rentedCount: Number(counts?.rentedCount ?? 0),
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
    [externalId],
  );
  const listings = rows as Array<{
    externalId: string;
    title: string;
    summary: string;
    price: number | null;
    area: number | null;
    address: string | null;
    clusterId: string | null;
    sourceName: string;
    sourceUrl: string | null;
    phone: string | null;
    imageUrl: string | null;
    verificationStatus: string;
    trustScore: number;
    updatedAt: string;
  }>;
  return listings[0] || null;
}

export async function updateListingStatus(
  externalId: string,
  status: string,
  actor: string,
  revision?: unknown,
) {
  if (
    revision !== undefined &&
    (typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision))
  )
    throw new MutationError("Phiên bản duyệt không hợp lệ.", 400);
  const c = await getPool().getConnection();
  try {
    const [owners] = await c.query<RowDataPacket[]>(
      "SELECT owner_external_id FROM listings WHERE external_id=?",
      [externalId],
    );
    if (!owners[0]) {
      await c.rollback();
      return false;
    }
    await c.beginTransaction();
    if (owners[0].owner_external_id && status === "verified")
      await lockListingOwner(c, owners[0].owner_external_id);
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT owner_external_id,verification_status,${reviewRevisionSql} AS reviewRevision FROM listings WHERE external_id=? FOR UPDATE`,
      [externalId],
    );
    if (!rows[0]) {
      await c.rollback();
      return false;
    }
    if (rows[0].owner_external_id !== owners[0].owner_external_id)
      throw new MutationError("Chủ sở hữu tin đã thay đổi. Hãy tải lại.", 409);
    if (revision !== undefined && revision !== rows[0].reviewRevision)
      throw new MutationError(
        "Tin đã thay đổi sau khi tải. Hãy tải lại trước khi duyệt.",
        409,
        "VERSION_CONFLICT",
      );
    if (
      ["hidden", "rented"].includes(rows[0].verification_status) &&
      status !== "rejected"
    )
      throw new MutationError(
        "Chủ trọ đã ẩn hoặc hết phòng. Cần chủ trọ gửi duyệt lại trước khi công khai.",
        409,
      );
    await c.execute(
      "UPDATE listings SET verification_status=?,updated_at=CURRENT_TIMESTAMP WHERE external_id=?",
      [status, externalId],
    );
    await c.execute(
      "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) VALUES('listing',?,?,?,JSON_OBJECT('status',?))",
      [externalId, `listing_${status}`, actor, status],
    );
    await c.commit();
    return true;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function updateListingTrust(
  externalId: string,
  trustScore: number,
) {
  const connection = getPool();
  await connection.execute(
    `UPDATE listings SET trust_score = ?, updated_at = CURRENT_TIMESTAMP WHERE external_id = ?`,
    [trustScore, externalId],
  );
}

export async function updateListingCluster(
  externalId: string,
  clusterId: string,
) {
  const connection = getPool();
  await connection.execute(
    `UPDATE listings SET cluster_id = ?, updated_at = updated_at WHERE external_id = ?`,
    [clusterId, externalId],
  );
}

export async function checkDatabaseHealth() {
  // Resolve the actual application tables/columns without reading user rows.
  // SELECT 1 alone also succeeds on an empty or partially migrated database.
  const tables = Object.entries(schemaContract);
  const columns = tables.flatMap(([, names], index) =>
    names.map((name) => `t${index}.\`${name}\``),
  );
  const from = tables.map(([name], index) => `\`${name}\` AS t${index}`);
  await getPool().query({
    sql: `SELECT ${columns.join(",")} FROM ${from.join(",")} WHERE 1=0`,
    timeout: 5000,
  });
}
