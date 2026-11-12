import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDatabasePool } from "./mysql-pool";
import { MutationError } from "./mutation-errors";
export function submissionKey(request: Request) {
  const key = request.headers.get("Idempotency-Key");
  if (key !== null && !/^[A-Za-z0-9_-]{16,80}$/.test(key))
    throw new MutationError(
      "Khóa gửi dữ liệu không hợp lệ.",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  return key;
}
export async function createOnce<
  T extends { id?: string; externalId?: string },
>(
  user: string,
  scope: string,
  key: string | null,
  payload: unknown,
  write: (c: PoolConnection) => Promise<T>,
) {
  const c = await getDatabasePool().getConnection();
  try {
    await c.beginTransaction();
    if (key) {
      const hash = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      await c.execute(
        "INSERT INTO mutation_requests(user_id,scope,request_key,fingerprint) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE request_key=VALUES(request_key)",
        [user, scope, key, hash],
      );
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT fingerprint,response_json,deleted FROM mutation_requests WHERE user_id=? AND scope=? AND request_key=? FOR UPDATE",
        [user, scope, key],
      );
      if (rows[0].fingerprint !== hash)
        throw new MutationError(
          "Khóa gửi này đã dùng cho nội dung khác. Hãy gửi lại bằng một lần gửi mới.",
          409,
          "IDEMPOTENCY_CONFLICT",
        );
      if (rows[0].deleted)
        throw new MutationError(
          "Nội dung của lần gửi này đã bị xóa. Không thể khôi phục bằng cách gửi lại.",
          410,
          "RESOURCE_DELETED",
        );
      if (rows[0].response_json !== null) {
        const value = (
          typeof rows[0].response_json === "string"
            ? JSON.parse(rows[0].response_json)
            : rows[0].response_json
        ) as T;
        await c.commit();
        return { value, replayed: true };
      }
    }
    const value = await write(c);
    const resultId = value.id ?? value.externalId;
    if (!resultId) throw new Error("Creation must return a resource ID.");
    if (key)
      await c.execute(
        "UPDATE mutation_requests SET result_id=?,response_json=? WHERE user_id=? AND scope=? AND request_key=?",
        [resultId, JSON.stringify(value), user, scope, key],
      );
    await c.commit();
    return { value, replayed: false };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
