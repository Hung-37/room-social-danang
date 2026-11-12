import { resolveRequestUser } from "@/lib/user-auth";
import { apiData, apiError } from "@/lib/api-response";
import { getDatabasePool } from "@/lib/mysql-pool";
import type { ResultSetHeader } from "mysql2/promise";
type Context = { params: Promise<{ id: string }> };
async function change(request: Request, ctx: Context, remove: boolean) {
  const session = await resolveRequestUser(request);
  if (session.error) return session.error;
  if (!session.user) return apiError("Vui lòng đăng nhập.", 401);
  const { id } = await ctx.params;
  if (!/^[1-9][0-9]{0,19}$/.test(id))
    return apiError("Mã thông báo không hợp lệ.", 400);
  try {
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      remove
        ? "DELETE n FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.id=? AND u.external_id=?"
        : "UPDATE notifications n JOIN users u ON u.id=n.user_id SET n.is_read=TRUE WHERE n.id=? AND u.external_id=?",
      [id, session.user.id],
    );
    if (!result.affectedRows && !remove) {
      const [found] = await getDatabasePool().query(
        "SELECT n.id FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.id=? AND u.external_id=?",
        [id, session.user.id],
      );
      if ((found as unknown[]).length) return apiData({ id, isRead: true });
    }
    return result.affectedRows
      ? apiData({ id, deleted: remove, isRead: true })
      : apiError("Không tìm thấy thông báo thuộc tài khoản của bạn.", 404);
  } catch {
    return apiError("Chưa thể cập nhật thông báo. Vui lòng thử lại.", 503);
  }
}
export function PATCH(request: Request, ctx: Context) {
  return change(request, ctx, false);
}
export function DELETE(request: Request, ctx: Context) {
  return change(request, ctx, true);
}
