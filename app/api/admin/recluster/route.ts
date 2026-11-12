import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { hasDatabaseConfig } from "@/lib/mysql-pool";
import { reclusterDatabaseListings } from "@/lib/recluster";
import {
  readScrapedListings,
  writeJsonAtomically,
  SCRAPED_DATA_FILE,
} from "@/lib/file-storage";
import { autoAssignCluster } from "@/lib/auto-cluster";
import { apiData, apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Yêu cầu quyền quản trị viên.", 401, "UNAUTHORIZED");
  let databaseUpdated = 0,
    scanned = 0,
    fileUpdated = 0;
  try {
    if (hasDatabaseConfig()) {
      await reclusterDatabaseListings((updated, count) => {
        databaseUpdated = updated;
        scanned = count;
      });
    } else {
      const listings = readScrapedListings({ includeStale: true });
      const updated = listings.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return value;
        const listing = value as Record<string, unknown>;
        scanned++;
        const clusterId = autoAssignCluster(
          String(listing.address ?? ""),
          String(listing.title ?? ""),
          String(listing.summary ?? ""),
        );
        if (listing.clusterId === clusterId) return listing;
        fileUpdated++;
        return { ...listing, clusterId };
      });
      if (fileUpdated) writeJsonAtomically(SCRAPED_DATA_FILE, updated);
    }
    return apiData({
      fileUpdated,
      databaseUpdated,
      totalUpdated: fileUpdated + databaseUpdated,
      scanned,
    });
  } catch (error) {
    console.error("Re-clustering failed:", error);
    return apiError(
      `Không thể hoàn tất phân cụm. Đã lưu ${databaseUpdated} tin trong ${scanned} tin đã kiểm tra; vui lòng thử lại.`,
      503,
      "RECLUSTER_FAILED",
    );
  }
}
