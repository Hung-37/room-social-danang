import { apiData, apiError } from "@/lib/server/api-response";
import { getListingCounts, hasDatabaseConfig } from "@/lib/server/db";
import { getAdminSessionFromRequest } from "@/lib/server/admin-auth";
import { getCommunityCounts } from "@/lib/server/community-db";
import { listCollectorRunsDb } from "@/lib/server/collector-db";

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Yêu cầu quyền Admin.", 401, "UNAUTHORIZED");
  if (!hasDatabaseConfig())
    return apiError(
      "Chưa cấu hình database để thống kê.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  try {
    const [listings, community, runs] = await Promise.all([
      getListingCounts("", "", true),
      getCommunityCounts(),
      listCollectorRunsDb(20),
    ]);
    return apiData(
      { listings, community, runs, lastRun: runs[0] ?? null },
      {},
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError(
      "Chưa tải được thống kê từ database. Vui lòng thử lại.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}
