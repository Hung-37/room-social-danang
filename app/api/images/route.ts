import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { resolveRequestUser } from '@/lib/user-auth';
import { landlordStatus } from '@/lib/landlord-db';
import { getDatabasePool } from '@/lib/mysql-pool';
import { apiData, apiError } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
export const runtime = 'nodejs';
const LIMIT = 5 * 1024 * 1024;
export async function POST(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  if (user.role !== 'landlord') return apiError('Chỉ chủ trọ được tải ảnh phòng.', 403);
  try {
    if ((await landlordStatus(user.id)) !== 'verified')
      return apiError('Chủ trọ chưa được xác minh.', 403);
    if (!rateLimit('images:' + user.id, 40, 3600000).allowed)
      return apiError('Bạn đã tải nhiều ảnh. Hãy thử lại sau.', 429);
    if (Number(r.headers.get('content-length')) > LIMIT + 65536)
      return apiError('Ảnh cần nhỏ hơn 5 MB.', 413);
    const reader = r.body?.getReader();
    if (!reader) return apiError('Chọn một ảnh để tải lên.', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const value = await reader.read();
      if (value.done) break;
      size += value.value.byteLength;
      if (size > LIMIT + 65536) {
        await reader.cancel();
        return apiError('Ảnh cần nhỏ hơn 5 MB.', 413);
      }
      chunks.push(value.value);
    }
    const body = Buffer.concat(chunks);
    let form: FormData;
    try {
      form = await new Request(r.url, {
        method: 'POST',
        headers: { 'Content-Type': r.headers.get('content-type') || '' },
        body
      }).formData();
    } catch {
      return apiError('Biểu mẫu ảnh không hợp lệ.', 400);
    }
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 1)
      return apiError('Chọn ảnh JPG, PNG hoặc WebP.', 400);
    if (file.size > LIMIT) return apiError('Ảnh cần nhỏ hơn 5 MB.', 413);
    let image: Buffer;
    try {
      const raw = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(raw, { limitInputPixels: 20000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) > 1)
        return apiError('Chỉ nhận ảnh tĩnh JPG, PNG hoặc WebP.', 400);
      image = await sharp(raw, { limitInputPixels: 20000000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      if (image.length > 1024 * 1024)
        return apiError('Ảnh quá phức tạp. Hãy chọn ảnh nhỏ hơn.', 400);
    } catch {
      return apiError('Không đọc được ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP hợp lệ.', 400);
    }
    const c = await getDatabasePool().getConnection();
    try {
      await c.beginTransaction();
      await c.query('SELECT external_id FROM users WHERE external_id=? FOR UPDATE', [user.id]);
      await c.execute(
        'DELETE FROM listing_images WHERE owner_id=? AND listing_id IS NULL AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY)',
        [user.id]
      );
      const [quota] = await c.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(OCTET_LENGTH(body)),0) AS bytes,SUM(listing_id IS NULL) AS pending FROM listing_images WHERE owner_id=?',
        [user.id]
      );
      if (
        Number(quota[0].pending) >= 20 ||
        Number(quota[0].bytes) + image.length > 50 * 1024 * 1024
      ) {
        await c.rollback();
        return apiError(
          'Đã đạt giới hạn ảnh của tài khoản (20 ảnh chờ hoặc 50 MB). Hãy xóa ảnh không dùng.',
          409
        );
      }
      const id = randomUUID();
      await c.execute('INSERT INTO listing_images(id,owner_id,body) VALUES (?,?,?)', [
        id,
        user.id,
        image
      ]);
      await c.commit();
      return apiData({ id, url: '/api/images/' + id, bytes: image.length }, {}, { status: 201 });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  } catch {
    return apiError('Chưa lưu được ảnh. Vui lòng thử lại.', 503);
  }
}
