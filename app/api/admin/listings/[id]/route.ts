import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { hasDatabaseConfig } from "@/lib/mysql-pool";
import {
  deleteRejectedListing,
  ListingDeletionError,
} from "@/lib/listing-deletions";
import {
  readScrapedListings,
  writeJsonAtomically,
  SCRAPED_DATA_FILE,
} from "@/lib/file-storage";
import { apiData, apiError } from "@/lib/api-response";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin)
    return apiError("Yêu cầu quyền quản trị viên.", 401, "UNAUTHORIZED");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (
    !id.trim() ||
    id.length > 191 ||
    reason.length < 10 ||
    reason.length > 500
  )
    return apiError(
      "Nhập lý do xóa từ 10 đến 500 ký tự.",
      400,
      "INVALID_INPUT",
    );
  if (!hasDatabaseConfig())
    return apiError(
      "Cần kết nối MySQL để xóa tin và lưu nhật ký.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  try {
    const result = await deleteRejectedListing(id, reason, admin.email);
    let cacheSynced = true;
    try {
      const cached = readScrapedListings({ includeStale: true });
      const remaining = cached.filter(
        (value) =>
          !value ||
          typeof value !== "object" ||
          String((value as Record<string, unknown>).externalId) !==
            result.externalId,
      );
      if (remaining.length !== cached.length)
        writeJsonAtomically(SCRAPED_DATA_FILE, remaining);
    } catch {
      cacheSynced = false;
    }
    return apiData({ ...result, cacheSynced });
  } catch (error) {
    return apiError(
      error instanceof ListingDeletionError
        ? error.message
        : "Chưa thể xóa tin. Không có thay đổi chưa hoàn tất nào được lưu.",
      error instanceof ListingDeletionError ? error.status : 503,
      error instanceof ListingDeletionError
        ? "DELETE_CONFLICT"
        : "DATABASE_UNAVAILABLE",
    );
  }
}
