import { getPublicThreadPost } from "@/lib/thread-access";
import { apiData, apiError } from "@/lib/api-response";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const post = await getPublicThreadPost((await params).id);
    return post
      ? apiData(post, {}, { headers: { "Cache-Control": "private, no-store" } })
      : apiError("Không tìm thấy nội dung đã được duyệt.", 404, "NOT_FOUND");
  } catch {
    return apiError(
      "Chưa thể tải nội dung. Vui lòng thử lại.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}

import { resolveRequestUser } from "@/lib/user-auth";
import { mutateOwnPost } from "@/lib/owned-content";
import { MutationError } from "@/lib/mutation-errors";
async function owned(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
  remove: boolean,
) {
  const session = await resolveRequestUser(request);
  if (session.error) return session.error;
  if (!session.user) return apiError("Vui lòng đăng nhập.", 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return apiError("Nội dung không hợp lệ.", 400);
  try {
    return apiData(
      await mutateOwnPost((await ctx.params).id, session.user.id, body, remove),
    );
  } catch (e) {
    return e instanceof MutationError
      ? apiError(e.message, e.status, e.code)
      : apiError("Chưa thể lưu thay đổi. Nội dung chưa được xác nhận.", 503);
  }
}
export function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return owned(request, ctx, false);
}
export function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return owned(request, ctx, true);
}
