import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getDatabasePool } from '@/lib/mysql-pool';
import { apiData, apiError } from '@/lib/api-response';
import type { RowDataPacket } from 'mysql2/promise';
export async function GET(r: Request) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quyền Admin.', 401);
  const p = new URL(r.url).searchParams,
    q = (p.get('q') || '').trim(),
    role = p.get('role') || '',
    state = p.get('state') || '',
    page = Number(p.get('page') || 0);
  if (
    q.length > 100 ||
    !['', 'student', 'landlord', 'admin'].includes(role) ||
    !['', 'active', 'blocked', 'demo'].includes(state) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 100000
  )
    return apiError('Bộ lọc người dùng không hợp lệ.', 400);
  try {
    const where =
        "(?='' OR LOCATE(?,u.name)>0 OR LOCATE(?,u.email)>0) AND (?='' OR u.role=?) AND (?<>'blocked' OR COALESCE(c.blocked,0)=1) AND (?<>'active' OR COALESCE(c.blocked,0)=0) AND (?<>'demo' OR COALESCE(c.is_demo,0)=1)",
      params = [q, q, q, role, role, state, state, state];
    const [count] = await getDatabasePool().query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM users u LEFT JOIN user_controls c ON c.user_id=u.external_id WHERE ' +
        where,
      params
    );
    const [rows] = await getDatabasePool().query<RowDataPacket[]>(
      `SELECT u.external_id AS id,u.name,u.email,u.role,u.created_at AS createdAt,COALESCE(c.blocked,0) AS blocked,COALESCE(c.is_demo,0) AS isDemo,COALESCE(c.version,0) AS version,COALESCE(c.reason,'') AS reason,(SELECT COUNT(*) FROM community_comments a WHERE a.author_id=u.id AND a.deleted_at IS NULL) AS comments,(SELECT COUNT(*) FROM listings a WHERE a.owner_external_id=u.external_id) AS listings FROM users u LEFT JOIN user_controls c ON c.user_id=u.external_id WHERE ${where} ORDER BY u.id DESC LIMIT 10 OFFSET ?`,
      [...params, page * 10]
    );
    return apiData(
      rows,
      { total: Number(count[0].total), page },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return apiError('Chưa tải được người dùng.', 503);
  }
}
export async function PATCH(r: Request) {
  const admin = getAdminSessionFromRequest(r);
  if (!admin) return apiError('Yêu cầu quyền Admin.', 401);
  const b = await r.json().catch(() => null);
  if (
    typeof b?.id !== 'string' ||
    b.id.length > 191 ||
    typeof b.blocked !== 'boolean' ||
    typeof b.reason !== 'string' ||
    b.reason.trim().length < 5 ||
    b.reason.length > 500 ||
    !Number.isSafeInteger(b.version) ||
    b.version < 0
  )
    return apiError('Chọn người dùng, trạng thái và lý do (5–500 ký tự) hợp lệ.', 400);
  let c;
  try {
    c = await getDatabasePool().getConnection();
    await c.beginTransaction();
    const [users] = await c.query<RowDataPacket[]>(
      'SELECT external_id,role FROM users WHERE external_id=? FOR UPDATE',
      [b.id]
    );
    if (!users[0]) {
      await c.rollback();
      return apiError('Không tìm thấy người dùng.', 404);
    }
    if (users[0].role === 'admin') {
      await c.rollback();
      return apiError('Không khóa tài khoản quản trị từ màn hình này.', 403);
    }
    const [controls] = await c.query<RowDataPacket[]>(
      'SELECT version FROM user_controls WHERE user_id=? FOR UPDATE',
      [b.id]
    );
    if (Number(controls[0]?.version || 0) !== b.version) {
      await c.rollback();
      return apiError('Người dùng đã được cập nhật. Tải lại để xem trạng thái mới.', 409);
    }
    await c.execute(
      'INSERT INTO user_controls(user_id,blocked,reason,version,updated_by) VALUES (?,?,?,1,?) ON DUPLICATE KEY UPDATE blocked=VALUES(blocked),reason=VALUES(reason),version=version+1,updated_by=VALUES(updated_by)',
      [b.id, b.blocked, b.reason.trim(), admin.email]
    );
    await c.execute(
      "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) VALUES ('user',?,?,?,?)",
      [
        b.id,
        b.blocked ? 'user_block' : 'user_unblock',
        admin.email,
        JSON.stringify({ reason: b.reason.trim() })
      ]
    );
    await c.commit();
    return apiData({ id: b.id, blocked: b.blocked, version: b.version + 1 });
  } catch {
    if (c) await c.rollback();
    return apiError('Chưa cập nhật được người dùng.', 503);
  } finally {
    c?.release();
  }
}
