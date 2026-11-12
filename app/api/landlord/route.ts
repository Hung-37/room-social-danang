import { paginationInteger } from "@/lib/policies/pagination.js";
import { resolveRequestUser } from "@/lib/user-auth";
import { landlordStatus, ownListings } from "@/lib/landlord-db";
import { apiData, apiError } from "@/lib/api-response";
export async function GET(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user || user.role !== "landlord")
    return apiError("Vui lòng đăng nhập tài khoản chủ trọ.", 403);
  const p = new URL(request.url).searchParams,
    status = p.get("status") ?? "";
  if (
    !["", "needs_review", "verified", "rejected", "hidden", "rented"].includes(
      status,
    )
  )
    return apiError("Trạng thái lọc không hợp lệ.", 400);
  try {
    const page = await ownListings(user.id, {
      q: (p.get("q") ?? "").trim().slice(0, 100),
      status,
      limit: paginationInteger(p.get("limit"), 20, 100, 1),
      offset: paginationInteger(p.get("offset"), 0, 2147483647),
    });
    return apiData(
      { status: await landlordStatus(user.id), listings: page.items },
      { meta: page.meta },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError(
      "Không thể tải phòng. Kiểm tra kết nối cơ sở dữ liệu.",
      503,
    );
  }
}
