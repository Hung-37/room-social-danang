import type { RowDataPacket } from "mysql2/promise";
import { getDatabasePool } from "@/lib/mysql-pool";
import { autoAssignCluster } from "@/lib/auto-cluster";

type ListingRow = RowDataPacket & {
  id: number;
  address: string | null;
  title: string;
  summary: string;
  cluster_id: string | null;
};

/** Stable primary-key pages: classification never changes the traversal order or freshness. */
export async function reclusterDatabaseListings(
  onProgress: (updated: number, scanned: number) => void,
) {
  const connection = await getDatabasePool().getConnection();
  let updated = 0,
    scanned = 0,
    cursor = 0;
  try {
    const [bounds] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(id), 0) AS upperId FROM listings",
    );
    const upperId = Number(bounds[0].upperId);
    while (cursor < upperId) {
      await connection.beginTransaction();
      try {
        const [rows] = await connection.query<ListingRow[]>(
          "SELECT id, address, title, summary, cluster_id FROM listings WHERE id > ? AND id <= ? ORDER BY id LIMIT 200 FOR UPDATE",
          [cursor, upperId],
        );
        let batchUpdated = 0;
        for (const row of rows) {
          const cluster = autoAssignCluster(
            row.address,
            row.title,
            row.summary,
          );
          if (row.cluster_id !== cluster) {
            // Explicit assignment suppresses MySQL's ON UPDATE timestamp trigger.
            await connection.execute(
              "UPDATE listings SET cluster_id = ?, updated_at = updated_at WHERE id = ?",
              [cluster, row.id],
            );
            batchUpdated++;
          }
        }
        await connection.commit();
        updated += batchUpdated;
        scanned += rows.length;
        onProgress(updated, scanned);
        if (!rows.length) break;
        cursor = Number(rows[rows.length - 1].id);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    return { updated, scanned };
  } finally {
    connection.release();
  }
}
