import { resolveRequestUser } from "@/lib/user-auth";
import { apiData, apiError } from "@/lib/api-response";
import { mutateOwnComment } from "@/lib/owned-content";
import { MutationError } from "@/lib/mutation-errors";
type Context = { params: Promise<{ id: string; commentId: string }> };
async function owned(request: Request, ctx: Context, remove: boolean) {
  const session = await resolveRequestUser(request);
  if (session.error) return session.error;
  if (!session.user) return apiError("Vui lòng đăng nhập.", 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return apiError("Thông tin bình luận không hợp lệ.", 400);
  try {
    const p = await ctx.params;
    return apiData(
      await mutateOwnComment(p.id, p.commentId, session.user.id, body, remove),
    );
  } catch (e) {
    return e instanceof MutationError
      ? apiError(e.message, e.status, e.code)
      : apiError("Chưa thể cập nhật bình luận. Vui lòng thử lại.", 503);
  }
}
export function PATCH(request: Request, ctx: Context) {
  return owned(request, ctx, false);
}
export function DELETE(request: Request, ctx: Context) {
  return owned(request, ctx, true);
}
