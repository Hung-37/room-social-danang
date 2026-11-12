import { paginationInteger } from "@/lib/policies/pagination.js";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { listLandlords, verifyLandlord } from "@/lib/landlord-db";
import { apiData, apiError } from "@/lib/api-response";
export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Vui lòng đăng nhập quản trị viên.", 401);
  const p = new URL(request.url).searchParams,
    status = p.get("status") ?? "";
  if (!["", "pending", "verified", "rejected"].includes(status))
    return apiError("Trạng thái lọc không hợp lệ.", 400);
  try {
    const page = await listLandlords({
      q: (p.get("q") ?? "").trim().slice(0, 100),
      status,
      limit: paginationInteger(p.get("limit"), 20, 100, 1),
      offset: paginationInteger(p.get("offset"), 0, 2147483647),
    });
    return apiData(
      page.items,
      { meta: page.meta },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError(
      "Không thể tải danh sách chủ trọ. Kiểm tra cơ sở dữ liệu.",
      503,
    );
  }
}
export async function PATCH(request: Request) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return apiError("Vui lòng đăng nhập quản trị viên.", 401);
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.id !== "string" ||
    !["verified", "rejected"].includes(body.status)
  )
    return apiError("Thông tin xác minh không hợp lệ.", 400);
  try {
    return (await verifyLandlord(body.id, body.status, admin.email))
      ? apiData({ success: true })
      : apiError("Không tìm thấy chủ trọ.", 404);
  } catch {
    return apiError("Không thể lưu xác minh chủ trọ.", 503);
  }
}
