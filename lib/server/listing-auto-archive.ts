import type { RowDataPacket } from "mysql2/promise";
import type { NormalizedListing } from "@/lib/server/collector/parser.js";
import {
  scanAutoDuplicates,
  type AutoDuplicateMatch,
  type SimilarityInput,
} from "@/lib/server/collector/similarity.js";
import { withListingWriteLock } from "./listing-write-lock";
import { getDatabasePool, hasDatabaseConfig } from "./mysql-pool";

export type AutoArchiveResult = {
  scanned: number;
  archived: Array<{ id: string; keep: string; score: number }>;
};

const AUTO_ARCHIVE_ACTOR = "collector-ml";

function toSimilarityInput(listing: NormalizedListing): SimilarityInput {
  return {
    id: listing.externalId,
    title: listing.title,
    summary: listing.summary?.slice(0, 400),
    address: listing.address,
    imageUrl: listing.imageUrl ?? null,
    clusterId: listing.clusterId,
    url: listing.source.url,
  };
}

// Runs after listings are saved. Only rows inserted by this scrape (still
// 'needs_review') can be hidden; existing verified/pending rows are never
// touched. Pairs require a near-identical cover image, so text-only lookalikes
// stay for manual review.
export async function archiveNearDuplicateListings(
  listings: NormalizedListing[],
): Promise<AutoArchiveResult> {
  const empty: AutoArchiveResult = { scanned: 0, archived: [] };
  if (
    process.env.LISTING_AUTO_ARCHIVE === "0" ||
    !hasDatabaseConfig() ||
    !listings.length
  )
    return empty;

  try {
    const newIds = new Set(listings.map((listing) => listing.externalId));
    const newIndex = new Map(
      listings.map((listing, index) => [listing.externalId, index]),
    );
    const [rows] = await getDatabasePool().query<
      (RowDataPacket & SimilarityInput & { status: string })[]
    >(
      `SELECT external_id AS id, title, LEFT(summary, 400) AS summary, address,
              image_url AS imageUrl, cluster_id AS clusterId, source_url AS url,
              verification_status AS status
         FROM listings
        WHERE verification_status IN ('verified','needs_review') AND source_url IS NOT NULL
        ORDER BY updated_at DESC, id DESC LIMIT 200`,
    );
    const stored = rows.filter((row) => !newIds.has(row.id));
    // New listings keep priority; stored rows fill the remaining slots up to
    // the scanners' 200-row cap.
    const input = [
      ...listings.map(toSimilarityInput),
      ...stored,
    ].slice(0, 200);
    const pairs: AutoDuplicateMatch[] = await scanAutoDuplicates(input);

    const plan = new Map<string, { keep: string; score: number }>();
    for (const pair of pairs) {
      const leftNew = newIds.has(pair.left);
      const rightNew = newIds.has(pair.right);
      if (leftNew === rightNew) continue;
      const hide = leftNew ? pair.left : pair.right;
      const keep = leftNew ? pair.right : pair.left;
      const existing = plan.get(hide);
      if (!existing || pair.score > existing.score)
        plan.set(hide, { keep, score: pair.score });
    }
    // Both sides new: keep the earlier listing in scrape order.
    for (const pair of pairs) {
      if (!newIds.has(pair.left) || !newIds.has(pair.right)) continue;
      const [first, second] =
        (newIndex.get(pair.left) ?? 0) <= (newIndex.get(pair.right) ?? 0)
          ? [pair.left, pair.right]
          : [pair.right, pair.left];
      if (!plan.has(second))
        plan.set(second, { keep: first, score: pair.score });
    }
    if (!plan.size) return { scanned: input.length, archived: [] };

    const archived: AutoArchiveResult["archived"] = [];
    await withListingWriteLock(async (connection) => {
      await connection.beginTransaction();
      try {
        for (const [id, { keep, score }] of plan) {
          const [result] = await connection.execute(
            `UPDATE listings SET verification_status='rejected', updated_at=CURRENT_TIMESTAMP
              WHERE external_id=? AND verification_status='needs_review'`,
            [id],
          );
          const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
          if (!affected) continue;
          await connection.execute(
            `INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details)
             VALUES('listing',?,'duplicate_auto_archived',?,?)`,
            [id, AUTO_ARCHIVE_ACTOR, JSON.stringify({ keep, score })],
          );
          archived.push({ id, keep, score });
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
    return { scanned: input.length, archived };
  } catch (error) {
    console.warn(
      "Auto-archive similarity scan skipped:",
      error instanceof Error ? error.message : error,
    );
    return empty;
  }
}
