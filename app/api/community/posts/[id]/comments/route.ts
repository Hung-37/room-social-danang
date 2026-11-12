import { rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import { apiData, apiError } from "@/lib/api-response";
import { getPublicThread } from "@/lib/thread-access";
import { hasDatabaseConfig } from "@/lib/mysql-pool";
import {
  createCommunityComment,
  getCommunityCommentCount,
  listCommunityComments,
} from "@/lib/community-db";
import {
  createCommunityComment as createFileComment,
  listCommunityComments as listFileComments,
} from "@/lib/server-community-storage";
import { resolveRequestUser } from "@/lib/user-auth";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await resolveRequestUser(request);
    if (session.error) return session.error;
    const { id } = await params;
    if (!(await getPublicThread(id)))
      return apiError(
        "Nội dung không tồn tại hoặc chưa được duyệt.",
        404,
        "NOT_FOUND",
      );
    const query = new URL(request.url).searchParams;
    const integer = (name: string, fallback: number) => {
      const value = query.get(name);
      if (value === null || value.trim() === "") return fallback;
      const raw = Number(value);
      return Number.isSafeInteger(raw) && raw >= 0 ? raw : fallback;
    };
    const limit = Math.min(Math.max(integer("limit", 20), 1), 100);
    const offset = integer("offset", 0);
    let data, total;
    if (hasDatabaseConfig())
      [data, total] = await Promise.all([
        listCommunityComments(id, limit, offset, session.user?.id),
        getCommunityCommentCount(id),
      ]);
    else {
      const all = [...listFileComments(id)].reverse();
      data = all.slice(offset, offset + limit);
      total = all.length;
    }
    return apiData(
      data,
      {
        meta: {
          total,
          nextOffset: offset + data.length,
          hasMore: offset + data.length < total,
        },
        storage: hasDatabaseConfig() ? "database" : "file_cache",
      },
      { headers },
    );
  } catch {
    return apiError(
      "Chưa thể tải bình luận. Vui lòng thử lại.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user)
    return apiError("Bạn cần đăng nhập để bình luận.", 401, "UNAUTHORIZED");
  const body = await request.json().catch(() => null);
  const parentId =
    typeof body?.parentId === "string" ? body.parentId : undefined;
  if (parentId && parentId.length > 191)
    return apiError("Bình luận gốc không hợp lệ.", 400);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 2 || text.length > 2000)
    return apiError(
      "Bình luận phải có từ 2 đến 2000 ký tự.",
      400,
      "INVALID_INPUT",
    );
  try {
    const { id } = await params;
    const thread = await getPublicThread(id);
    if (!thread)
      return apiError(
        "Nội dung không tồn tại hoặc chưa được duyệt.",
        404,
        "NOT_FOUND",
      );
    if (!rateLimit("public-comment:" + user.id, 120, 60000).allowed)
      return apiError("Bạn gửi quá nhanh. Vui lòng đợi một phút.", 429);
    const comment = {
      id: `comment-${randomUUID()}`,
      authorName: user.name.slice(0, 40),
      text,
      createdAt: new Date().toISOString(),
    };
    if (hasDatabaseConfig()) {
      const saved = await createCommunityComment(
        id,
        thread.kind,
        comment,
        user.id,
        parentId,
      );
      if (!saved)
        return apiError(
          "Nội dung đã thay đổi hoặc phiên đăng nhập không còn hợp lệ.",
          409,
          "THREAD_CHANGED",
        );
      return apiData(
        saved.comment,
        { count: saved.count, storage: "database" },
        { status: 201, headers },
      );
    }
    if (process.env.NODE_ENV === "production")
      return apiError(
        "Chưa kết nối cơ sở dữ liệu.",
        503,
        "DATABASE_UNAVAILABLE",
      );
    if (parentId) return apiError("Trả lời theo nhánh cần cơ sở dữ liệu.", 503);
    const saved = createFileComment(id, comment);
    return saved
      ? apiData(
          comment,
          { count: saved.length, storage: "development_file" },
          { status: 201, headers },
        )
      : apiError("Không tìm thấy nội dung.", 404);
  } catch {
    return apiError(
      "Chưa xác nhận được việc gửi bình luận. Vui lòng thử lại.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}
