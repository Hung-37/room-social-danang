import { deletePostNotifications } from "./post-notifications";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import { getDatabasePool } from "./mysql-pool";
import { withListingWriteLock } from "./listing-write-lock";

export class ListingDeletionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function deletedListingIds(
  ids: string[],
  connection?: PoolConnection,
) {
  const executor = connection ?? getDatabasePool();
  const deleted = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const [rows] = await executor.query<RowDataPacket[]>(
      `SELECT external_id FROM listing_deletions WHERE external_id IN (${batch.map(() => "?").join(",")})`,
      batch,
    );
    for (const row of rows) deleted.add(String(row.external_id));
  }
  return deleted;
}

export async function deleteRejectedListing(
  id: string,
  reason: string,
  actor: string,
) {
  return withListingWriteLock(async (connection) => {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT external_id,title,verification_status,owner_external_id FROM listings WHERE external_id=? FOR UPDATE",
        [id],
      );
      if (!rows[0]) {
        const [previous] = await connection.query<RowDataPacket[]>(
          "SELECT external_id FROM listing_deletions WHERE external_id=?",
          [id],
        );
        if (!previous.length)
          throw new ListingDeletionError("Không tìm thấy tin phòng.", 404);
        await connection.commit();
        return {
          deleted: true,
          alreadyDeleted: true,
          externalId: String(previous[0].external_id),
        };
      }
      // Use the stored identifier even when a URL differs only in letter case.
      id = String(rows[0].external_id);
      if (rows[0].verification_status !== "rejected")
        throw new ListingDeletionError(
          "Chỉ được xóa tin đã bị từ chối. Hãy kiểm tra lại trạng thái tin.",
          409,
        );
      await connection.execute(
        "INSERT INTO listing_deletions(external_id,title,reason,deleted_by) VALUES(?,?,?,?)",
        [id, rows[0].title, reason, actor],
      );
      await connection.execute(
        "DELETE FROM comment_replies WHERE comment_id IN (SELECT id FROM community_comments WHERE post_id=?) OR parent_id IN (SELECT id FROM community_comments WHERE post_id=?)",
        [id, id],
      );
      for (const table of [
        "community_comments",
        "community_reactions",
        "community_reports",
        "saved_posts",
      ])
        await connection.execute(`DELETE FROM ${table} WHERE post_id=?`, [id]);
      await connection.execute(
        "DELETE FROM listing_images WHERE listing_id=?",
        [id],
      );
      await connection.execute(
        "DELETE FROM listing_ai_analysis WHERE listing_id=?",
        [id],
      );
      await deletePostNotifications(connection, id);
      await connection.execute(
        "UPDATE mutation_requests SET response_json=NULL,deleted=TRUE WHERE scope='listing_create' AND result_id=?",
        [id],
      );
      await connection.execute("DELETE FROM listings WHERE external_id=?", [
        id,
      ]);
      await connection.execute(
        "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) VALUES('listing',?,'listing_deleted',?,?)",
        [
          id,
          actor,
          JSON.stringify({
            title: rows[0].title,
            reason,
            previousStatus: "rejected",
            conversationHistoryPreserved: true,
          }),
        ],
      );
      if (rows[0].owner_external_id) {
        await connection.execute(
          "INSERT INTO notifications(user_id,type,title,body,href) SELECT id,'listing_deleted','Tin phòng bị từ chối đã được xóa',?,'/quan-ly-phong' FROM users WHERE external_id=?",
          [rows[0].title + ": " + reason, rows[0].owner_external_id],
        );
      }
      await connection.commit();
      return { deleted: true, alreadyDeleted: false, externalId: id };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}
