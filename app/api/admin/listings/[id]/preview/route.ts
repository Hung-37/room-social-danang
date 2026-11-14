import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getDatabasePool } from '@/lib/mysql-pool';
import { apiError, apiData } from '@/lib/api-response';
import type { RowDataPacket } from 'mysql2/promise';
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quản trị viên.', 401);
  try {
    const id = (await params).id;
    const [rows] = await getDatabasePool().query<RowDataPacket[]>(
      'SELECT title,summary,address,phone,image_url AS imageUrl,verification_status AS status FROM listings WHERE external_id=?',
      [id]
    );
    if (!rows[0]) return apiError('Không tìm thấy tin.', 404);
    const [images] = await getDatabasePool().query<RowDataPacket[]>(
      'SELECT id FROM listing_images WHERE listing_id=? ORDER BY position,id LIMIT 4',
      [id]
    );
    return apiData(
      { ...rows[0], imageUrls: images.map((i) => '/api/images/' + i.id) },
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return apiError('Chưa thể tải nội dung kiểm duyệt.', 503);
  }
}
