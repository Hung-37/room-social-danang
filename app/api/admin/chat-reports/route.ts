import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getDatabasePool } from '@/lib/mysql-pool';
import { apiData, apiError } from '@/lib/api-response';
import type { ResultSetHeader } from 'mysql2/promise';
export async function GET(r: Request) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quản trị viên.', 401);
  try {
    const [rows] = await getDatabasePool().query(
      'SELECT r.id,r.conversation_id AS conversationId,r.reason,r.status,r.created_at AS createdAt,u.name AS reporter FROM conversation_reports r JOIN users u ON u.external_id=r.reporter_id ORDER BY r.created_at DESC LIMIT 100'
    );
    return apiData(rows, {}, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return apiError('Chưa thể tải báo cáo.', 503);
  }
}
export async function PATCH(r: Request) {
  const admin = getAdminSessionFromRequest(r);
  if (!admin) return apiError('Yêu cầu quản trị viên.', 401);
  const b = await r.json().catch(() => null);
  if (typeof b?.id !== 'string' || !['resolved', 'dismissed'].includes(b.status))
    return apiError('Dữ liệu không hợp lệ.', 400);
  const c = await getDatabasePool().getConnection();
  try {
    await c.beginTransaction();
    const [result] = await c.execute<ResultSetHeader>(
      'UPDATE conversation_reports SET status=? WHERE id=?',
      [b.status, b.id]
    );
    if (!result.affectedRows) {
      await c.rollback();
      return apiError('Không tìm thấy báo cáo.', 404);
    }
    await c.execute(
      'INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) VALUES (?,?,?,?,?)',
      [
        'chat_report',
        b.id,
        'chat_report_' + b.status,
        admin.email,
        JSON.stringify({ status: b.status })
      ]
    );
    await c.commit();
    return apiData({ success: true });
  } catch {
    await c.rollback();
    return apiError('Chưa thể cập nhật báo cáo.', 503);
  } finally {
    c.release();
  }
}
