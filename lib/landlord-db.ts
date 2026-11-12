import type { RowDataPacket } from "mysql2/promise";
import { getDatabasePool as db } from "@/lib/mysql-pool";
export async function landlordStatus(
  id: string,
): Promise<"pending" | "verified" | "rejected"> {
  const [rows] = await db().query(
    "SELECT v.status FROM users u LEFT JOIN landlord_verifications v ON v.user_external_id = u.external_id WHERE u.external_id = ? AND u.role = 'landlord'",
    [id],
  );
  return (
    (rows as { status: "verified" | "rejected" | null }[])[0]?.status ??
    "pending"
  );
}
export type LandlordPageOptions = {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
};
async function readPage(
  sql: string,
  countSql: string,
  params: unknown[],
  options: LandlordPageOptions,
) {
  const limit = options.limit ?? 20,
    offset = options.offset ?? 0,
    c = await db().getConnection();
  try {
    await c.beginTransaction();
    const [count] = await c.query<RowDataPacket[]>(countSql, params);
    const [items] = await c.query<RowDataPacket[]>(sql, [
      ...params,
      limit,
      offset,
    ]);
    await c.commit();
    const total = Number(count[0].total);
    return {
      items,
      meta: {
        total,
        count: items.length,
        limit,
        offset,
        hasMore: offset + items.length < total,
        nextOffset: offset + items.length,
      },
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function listLandlords(options: LandlordPageOptions = {}) {
  const where = `u.role='landlord' AND (?='' OR LOCATE(?,u.name)>0 OR LOCATE(?,u.email)>0) AND (?='' OR COALESCE(v.status,'pending')=?)`;
  const from =
    " FROM users u LEFT JOIN landlord_verifications v ON v.user_external_id=u.external_id WHERE " +
    where;
  const q = options.q ?? "",
    status = options.status ?? "";
  return readPage(
    "SELECT u.external_id AS id,u.name,u.email,COALESCE(v.status,'pending') AS status" +
      from +
      " ORDER BY u.id DESC LIMIT ? OFFSET ?",
    "SELECT COUNT(*) AS total" + from,
    [q, q, q, status, status],
    options,
  );
}
export async function verifyLandlord(
  id: string,
  status: "verified" | "rejected",
  admin: string,
) {
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query<RowDataPacket[]>(
      "SELECT external_id FROM users WHERE external_id=? AND role='landlord' FOR UPDATE",
      [id],
    );
    if (!users.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `INSERT INTO landlord_verifications (user_external_id, status, reviewed_by)
      SELECT external_id, ?, ? FROM users WHERE external_id = ? AND role = 'landlord'
      ON DUPLICATE KEY UPDATE status = VALUES(status), reviewed_by = VALUES(reviewed_by), updated_at = CURRENT_TIMESTAMP`,
      [status, admin, id],
    );
    if (status === "rejected")
      await connection.execute(
        "UPDATE listings SET verification_status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE owner_external_id=? AND verification_status='verified'",
        [id],
      );
    await connection.execute(
      "INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details) VALUES ('landlord', ?, ?, ?, JSON_OBJECT('status', ?))",
      [id, `landlord_${status}`, admin, status],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function ownListings(
  id: string,
  options: LandlordPageOptions = {},
) {
  const where = ` FROM listings WHERE owner_external_id=? AND (?='' OR LOCATE(?,title)>0 OR LOCATE(?,address)>0) AND (?='' OR verification_status=?)`;
  const q = options.q ?? "",
    status = options.status ?? "";
  return readPage(
    "SELECT external_id AS externalId,title,price,area_m2 AS area,address,image_url AS imageUrl,verification_status AS verificationStatus,updated_at AS updatedAt" +
      where +
      " ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
    "SELECT COUNT(*) AS total" + where,
    [id, q, q, q, status, status],
    options,
  );
}
