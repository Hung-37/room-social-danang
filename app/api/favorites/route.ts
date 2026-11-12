import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { savedPosts } from '@/lib/account-db';
import { getDatabasePool } from '@/lib/mysql-pool';
import { getPublicThread } from '@/lib/thread-access';
import type { RowDataPacket } from 'mysql2/promise';
export async function GET(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  try {
    return apiData(
      await savedPosts(user.id),
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return apiError('Chưa tải được danh sách đã lưu.', 503);
  }
}
export async function PUT(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const b = await r.json().catch(() => null);
  if (typeof b?.id !== 'string' || !b.id || b.id.length > 191 || typeof b.saved !== 'boolean')
    return apiError('Dữ liệu lưu bài không hợp lệ.', 400);
  try {
    if (!b.saved) {
      await getDatabasePool().execute('DELETE FROM saved_posts WHERE user_id=? AND post_id=?', [
        user.id,
        b.id
      ]);
      return apiData({ saved: false });
    }
    if (!(await getPublicThread(b.id))) return apiError('Tin không còn công khai.', 404);
    const c = await getDatabasePool().getConnection();
    try {
      await c.beginTransaction();
      const [users] = await c.query<RowDataPacket[]>(
        'SELECT external_id FROM users WHERE external_id=? FOR UPDATE',
        [user.id]
      );
      if (!users.length) {
        await c.rollback();
        return apiError('Tài khoản không còn tồn tại.', 401);
      }
      const [count] = await c.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM saved_posts WHERE user_id=? AND post_id<>?',
        [user.id, b.id]
      );
      if (Number(count[0].total) >= 500) {
        await c.rollback();
        return apiError('Bạn đã lưu tối đa 500 bài. Hãy bỏ lưu một số bài trước.', 409);
      }
      await c.execute(
        'INSERT INTO saved_posts(user_id,post_id) VALUES (?,?) ON DUPLICATE KEY UPDATE post_id=VALUES(post_id)',
        [user.id, b.id]
      );
      await c.commit();
      return apiData({ saved: true });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  } catch {
    return apiError('Chưa lưu được thay đổi. Vui lòng thử lại.', 503);
  }
}
