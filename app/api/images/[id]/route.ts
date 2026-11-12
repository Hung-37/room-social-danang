import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '@/lib/mysql-pool';
import { resolveRequestUser } from '@/lib/user-auth';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { apiError, apiData } from '@/lib/api-response';
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  const admin = getAdminSessionFromRequest(r);
  const days = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);
  try {
    const [rows] = await getDatabasePool().query<RowDataPacket[]>(
      `SELECT i.body FROM listing_images i LEFT JOIN listings l ON l.external_id=i.listing_id WHERE i.id=? AND (?=1 OR i.owner_id=? OR (l.verification_status='verified' AND l.updated_at>=DATE_SUB(NOW(),INTERVAL ${days} DAY)))`,
      [(await ctx.params).id, admin ? 1 : 0, user?.id || '']
    );
    if (!rows[0]) return apiError('Không tìm thấy ảnh công khai.', 404);
    return new Response(new Uint8Array(rows[0].body), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(rows[0].body.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        Vary: 'Cookie'
      }
    });
  } catch {
    return apiError('Chưa thể tải ảnh.', 503);
  }
}
export async function DELETE(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  try {
    await getDatabasePool().execute(
      'DELETE FROM listing_images WHERE id=? AND owner_id=? AND listing_id IS NULL',
      [(await ctx.params).id, user.id]
    );
    return apiData({ success: true });
  } catch {
    return apiError('Chưa thể xóa ảnh.', 503);
  }
}
