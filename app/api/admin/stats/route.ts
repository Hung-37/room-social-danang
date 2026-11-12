import { apiData, apiError } from "@/lib/api-response";
import { getListingCounts, hasDatabaseConfig } from "@/lib/db";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { getCommunityCounts } from "@/lib/community-db";
import { listCollectorRunsDb } from "@/lib/collector-db";

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
