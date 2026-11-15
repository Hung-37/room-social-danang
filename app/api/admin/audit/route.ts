import { apiData, apiError } from '@/lib/server/api-response';
import { getAdminSessionFromRequest } from '@/lib/server/admin-auth';
import { hasCommunityDatabase, listModerationLogs } from '@/lib/server/community-db';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return apiError('Admin authentication required.', 401, 'UNAUTHORIZED');
  if (!hasCommunityDatabase()) return apiData([], { storage: 'file_cache' });
  try {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100);
    return apiData(await listModerationLogs(limit), { storage: 'database' });
  } catch {
    return apiError('Không thể tải audit log.', 503, 'DATABASE_UNAVAILABLE');
  }
}
