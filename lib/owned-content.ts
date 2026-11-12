import { deletePostNotifications } from "./post-notifications";
import type { RowDataPacket } from "mysql2/promise";
import { getDatabasePool } from "./mysql-pool";
import { clusters } from "./data";
import { MutationError, requireVersion } from "./mutation-errors";
export async function ownPosts(user: string, offset: number) {
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    `SELECT p.id,p.title,p.summary,p.cluster_id AS clusterId,p.post_kind AS postKind,p.status,p.version,p.updated_at AS updatedAt FROM community_posts p JOIN users u ON u.id=p.author_id WHERE u.external_id=? AND p.deleted_at IS NULL ORDER BY p.updated_at DESC,p.id DESC LIMIT 21 OFFSET ?`,
    [user, offset],
  );
  return {
    items: rows.slice(0, 20),
    hasMore: rows.length > 20,
    nextOffset: offset + Math.min(rows.length, 20),
  };
}
export async function mutateOwnPost(
  id: string,
  user: string,
  body: Record<string, unknown>,
  remove: boolean,
) {
  const c = await getDatabasePool().getConnection();
  try {
    await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await c.beginTransaction();
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT p.* FROM community_posts p WHERE p.id=? AND p.author_id=(SELECT id FROM users WHERE external_id=?) AND p.deleted_at IS NULL FOR UPDATE",
      [id, user],
    );
    if (!rows[0])
      throw new MutationError(
        "Không tìm thấy bài viết thuộc tài khoản của bạn.",
        404,
      );
    requireVersion(body.version, rows[0].version);
    if (remove) {
      await c.execute(
        "UPDATE community_posts SET title='[Bài viết đã được xóa]',summary='',author_name=NULL,status='rejected',deleted_at=UTC_TIMESTAMP(),version=version+1 WHERE id=?",
        [id],
      );
      await c.execute(
        "UPDATE community_comments SET body='',deleted_at=COALESCE(deleted_at,UTC_TIMESTAMP()),version=version+1 WHERE post_id=?",
        [id],
      );
      for (const table of [
        "community_reactions",
        "community_reports",
        "saved_posts",
      ])
        await c.execute(`DELETE FROM ${table} WHERE post_id=?`, [id]);
      await deletePostNotifications(c, id);
      await c.execute(
        "UPDATE mutation_requests SET response_json=NULL,deleted=TRUE WHERE scope='community_create' AND result_id=?",
        [id],
      );
    } else {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const summary =
        typeof body.summary === "string" ? body.summary.trim() : "";
      if (
        title.length < 5 ||
        title.length > 120 ||
        summary.length < 20 ||
        summary.length > 3000 ||
        !clusters.some((v) => v.id === body.clusterId) ||
        !["question", "experience", "warning"].includes(String(body.postKind))
      )
        throw new MutationError(
          "Kiểm tra tiêu đề, nội dung, khu vực và loại thảo luận.",
          400,
        );
      const area = clusters.find((v) => v.id === body.clusterId)!;
      await c.execute(
        "UPDATE community_posts SET title=?,summary=?,cluster_id=?,cluster_name=?,post_kind=?,status='needs_review',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [title, summary, area.id, area.name, String(body.postKind), id],
      );
    }
    await c.execute(
      "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) SELECT 'community_post',?,?,email,JSON_OBJECT('ownerAction',TRUE) FROM users WHERE external_id=?",
      [id, remove ? "owner_deleted" : "owner_edited", user],
    );
    await c.commit();
    return {
      id,
      deleted: remove,
      status: remove ? "rejected" : "needs_review",
      version: Number(rows[0].version) + 1,
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function mutateOwnComment(
  postId: string,
  id: string,
  user: string,
  body: Record<string, unknown>,
  remove: boolean,
) {
  const c = await getDatabasePool().getConnection();
  try {
    await c.beginTransaction();
    // Parent before comment, matching creation and moderation/deletion lock order.
    const [post] = await c.query<RowDataPacket[]>(
      "SELECT id FROM community_posts WHERE id=? FOR UPDATE",
      [postId],
    );
    if (!post.length)
      await c.query(
        "SELECT external_id FROM listings WHERE external_id=? FOR UPDATE",
        [postId],
      );
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT c.version FROM community_comments c WHERE c.id=? AND c.post_id=? AND c.author_id=(SELECT id FROM users WHERE external_id=?) AND c.deleted_at IS NULL FOR UPDATE",
      [id, postId, user],
    );
    if (!rows[0])
      throw new MutationError(
        "Không tìm thấy bình luận thuộc tài khoản của bạn.",
        404,
      );
    requireVersion(body.version, rows[0].version);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!remove && (text.length < 2 || text.length > 2000))
      throw new MutationError("Bình luận phải có từ 2 đến 2000 ký tự.", 400);
    await c.execute(
      "UPDATE community_comments SET body=?,deleted_at=IF(?,UTC_TIMESTAMP(),NULL),version=version+1 WHERE id=?",
      [remove ? "" : text, remove, id],
    );
    await c.execute(
      "INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details) SELECT 'community_comment',?,?,email,JSON_OBJECT('ownerAction',TRUE) FROM users WHERE external_id=?",
      [id, remove ? "owner_deleted" : "owner_edited", user],
    );
    await c.commit();
    return {
      id,
      deleted: remove,
      text: remove ? "" : text,
      version: Number(rows[0].version) + 1,
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
