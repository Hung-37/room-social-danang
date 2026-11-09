import { apiData, apiError } from '@/lib/api-response';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { hasCommunityDatabase, listCommunityReports, updateCommunityReport } from '@/lib/community-db';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return apiError('Admin authentication required.', 401, 'UNAUTHORIZED');
  if (!hasCommunityDatabase()) return apiData([]);
  return apiData(await listCommunityReports());
}

export async function PATCH(request: Request) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return apiError('Admin authentication required.', 401, 'UNAUTHORIZED');
  const body = await request.json().catch(() => ({})) as { id?: unknown; status?: unknown };
  if (typeof body.id !== 'string' || !['pending', 'resolved', 'dismissed'].includes(String(body.status))) return apiError('Báo cáo hoặc trạng thái không hợp lệ.', 400, 'INVALID_INPUT');
  await updateCommunityReport(body.id, body.status as 'pending' | 'resolved' | 'dismissed', admin.email);
  return apiData(null, { success: true });
}
