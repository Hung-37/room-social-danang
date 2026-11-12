import { resolveRequestUser } from "@/lib/user-auth";
import { apiData, apiError } from "@/lib/api-response";
import { ownPosts } from "@/lib/owned-content";
export async function GET(request: Request) {
  const session = await resolveRequestUser(request);
  if (session.error) return session.error;
  if (!session.user) return apiError("Vui lòng đăng nhập.", 401);
  const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647)
    return apiError("Vị trí trang không hợp lệ.", 400);
  try {
    return apiData(
      await ownPosts(session.user.id, offset),
      {},
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError("Chưa tải được bài viết của bạn. Vui lòng thử lại.", 503);
  }
}
