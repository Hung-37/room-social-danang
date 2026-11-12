import {
  resolveRequestUser,
  applyUserSessionCookie,
  createUserToken
} from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { account, profile } from '@/lib/account-db';
import { getDatabasePool } from '@/lib/mysql-pool';
export async function GET(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  try {
    const data = await profile(user.id);
    return data
      ? apiData(data, {}, { headers: { 'Cache-Control': 'private, no-store' } })
      : apiError('Tài khoản không còn tồn tại.', 401);
  } catch {
    return apiError('Chưa thể tải hồ sơ.', 503);
  }
}
export async function PATCH(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const b = await r.json().catch(() => null);
  const name = typeof b?.name === 'string' ? b.name.trim() : '';
  if (name.length < 2 || name.length > 80)
    return apiError('Tên hiển thị cần từ 2 đến 80 ký tự.', 400);
  try {
    const current = await account(user.id);
    if (!current) return apiError('Tài khoản không còn tồn tại.', 401);
    await getDatabasePool().execute('UPDATE users SET name=? WHERE external_id=?', [name, user.id]);
    const next = { id: current.id, name, email: current.email, role: current.role };
    return applyUserSessionCookie(apiData(next), createUserToken(next));
  } catch {
    return apiError('Chưa lưu được hồ sơ. Nội dung được giữ lại.', 503);
  }
}
