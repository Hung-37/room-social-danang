import type { RowDataPacket } from "mysql2/promise";
import { clusters } from "@/lib/data";
import { getDatabasePool, hasDatabaseConfig } from "@/lib/mysql-pool";
import { readScrapedListings } from "@/lib/file-storage";
import { listCommunityPosts } from "@/lib/server-community-storage";

export async function getClusterOverview() {
  const rooms = new Map<string, number>();
  const discussions = new Map<string, number>();
  if (hasDatabaseConfig()) {
    const staleDays = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);
    const [[roomRows], [discussionRows]] = await Promise.all([
      getDatabasePool().query<RowDataPacket[]>(
        `SELECT cluster_id AS clusterId, COUNT(*) AS total FROM listings
         WHERE verification_status = 'verified' AND updated_at >= DATE_SUB(NOW(), INTERVAL ${staleDays} DAY)
         GROUP BY cluster_id`,
      ),
      getDatabasePool().query<RowDataPacket[]>(
        "SELECT cluster_id AS clusterId, COUNT(*) AS total FROM community_posts WHERE status = 'verified' AND deleted_at IS NULL GROUP BY cluster_id",
      ),
    ]);
    for (const row of roomRows)
      rooms.set(String(row.clusterId), Number(row.total));
    for (const row of discussionRows)
      discussions.set(String(row.clusterId), Number(row.total));
  } else {
    for (const value of readScrapedListings({ includeStale: false })) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      if (row.verificationStatus === "verified") {
        const id = String(row.clusterId || "chua-phan-cum");
        rooms.set(id, (rooms.get(id) || 0) + 1);
      }
    }
    for (const post of listCommunityPosts()) {
      if (!post.price)
        discussions.set(
          post.clusterId,
          (discussions.get(post.clusterId) || 0) + 1,
        );
    }
  }
  return clusters.map((cluster) => ({
    ...cluster,
    roomCount: rooms.get(cluster.id) || 0,
    discussionCount: discussions.get(cluster.id) || 0,
  }));
}
