import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getManagedSourcesAsync } from '@/lib/collector-source-storage';
import { withCollectorJobLock } from '@/lib/collector-job-lock';
import { runCollectorPipeline } from '@/lib/collector-runner';
import { apiData, apiError } from '@/lib/api-response';
export async function POST(r: Request) {
  const secret = process.env.CRON_SECRET || process.env.COLLECTOR_CRON_SECRET;
  if (
    !getAdminSessionFromRequest(r) &&
    (!secret || r.headers.get('authorization') !== 'Bearer ' + secret)
  )
    return apiError('Yêu cầu quyền Admin.', 401);
  return withCollectorJobLock(async () => {
    try {
      const result = await runCollectorPipeline(await getManagedSourcesAsync());
      return apiData(result.runs, {
        status: result.status,
        meta: {
          collected: result.listings.length,
          persistence: result.persistence,
          rejected: result.rejected
        }
      });
    } catch (e) {
      return apiError(e instanceof Error ? e.message : 'Không khởi tạo được dữ liệu.', 503);
    }
  });
}
