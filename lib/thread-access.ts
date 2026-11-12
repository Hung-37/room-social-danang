import { getDatabasePool, hasDatabaseConfig } from "@/lib/mysql-pool";
import {
  getCommunityPostById,
  getCommunityCommentCount,
} from "@/lib/community-db";
import { getListingById } from "@/lib/db";
import { normalizeToRoomPost } from "@/lib/data";
import { readScrapedListings, isListingStale } from "@/lib/file-storage";
import { listCommunityPosts } from "@/lib/server-community-storage";

export async function getPublicThread(
  id: string,
): Promise<{ id: string; kind: "community" | "listing" } | null> {
  if (hasDatabaseConfig()) {
    const staleDays = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);
    const [rows] = await getDatabasePool().query(
      `SELECT id, status, 'community' AS kind, 1 AS fresh FROM community_posts WHERE id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT external_id AS id, verification_status AS status, 'listing' AS kind,
              updated_at >= DATE_SUB(NOW(), INTERVAL ${staleDays} DAY) AS fresh FROM listings WHERE external_id = ?
       LIMIT 1`,
      [id, id],
    );
    const row = (
      rows as Array<{
        id: string;
        status: string;
        kind: "community" | "listing";
        fresh: number;
      }>
    )[0];
    return row?.status === "verified" && row.fresh
      ? { id: row.id, kind: row.kind }
      : null;
  }
  const listing = readScrapedListings({ includeStale: true }).find(
    (value) =>
      value &&
      typeof value === "object" &&
      (value as { externalId?: unknown }).externalId === id,
  ) as Record<string, unknown> | undefined;
  if (listing)
    return listing.verificationStatus === "verified" && !isListingStale(listing)
      ? { id, kind: "listing" }
      : null;
  const post = listCommunityPosts(true).find(
    (post) => post.id === id && !post.price,
  );
  return post?.status === "Còn phòng" ? { id, kind: "community" } : null;
}

export async function getPublicThreadPost(id: string) {
  const thread = await getPublicThread(id);
  if (!thread) return null;
  if (hasDatabaseConfig()) {
    if (thread.kind === "community") return getCommunityPostById(id);
    const listing = await getListingById(id);
    if (!listing) return null;
    const [images] = await getDatabasePool().query(
      "SELECT id FROM listing_images WHERE listing_id=? ORDER BY position,id LIMIT 4",
      [id],
    );
    return {
      ...normalizeToRoomPost({
        ...listing,
        commentCount: await getCommunityCommentCount(id),
      }),
      imageUrls: (images as { id: string }[]).map((i) => "/api/images/" + i.id),
    };
  }
  if (thread.kind === "community")
    return listCommunityPosts().find((post) => post.id === id) ?? null;
  const listing = readScrapedListings({ includeStale: false }).find(
    (value) =>
      value &&
      typeof value === "object" &&
      (value as { externalId?: unknown }).externalId === id,
  );
  return listing
    ? normalizeToRoomPost(listing as Record<string, unknown>)
    : null;
}
