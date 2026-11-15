import type { PoolConnection, RowDataPacket } from "mysql2/promise";
/** Caller holds the parent content lock and uses READ COMMITTED for this deletion. */
export async function deletePostNotifications(c: PoolConnection, id: string) {
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT id FROM notifications WHERE SUBSTRING_INDEX(href,'#',1) IN (?,?)",
    ["/bai/" + id, "/bai/" + encodeURIComponent(id)],
  );
  // A direct DELETE on the href expression scans/locks unrelated notifications
  // and the insertion gap, conflicting with chat's AUTO_INCREMENT inserts.
  for (let offset = 0; offset < rows.length; offset += 200) {
    const ids = rows.slice(offset, offset + 200).map((row) => row.id);
    await c.query("DELETE FROM notifications WHERE id IN (?)", [ids]);
  }
}
