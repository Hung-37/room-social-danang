import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getSiteSettings, validateSettings, defaultSettings } from '@/lib/site-settings';
import { getDatabasePool } from '@/lib/mysql-pool';
import { apiData, apiError } from '@/lib/api-response';
import type { RowDataPacket } from 'mysql2/promise';
export async function GET(r: Request) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quyền Admin.', 401);
  try {
    return apiData(
      {
        ...(await getSiteSettings()),
        runtime: {
          cronConfigured: Boolean(process.env.CRON_SECRET || process.env.COLLECTOR_CRON_SECRET),
          reviewRequired: true
        }
      },
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return apiError('Chưa đọc được cấu hình. Kiểm tra migration/database.', 503);
  }
}
export async function PUT(r: Request) {
  const admin = getAdminSessionFromRequest(r);
  if (!admin) return apiError('Yêu cầu quyền Admin.', 401);
  const b = await r.json().catch(() => null);
  let settings;
  try {
    settings = validateSettings(b?.settings);
    if (!Number.isSafeInteger(b.version) || b.version < 0)
      throw new Error('Phiên bản cấu hình không hợp lệ.');
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Cấu hình không hợp lệ.', 400);
  }
  let c;
  try {
    c = await getDatabasePool().getConnection();
    await c.beginTransaction();
    await c.execute('INSERT IGNORE INTO site_settings(id,value,version) VALUES (1,?,0)', [
      JSON.stringify(defaultSettings())
    ]);
    const [rows] = await c.query<RowDataPacket[]>(
      'SELECT version FROM site_settings WHERE id=1 FOR UPDATE'
    );
    if (Number(rows[0].version) !== b.version) {
      await c.rollback();
      return apiError('Cấu hình đã được thay đổi. Tải lại trước khi lưu.', 409);
    }
    await c.execute('UPDATE site_settings SET value=?,version=version+1,updated_by=? WHERE id=1', [
      JSON.stringify(settings),
      admin.email
    ]);
    await c.execute(
      "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) VALUES ('settings','site','settings_update',?,?)",
      [admin.email, JSON.stringify({ version: b.version + 1 })]
    );
    await c.commit();
    return apiData({ settings, version: b.version + 1 });
  } catch {
    if (c) await c.rollback();
    return apiError('Chưa lưu được cấu hình. Dữ liệu nhập được giữ lại.', 503);
  } finally {
    c?.release();
  }
}
