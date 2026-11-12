import { requireVersion } from "./mutation-errors";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { getDatabasePool as getPool } from "@/lib/mysql-pool";
export { hasDatabaseConfig as hasCommunityDatabase } from "@/lib/mysql-pool";
import type { RoomPost } from "@/lib/data";
import type { CommunityComment } from "@/lib/types";
import {
  COMMUNITY_REACTIONS,
  type CommunityReaction,
} from "@/lib/community-interactions";
import { normalizeToRoomPost } from "@/lib/data";

export async function communityPostExists(postId: string) {
  const [rows] = await getPool().query(
    "SELECT id FROM community_posts WHERE id = ? LIMIT 1",
    [postId],
  );
  return (rows as Array<{ id: string }>).length > 0;
}

function mapPost(row: Record<string, unknown>): RoomPost {
  const post = normalizeToRoomPost({
    id: row.id,
    title: row.title,
    summary: row.summary,
    clusterId: row.clusterId,
    trustScore: row.trustScore,
    verificationStatus: row.status,
    commentCount: row.commentCount,
    authorName: row.authorName,
    postKind: row.postKind,
    tags: [],
  });
  // Override defaults from normalizeToRoomPost for community posts
  const updated = new Date(String(row.updatedAt));
  post.updated = Number.isFinite(updated.getTime())
    ? updated.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Mới cập nhật";
  post.image = "💬";
  post.price = "";
  post.area = "";
  post.distance = "";
  post.version = Number(row.version) || 1;
  return post;
}

export async function listCommunityPosts(
  limit = 100,
  offset = 0,
  includePending = false,
  filters: { q?: string; cluster?: string; kind?: string } = {},
  viewer?: string,
) {
  const statusFilter = includePending
    ? `p.status <> 'rejected' AND p.deleted_at IS NULL`
    : `p.status = 'verified' AND p.deleted_at IS NULL`;
  const [rows] = await getPool().query(
    `SELECT page.*, (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = page.id AND c.deleted_at IS NULL) AS commentCount
       FROM (
         SELECT p.id, p.title, p.summary, p.cluster_id AS clusterId, p.cluster_name AS clusterName,
                p.post_kind AS postKind, p.author_name AS authorName, p.trust_score AS trustScore,
                p.status,p.version, p.updated_at AS updatedAt
           FROM community_posts p
          WHERE ${statusFilter}
            AND (? = '' OR p.title LIKE CONCAT('%', ?, '%') OR p.summary LIKE CONCAT('%', ?, '%'))
            AND (? = '' OR p.cluster_id = ?)
            AND (? = '' OR p.post_kind = ?)
          ORDER BY p.updated_at DESC,p.id DESC LIMIT ? OFFSET ?
       ) AS page
      ORDER BY page.updatedAt DESC,page.id DESC`,
    [
      filters.q ?? "",
      filters.q ?? "",
      filters.q ?? "",
      filters.cluster ?? "",
      filters.cluster ?? "",
      filters.kind ?? "",
      filters.kind ?? "",
      Math.min(Math.max(limit, 1), 100),
      Math.max(offset, 0),
    ],
  );
  const posts = (rows as Array<Record<string, unknown>>).map(mapPost);
  if (!posts.length) return posts;
  try {
    const ids = posts.map((post) => post.id);
    const [counts, viewerRows] = await Promise.all([
      getPool().query(
        "SELECT post_id AS id,COUNT(*) AS total FROM community_reactions WHERE post_id IN (?) GROUP BY post_id",
        [ids],
      ),
      viewer
        ? getPool().query(
            "SELECT r.post_id AS id,r.reaction FROM community_reactions r JOIN users u ON u.id=r.user_id WHERE u.external_id=? AND r.post_id IN (?)",
            [viewer, ids],
          )
        : Promise.resolve([[]]),
    ]);
    const totals = new Map(
      (counts[0] as Array<{ id: string; total: number }>).map((row) => [
        row.id,
        Number(row.total),
      ]),
    );
    const reactions = new Map(
      (viewerRows[0] as Array<{ id: string; reaction: string }>).map((row) => [
        row.id,
        row.reaction,
      ]),
    );
    return posts.map((post) => ({
      ...post,
      interactionSummary: {
        total: totals.get(post.id) ?? 0,
        viewerReaction: reactions.get(post.id) ?? null,
      },
    }));
  } catch {
    return posts.map((post) => ({ ...post, interactionSummary: null }));
  }
}

export async function createCommunityPost(
  post: RoomPost,
  authorExternalId?: string,
  connection?: PoolConnection,
) {
  await (connection ?? getPool()).execute(
    `INSERT INTO community_posts (id, title, summary, cluster_id, cluster_name, post_kind, author_id, author_name, trust_score, status)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM users WHERE external_id = ?), ?, ?, 'needs_review')
     `,
    [
      post.id,
      post.title,
      post.summary,
      post.clusterId,
      post.clusterName,
      post.postKind ?? "question",
      authorExternalId ?? null,
      post.authorName ?? "Thành viên",
      post.trust,
    ],
  );
  return post;
}

export async function getCommunityPostById(id: string) {
  const [rows] = await getPool().query(
    `SELECT p.id, p.title, p.summary, p.cluster_id AS clusterId, p.post_kind AS postKind,
            p.author_name AS authorName, p.trust_score AS trustScore, p.status,p.version, p.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS commentCount
       FROM community_posts p WHERE p.id = ? AND p.status = 'verified' AND p.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? mapPost(row) : null;
}

function publicComment(
  row: Record<string, unknown>,
  viewer?: string,
): CommunityComment {
  const { authorExternalId, ...comment } = row;
  return {
    ...comment,
    isMine: Boolean(viewer && authorExternalId === viewer),
  } as CommunityComment;
}
const commentSelect = `SELECT c.id,c.author_name AS authorName,c.body AS text,c.created_at AS createdAt,
 r.parent_id AS parentId,IF(parent.deleted_at IS NULL,parent.author_name,'Thành viên') AS parentAuthor,IF(parent.deleted_at IS NULL,LEFT(parent.body,180),'Bình luận đã được xóa') AS parentText, c.version,u.external_id AS authorExternalId,
 IF(EXISTS(SELECT 1 FROM listings l WHERE l.external_id=c.post_id AND l.owner_external_id=u.external_id),1,0) AS isOwner,
 IF(u.role='landlord' AND v.status='verified',1,0) AS verifiedLandlord
 FROM community_comments c LEFT JOIN users u ON u.id=c.author_id
 LEFT JOIN landlord_verifications v ON v.user_external_id=u.external_id
 LEFT JOIN comment_replies r ON r.comment_id=c.id LEFT JOIN community_comments parent ON parent.id=r.parent_id`;
export async function listCommunityComments(
  postId: string,
  limit = 20,
  offset = 0,
  viewer?: string,
) {
  const [rows] = await getPool().query(
    commentSelect +
      " WHERE c.post_id=? AND c.deleted_at IS NULL ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?",
    [postId, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)],
  );
  return (rows as Array<Record<string, unknown>>).map((row) =>
    publicComment(row, viewer),
  );
}

export async function getCommunityCommentCount(postId: string) {
  const [rows] = await getPool().query(
    "SELECT COUNT(*) AS total FROM community_comments WHERE post_id = ? AND deleted_at IS NULL",
    [postId],
  );
  return Number((rows as Array<{ total: number }>)[0]?.total ?? 0);
}

export async function createCommunityComment(
  postId: string,
  kind: "community" | "listing",
  comment: CommunityComment,
  authorExternalId: string,
  parentId?: string,
) {
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const parentSql =
      kind === "community"
        ? "SELECT id FROM community_posts WHERE id=? AND status='verified' AND deleted_at IS NULL FOR UPDATE"
        : `SELECT external_id FROM listings WHERE external_id=? AND verification_status='verified' AND updated_at>=DATE_SUB(NOW(),INTERVAL ${Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1)} DAY) FOR UPDATE`;
    const [thread] = await c.query(parentSql, [postId]);
    if (!(thread as unknown[]).length) {
      await c.rollback();
      return null;
    }
    let recipient: number | null = null;
    if (parentId) {
      const [parents] = await c.query(
        "SELECT author_id FROM community_comments WHERE id=? AND post_id=? AND deleted_at IS NULL FOR UPDATE",
        [parentId, postId],
      );
      const parent = (parents as Array<{ author_id: number }>)[0];
      if (!parent) {
        await c.rollback();
        return null;
      }
      recipient = parent.author_id;
    } else {
      const [owners] = await c.query(
        kind === "listing"
          ? "SELECT u.id FROM listings l JOIN users u ON u.external_id=l.owner_external_id WHERE l.external_id=?"
          : "SELECT author_id AS id FROM community_posts WHERE id=?",
        [postId],
      );
      recipient = (owners as Array<{ id: number }>)[0]?.id ?? null;
    }
    const predicate =
      kind === "community"
        ? "SELECT 1 FROM community_posts WHERE id=? AND status='verified' AND deleted_at IS NULL"
        : `SELECT 1 FROM listings WHERE external_id=? AND verification_status='verified' AND updated_at>=DATE_SUB(NOW(),INTERVAL ${Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1)} DAY)`;
    const [result] = await c.execute<ResultSetHeader>(
      `INSERT INTO community_comments (id,post_id,author_id,author_name,body,created_at) SELECT ?,?,u.id,?,?,? FROM users u WHERE u.external_id=? AND EXISTS (${predicate})`,
      [
        comment.id,
        postId,
        comment.authorName,
        comment.text,
        new Date(comment.createdAt),
        authorExternalId,
        postId,
      ],
    );
    if (result.affectedRows !== 1) {
      await c.rollback();
      return null;
    }
    if (parentId)
      await c.execute(
        "INSERT INTO comment_replies(comment_id,parent_id) VALUES (?,?)",
        [comment.id, parentId],
      );
    if (recipient)
      await c.execute(
        "INSERT INTO notifications (user_id,type,title,body,href) SELECT id,'reply',?,'Mở bài viết để xem phản hồi.',? FROM users WHERE id=? AND external_id<>?",
        [
          parentId
            ? "Có người trả lời bình luận của bạn"
            : "Có bình luận mới trong bài của bạn",
          "/bai/" + postId + "#binh-luan",
          recipient,
          authorExternalId,
        ],
      );
    const [saved] = await c.query(commentSelect + " WHERE c.id=?", [
      comment.id,
    ]);
    const [counts] = await c.query(
      "SELECT COUNT(*) AS total FROM community_comments WHERE post_id=? AND deleted_at IS NULL",
      [postId],
    );
    await c.commit();
    return {
      comment: publicComment(
        (saved as Array<Record<string, unknown>>)[0],
        authorExternalId,
      ),
      count: Number((counts as Array<{ total: number }>)[0].total),
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function listUserNotifications(externalId: string) {
  const [rows] = await getPool().query(
    `SELECT n.id, n.type, n.title, n.body, n.href, n.is_read AS isRead, n.created_at AS createdAt
       FROM notifications n JOIN users u ON u.id = n.user_id
      WHERE u.external_id = ? ORDER BY n.created_at DESC,n.id DESC LIMIT 50`,
    [externalId],
  );
  return rows as Array<{
    id: number;
    type: string;
    title: string;
    body: string;
    href: string | null;
    isRead: boolean;
    createdAt: string;
  }>;
}

export async function markUserNotificationsRead(externalId: string) {
  await getPool().execute(
    `UPDATE notifications n JOIN users u ON u.id = n.user_id SET n.is_read = TRUE WHERE u.external_id = ? AND n.is_read = FALSE`,
    [externalId],
  );
}

export async function getCommunityInteractionsDb(
  postId: string,
  actorExternalId?: string,
) {
  const [rows] = await getPool().query(
    `SELECT reaction, COUNT(*) AS count FROM community_reactions WHERE post_id = ? GROUP BY reaction`,
    [postId],
  );
  const counts = Object.fromEntries(
    COMMUNITY_REACTIONS.map((reaction) => [reaction, 0]),
  ) as Record<CommunityReaction, number>;
  for (const row of rows as Array<{ reaction: string; count: number }>) {
    if (COMMUNITY_REACTIONS.includes(row.reaction as CommunityReaction))
      counts[row.reaction as CommunityReaction] = Number(row.count);
  }
  const total = (rows as Array<{ count: number | string }>).reduce(
    (sum, row) => sum + Number(row.count),
    0,
  );
  let viewerReaction: CommunityReaction | null = null;
  if (actorExternalId) {
    const [viewerRows] = await getPool().query(
      `SELECT r.reaction FROM community_reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND u.external_id = ? LIMIT 1`,
      [postId, actorExternalId],
    );
    const reaction = (viewerRows as Array<{ reaction: string }>)[0]?.reaction;
    viewerReaction = COMMUNITY_REACTIONS.includes(reaction as CommunityReaction)
      ? (reaction as CommunityReaction)
      : null;
  }
  return { counts, total, viewerReaction };
}

export async function setCommunityInteractionDb(
  postId: string,
  actorExternalId: string,
  reaction: CommunityReaction | null,
) {
  if (reaction) {
    await getPool().execute(
      `INSERT INTO community_reactions (post_id, user_id, reaction) VALUES (?, (SELECT id FROM users WHERE external_id = ?), ?) ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP`,
      [postId, actorExternalId, reaction],
    );
  } else {
    await getPool().execute(
      `DELETE r FROM community_reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND u.external_id = ?`,
      [postId, actorExternalId],
    );
  }
  return getCommunityInteractionsDb(postId, actorExternalId);
}

export async function moderateCommunityPost(
  postId: string,
  status: "verified" | "rejected" | "needs_review",
  actorEmail: string,
  version?: unknown,
) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.title,p.version, p.author_id AS authorId FROM community_posts p WHERE p.id = ? AND p.deleted_at IS NULL FOR UPDATE`,
      [postId],
    );
    const post = (
      rows as Array<{ title: string; authorId: number | null; version: number }>
    )[0];
    if (!post) {
      await connection.rollback();
      return false;
    }
    if (version !== undefined) requireVersion(version, post.version);
    await connection.execute(
      `UPDATE community_posts SET status = ?, version=version+1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, postId],
    );
    await connection.execute(
      `INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details) VALUES ('community_post', ?, ?, ?, JSON_OBJECT('status', ?))`,
      [postId, status, actorEmail, status],
    );
    if (post.authorId) {
      const title =
        status === "verified"
          ? "Bài viết đã được duyệt"
          : status === "rejected"
            ? "Bài viết chưa được duyệt"
            : "Bài viết đang được xem xét lại";
      const body =
        status === "verified"
          ? "Bài viết của bạn đã được hiển thị với cộng đồng."
          : status === "rejected"
            ? "Bài viết của bạn chưa phù hợp với quy định cộng đồng."
            : "Bài viết của bạn đã được đưa lại vào hàng đợi kiểm duyệt.";
      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, body, href) VALUES (?, 'moderation', ?, ?, ?)`,
        [post.authorId, title, body, `/bai/${postId}`],
      );
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCommunityCounts() {
  const [rows] = await getPool().query(`SELECT
    SUM(status = 'verified') AS publishedCount,
    SUM(status = 'needs_review') AS pendingCount,
    SUM(status = 'rejected') AS rejectedCount
    FROM community_posts WHERE deleted_at IS NULL`);
  const row = (rows as Array<Record<string, number | null>>)[0] ?? {};
  return {
    publishedCount: Number(row.publishedCount ?? 0),
    pendingCount: Number(row.pendingCount ?? 0),
    rejectedCount: Number(row.rejectedCount ?? 0),
  };
}

export async function createCommunityReport(input: {
  id: string;
  postId: string;
  reporterExternalId: string;
  reason: string;
  details?: string;
}) {
  await getPool().execute(
    `INSERT INTO community_reports (id, post_id, reporter_id, reason, details)
     SELECT ?, ?, u.id, ?, ? FROM users u WHERE u.external_id = ?`,
    [
      input.id,
      input.postId,
      input.reason,
      input.details ?? null,
      input.reporterExternalId,
    ],
  );
}

export async function listCommunityReports() {
  const [rows] = await getPool().query(
    `SELECT r.id, r.post_id AS postId, p.title, r.reason, r.details, r.status,
            u.name AS reporterName, r.created_at AS createdAt, r.resolved_at AS resolvedAt, r.resolved_by AS resolvedBy
       FROM community_reports r JOIN community_posts p ON p.id = r.post_id AND p.deleted_at IS NULL
       JOIN users u ON u.id = r.reporter_id
      ORDER BY r.created_at DESC LIMIT 200`,
  );
  return rows;
}

export async function updateCommunityReport(
  id: string,
  status: "resolved" | "dismissed" | "pending",
  resolvedBy: string,
) {
  await getPool().execute(
    `UPDATE community_reports SET status = ?, resolved_at = IF(? = 'pending', NULL, CURRENT_TIMESTAMP), resolved_by = IF(? = 'pending', NULL, ?) WHERE id = ?`,
    [status, status, status, resolvedBy, id],
  );
  await getPool().execute(
    `INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details)
     VALUES ('community_report', ?, ?, ?, JSON_OBJECT('status', ?))`,
    [id, `report_${status}`, resolvedBy, status],
  );
}

export type ModerationLog = {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  details: unknown;
  createdAt: string;
};

export async function recordModerationLog(input: {
  entityType: string;
  entityId: string;
  action: string;
  actorEmail?: string | null;
  details?: unknown;
}) {
  await getPool().execute(
    `INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.entityType,
      input.entityId,
      input.action,
      input.actorEmail ?? null,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );
}

export async function listModerationLogs(limit = 100) {
  const [rows] = await getPool().query(
    `SELECT id, entity_type AS entityType, entity_id AS entityId, action,
            actor_email AS actorEmail, details, created_at AS createdAt
       FROM moderation_logs ORDER BY created_at DESC LIMIT ?`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows as ModerationLog[];
}

export async function getThreadStats(postIds: string[]) {
  const comments: Record<string, number> = {};
  const reactions: Record<string, number> = {};
  if (!postIds.length) return { comments, reactions };
  const [commentRows, reactionRows] = await Promise.all([
    getPool().query(
      "SELECT post_id AS id, COUNT(*) AS total FROM community_comments WHERE deleted_at IS NULL AND post_id IN (?) GROUP BY post_id",
      [postIds],
    ),
    getPool().query(
      "SELECT post_id AS id, COUNT(*) AS total FROM community_reactions WHERE post_id IN (?) GROUP BY post_id",
      [postIds],
    ),
  ]);
  for (const row of commentRows[0] as Array<{ id: string; total: number }>)
    comments[row.id] = Number(row.total);
  for (const row of reactionRows[0] as Array<{ id: string; total: number }>)
    reactions[row.id] = Number(row.total);
  return { comments, reactions };
}

export async function unreadNotificationCount(user: string) {
  const [rows] = await getPool().query(
    "SELECT COUNT(*) AS total FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.external_id=? AND n.is_read=FALSE",
    [user],
  );
  return Number((rows as Array<{ total: number }>)[0].total);
}
