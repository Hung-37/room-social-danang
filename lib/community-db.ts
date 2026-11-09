import mysql, { type Pool } from 'mysql2/promise';
import type { RoomPost } from '@/lib/data';
import type { CommunityComment } from '@/lib/community-storage';
import { COMMUNITY_REACTIONS, type CommunityReaction } from '@/lib/community-interactions';
import { normalizeToRoomPost } from '@/lib/data';

let pool: Pool | undefined;

function getPool() {
  if (!process.env.MYSQL_URL?.trim()) throw new Error('MYSQL_URL is not configured.');
  pool ??= mysql.createPool({ uri: process.env.MYSQL_URL, connectionLimit: 5 });
  return pool;
}

export function hasCommunityDatabase() {
  return Boolean(process.env.MYSQL_URL?.trim());
}

export async function communityPostExists(postId: string) {
  const [rows] = await getPool().query('SELECT id FROM community_posts WHERE id = ? LIMIT 1', [postId]);
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
    tags: []
  });
  // Override defaults from normalizeToRoomPost for community posts
  post.updated = String(row.updatedAt);
  post.image = '💬';
  post.price = '';
  post.area = '';
  post.distance = '';
  return post;
}

export async function listCommunityPosts(limit = 100, offset = 0, includePending = false) {
  const statusFilter = includePending ? `p.status <> 'rejected'` : `p.status = 'verified'`;
  const [rows] = await getPool().query(
    `SELECT p.id, p.title, p.summary, p.cluster_id AS clusterId, p.cluster_name AS clusterName,
            p.post_kind AS postKind, p.author_name AS authorName, p.trust_score AS trustScore,
            p.status, p.updated_at AS updatedAt, COUNT(c.id) AS commentCount
       FROM community_posts p LEFT JOIN community_comments c ON c.post_id = p.id
      WHERE ${statusFilter}
      GROUP BY p.id ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
    [Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return (rows as Array<Record<string, unknown>>).map(mapPost);
}

export async function createCommunityPost(post: RoomPost, authorExternalId?: string) {
  await getPool().execute(
    `INSERT INTO community_posts (id, title, summary, cluster_id, cluster_name, post_kind, author_id, author_name, trust_score, status)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM users WHERE external_id = ?), ?, ?, 'needs_review')
     ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), updated_at = CURRENT_TIMESTAMP`,
    [post.id, post.title, post.summary, post.clusterId, post.clusterName, post.postKind ?? 'question', authorExternalId ?? null, post.authorName ?? 'Thành viên', post.trust]
  );
  return post;
}

export async function listCommunityComments(postId: string) {
  const [rows] = await getPool().query(
    `SELECT id, author_name AS authorName, body AS text, created_at AS createdAt
       FROM community_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100`, [postId]
  );
  return rows as CommunityComment[];
}

export async function createCommunityComment(postId: string, comment: CommunityComment, authorExternalId?: string) {
  await getPool().execute(
    `INSERT INTO community_comments (id, post_id, author_id, author_name, body) VALUES (?, ?, (SELECT id FROM users WHERE external_id = ?), ?, ?)`,
    [comment.id, postId, authorExternalId ?? null, comment.authorName, comment.text]
  );
  return [...await listCommunityComments(postId)];
}

export async function listUserNotifications(externalId: string) {
  const [rows] = await getPool().query(
    `SELECT n.id, n.type, n.title, n.body, n.href, n.is_read AS isRead, n.created_at AS createdAt
       FROM notifications n JOIN users u ON u.id = n.user_id
      WHERE u.external_id = ? ORDER BY n.created_at DESC LIMIT 50`, [externalId]
  );
  return rows as Array<{ id: number; type: string; title: string; body: string; href: string | null; isRead: boolean; createdAt: string }>;
}

export async function markUserNotificationsRead(externalId: string) {
  await getPool().execute(
    `UPDATE notifications n JOIN users u ON u.id = n.user_id SET n.is_read = TRUE WHERE u.external_id = ? AND n.is_read = FALSE`, [externalId]
  );
}

export async function getCommunityInteractionsDb(postId: string, actorExternalId?: string) {
  const [rows] = await getPool().query(`SELECT reaction, COUNT(*) AS count FROM community_reactions WHERE post_id = ? GROUP BY reaction`, [postId]);
  const counts = Object.fromEntries(COMMUNITY_REACTIONS.map((reaction) => [reaction, 0])) as Record<CommunityReaction, number>;
  for (const row of rows as Array<{ reaction: string; count: number }>) {
    if (COMMUNITY_REACTIONS.includes(row.reaction as CommunityReaction)) counts[row.reaction as CommunityReaction] = Number(row.count);
  }
  const [totalRows] = await getPool().query(`SELECT COUNT(*) AS total FROM community_reactions WHERE post_id = ?`, [postId]);
  let viewerReaction: CommunityReaction | null = null;
  if (actorExternalId) {
    const [viewerRows] = await getPool().query(`SELECT r.reaction FROM community_reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND u.external_id = ? LIMIT 1`, [postId, actorExternalId]);
    const reaction = (viewerRows as Array<{ reaction: string }>)[0]?.reaction;
    viewerReaction = COMMUNITY_REACTIONS.includes(reaction as CommunityReaction) ? reaction as CommunityReaction : null;
  }
  return { counts, total: Number((totalRows as Array<{ total: number }>)[0]?.total ?? 0), viewerReaction };
}

export async function setCommunityInteractionDb(postId: string, actorExternalId: string, reaction: CommunityReaction | null) {
  if (reaction) {
    await getPool().execute(`INSERT INTO community_reactions (post_id, user_id, reaction) VALUES (?, (SELECT id FROM users WHERE external_id = ?), ?) ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP`, [postId, actorExternalId, reaction]);
  } else {
    await getPool().execute(`DELETE r FROM community_reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND u.external_id = ?`, [postId, actorExternalId]);
  }
  return getCommunityInteractionsDb(postId, actorExternalId);
}

export async function moderateCommunityPost(postId: string, status: 'verified' | 'rejected' | 'needs_review', actorEmail: string) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.title, p.author_id AS authorId FROM community_posts p WHERE p.id = ? LIMIT 1`, [postId]
    );
    const post = (rows as Array<{ title: string; authorId: number | null }>)[0];
    if (!post) {
      await connection.rollback();
      return false;
    }
    await connection.execute(`UPDATE community_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, postId]);
    await connection.execute(
      `INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details) VALUES ('community_post', ?, ?, ?, JSON_OBJECT('status', ?))`,
      [postId, status, actorEmail, status]
    );
    if (post.authorId) {
      const title = status === 'verified' ? 'Bài viết đã được duyệt' : status === 'rejected' ? 'Bài viết chưa được duyệt' : 'Bài viết đang được xem xét lại';
      const body = status === 'verified' ? 'Bài viết của bạn đã được hiển thị với cộng đồng.' : status === 'rejected' ? 'Bài viết của bạn chưa phù hợp với quy định cộng đồng.' : 'Bài viết của bạn đã được đưa lại vào hàng đợi kiểm duyệt.';
      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, body, href) VALUES (?, 'moderation', ?, ?, ?)`,
        [post.authorId, title, body, `/bai/${postId}`]
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
    FROM community_posts`);
  const row = (rows as Array<Record<string, number | null>>)[0] ?? {};
  return { publishedCount: Number(row.publishedCount ?? 0), pendingCount: Number(row.pendingCount ?? 0), rejectedCount: Number(row.rejectedCount ?? 0) };
}

export async function createCommunityReport(input: { id: string; postId: string; reporterExternalId: string; reason: string; details?: string }) {
  await getPool().execute(
    `INSERT INTO community_reports (id, post_id, reporter_id, reason, details)
     SELECT ?, ?, u.id, ?, ? FROM users u WHERE u.external_id = ?`,
    [input.id, input.postId, input.reason, input.details ?? null, input.reporterExternalId]
  );
}

export async function listCommunityReports() {
  const [rows] = await getPool().query(
    `SELECT r.id, r.post_id AS postId, p.title, r.reason, r.details, r.status,
            u.name AS reporterName, r.created_at AS createdAt, r.resolved_at AS resolvedAt, r.resolved_by AS resolvedBy
       FROM community_reports r JOIN community_posts p ON p.id = r.post_id
       JOIN users u ON u.id = r.reporter_id
      ORDER BY r.created_at DESC LIMIT 200`
  );
  return rows;
}

export async function updateCommunityReport(id: string, status: 'resolved' | 'dismissed' | 'pending', resolvedBy: string) {
  await getPool().execute(
    `UPDATE community_reports SET status = ?, resolved_at = IF(? = 'pending', NULL, CURRENT_TIMESTAMP), resolved_by = IF(? = 'pending', NULL, ?) WHERE id = ?`,
    [status, status, status, resolvedBy, id]
  );
  await getPool().execute(
    `INSERT INTO moderation_logs (entity_type, entity_id, action, actor_email, details)
     VALUES ('community_report', ?, ?, ?, JSON_OBJECT('status', ?))`,
    [id, `report_${status}`, resolvedBy, status]
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
    [input.entityType, input.entityId, input.action, input.actorEmail ?? null, input.details ? JSON.stringify(input.details) : null]
  );
}

export async function listModerationLogs(limit = 100) {
  const [rows] = await getPool().query(
    `SELECT id, entity_type AS entityType, entity_id AS entityId, action,
            actor_email AS actorEmail, details, created_at AS createdAt
       FROM moderation_logs ORDER BY created_at DESC LIMIT ?`,
    [Math.min(Math.max(limit, 1), 500)]
  );
  return rows as ModerationLog[];
}
