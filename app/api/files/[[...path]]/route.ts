import { apiError } from "@/lib/api-response";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";

function retired(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Cần đăng nhập Admin.", 401);
  return apiError(
    "Trình sửa tệp cũ đã ngừng hỗ trợ. Dùng mục Nhập JSON/CSV và Cấu hình nguồn trong Admin.",
    410,
    "FEATURE_RETIRED",
  );
}
export {
  retired as GET,
  retired as POST,
  retired as PUT,
  retired as PATCH,
  retired as DELETE,
};
