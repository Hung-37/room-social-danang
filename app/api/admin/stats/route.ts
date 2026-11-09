import { apiData, apiError } from '@/lib/api-response';
import { getListingCounts, hasDatabaseConfig } from '@/lib/db';
import { listCollectorRuns } from '@/lib/collector-run-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getCommunityCounts, hasCommunityDatabase } from '@/lib/community-db';
import { hasCollectorDatabase, listCollectorRunsDb } from '@/lib/collector-db';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return apiError('Admin authentication required.', 401, 'UNAUTHORIZED');
  let runs = listCollectorRuns(20);
  if (hasCollectorDatabase()) {
    try { runs = await listCollectorRunsDb(20); } catch { /* local history remains available */ }
  }
  let listings = { publishedCount: 0, pendingCount: 0, rejectedCount: 0 };
  let community = { publishedCount: 0, pendingCount: 0, rejectedCount: 0 };
  if (hasDatabaseConfig()) {
    try { listings = await getListingCounts('', '', true); } catch { /* cache/admin UI still works */ }
  }
  if (hasCommunityDatabase()) {
    try { community = await getCommunityCounts(); } catch { /* keep zeroed dashboard */ }
  }
  return apiData({ listings, community, runs, lastRun: runs[0] ?? null });
}
