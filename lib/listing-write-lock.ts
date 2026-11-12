import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDatabasePool } from "./mysql-pool";

/** Serialize collector upserts with Admin deletion across processes using the same DB. */
export async function withListingWriteLock<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getDatabasePool().getConnection();
  let locked = false,
    destroyed = false;
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('room-listings:',SHA1(DATABASE())),10) AS acquired",
    );
    if (Number(rows[0].acquired) !== 1)
      throw new Error("Đang có thao tác lưu tin khác. Vui lòng thử lại.");
    locked = true;
    return await work(connection);
  } finally {
    if (locked) {
      try {
        await connection.query(
          "DO RELEASE_LOCK(CONCAT('room-listings:',SHA1(DATABASE())))",
        );
      } catch {
        connection.destroy();
        destroyed = true;
      }
    }
    if (!destroyed) connection.release();
  }
}
