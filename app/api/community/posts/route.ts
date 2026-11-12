import { createOnce, submissionKey } from "@/lib/idempotency";
import { MutationError } from "@/lib/mutation-errors";
import { paginationInteger } from "@/lib/policies/pagination.js";
import { clusters } from "@/lib/data";
import { randomUUID } from "node:crypto";
import type { RoomPost } from "@/lib/data";
import {
  createCommunityPost,
  listCommunityPosts,
} from "@/lib/server-community-storage";
import {
  createCommunityPost as createCommunityPostDb,
  hasCommunityDatabase,
  listCommunityPosts as listCommunityPostsDb,
} from "@/lib/community-db";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { resolveRequestUser } from "@/lib/user-auth";
import { apiData, apiError } from "@/lib/api-response";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 3000;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = paginationInteger(params.get("limit"), 20, 50, 1);
  const offset = paginationInteger(params.get("offset"), 0, 2147483647);
  const includePending = params.get("includePending") === "true";
  if (includePending && !getAdminSessionFromRequest(request))
    return apiError("Vui lòng đăng nhập quản trị viên.", 401, "UNAUTHORIZED");
  const filters = {
    q: (params.get("q") ?? "").trim().slice(0, 100),
    cluster: (params.get("cluster") ?? "").slice(0, 100),
    kind: (params.get("kind") ?? "").slice(0, 30),
  };
  let posts;
  if (hasCommunityDatabase()) {
    try {
      const session = await resolveRequestUser(request);
      if (session.error) return session.error;
      posts = await listCommunityPostsDb(
        limit + 1,
        offset,
        includePending,
        filters,
        session.user?.id,
      );
      const hasMore = posts.length > limit;
      posts = posts.slice(0, limit);
      return apiData(
        posts,
        {
          meta: {
            count: posts.length,
            hasMore,
            nextOffset: offset + posts.length,
          },
          storage: "database",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return apiError(
        "Chưa thể tải thảo luận. Vui lòng thử lại.",
        503,
        "DATABASE_UNAVAILABLE",
      );
    }
  }
  posts = listCommunityPosts(includePending)
    .filter(
      (post) =>
        (!filters.q ||
          [post.title, post.summary].some((text) =>
            text
              .toLocaleLowerCase("vi")
              .includes(filters.q.toLocaleLowerCase("vi")),
          )) &&
        (!filters.cluster || post.clusterId === filters.cluster) &&
        (!filters.kind || post.postKind === filters.kind),
    )
    .slice(offset, offset + limit);
  return apiData(
    posts,
    {
      meta: {
        count: posts.length,
        hasMore: posts.length === limit,
        nextOffset: offset + posts.length,
      },
      storage: "file_cache",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user)
    return apiError("Bạn cần đăng nhập để đăng bài.", 401, "UNAUTHORIZED");
  let body: Partial<RoomPost>;
  try {
    body = (await request.json()) as Partial<RoomPost>;
  } catch {
    return apiError("Invalid JSON body.", 400, "INVALID_JSON");
  }

  if (!body || typeof body !== "object")
    return apiError("Nội dung bài viết không hợp lệ.", 400, "INVALID_INPUT");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const id = `community-${randomUUID()}`;
  if (
    title.length < 5 ||
    title.length > MAX_TITLE_LENGTH ||
    summary.length < 20 ||
    summary.length > MAX_BODY_LENGTH
  ) {
    return apiError("Tiêu đề hoặc nội dung chưa hợp lệ.", 400, "INVALID_INPUT");
  }

  if (
    body.clusterId !== undefined &&
    (typeof body.clusterId !== "string" ||
      !clusters.some((cluster) => cluster.id === body.clusterId))
  )
    return apiError(
      "Khu vực không hợp lệ. Vui lòng chọn lại khu vực.",
      400,
      "INVALID_CLUSTER",
    );

  const post: RoomPost = {
    id,
    title,
    summary,
    price: "",
    area: "",
    distance: "",
    source: "Website",
    comments: 0,
    updated: new Date().toISOString(),
    status: "Cần kiểm chứng",
    image: "💬",
    trust: 20,
    clusterId:
      typeof body.clusterId === "string" ? body.clusterId : "chua-phan-cum",
    clusterName:
      clusters.find((cluster) => cluster.id === body.clusterId)?.name ??
      "Chưa phân cụm",
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 5).map(String) : [],
    authorName: user.name.slice(0, 40),
    postKind:
      body.postKind === "experience" || body.postKind === "warning"
        ? body.postKind
        : "question",
  };

  if (hasCommunityDatabase()) {
    try {
      const result = await createOnce(
        user.id,
        "community_create",
        submissionKey(request),
        {
          title,
          summary,
          clusterId: post.clusterId,
          postKind: post.postKind,
          tags: post.tags,
        },
        (connection) => createCommunityPostDb(post, user.id, connection),
      );
      return apiData(
        result.value,
        { success: true, storage: "database", replayed: result.replayed },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof MutationError)
        return apiError(error.message, error.status, error.code);
      console.error("Community post write failed:", error);
      return apiError(
        "Không thể lưu bài viết. Vui lòng thử lại.",
        503,
        "DATABASE_UNAVAILABLE",
      );
    }
  }
  if (process.env.NODE_ENV === "production")
    return apiError(
      "Database chưa được cấu hình.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  return apiData(
    createCommunityPost(post),
    { success: true, storage: "development_file" },
    { status: 201 },
  );
}
