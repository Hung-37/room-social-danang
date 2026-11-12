import type { RowDataPacket } from "mysql2/promise";
import { getDatabasePool as db } from "./mysql-pool";
import type { User } from "./types";
export async function account(id: string) {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT external_id AS id,name,email,role,created_at AS createdAt FROM users WHERE external_id=?",
    [id],
  );
  return rows[0] as (User & { createdAt: string }) | undefined;
}
export async function savedPosts(id: string) {
  const days = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT s.post_id AS id,COALESCE(l.title,p.title) AS title,COALESCE(l.image_url,NULL) AS imageUrl, (l.external_id IS NOT NULL OR p.id IS NOT NULL) AS available,s.created_at AS savedAt
 FROM saved_posts s LEFT JOIN listings l ON l.external_id=s.post_id AND l.verification_status='verified' AND l.updated_at>=DATE_SUB(NOW(),INTERVAL ${days} DAY)
 LEFT JOIN community_posts p ON p.id=s.post_id AND p.status='verified' AND p.deleted_at IS NULL
 WHERE s.user_id=? ORDER BY s.created_at DESC,s.post_id DESC LIMIT 500`,
    [id],
  );
  return rows;
}
export async function profile(id: string) {
  const user = await account(id);
  if (!user) return null;
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT
 (SELECT COUNT(*) FROM community_comments c JOIN users u ON u.id=c.author_id WHERE u.external_id=? AND c.deleted_at IS NULL) AS comments,
 (SELECT COUNT(*) FROM community_reactions r JOIN users u ON u.id=r.user_id WHERE u.external_id=?) AS reactions`,
    [id, id],
  );
  return { user, stats: rows[0] };
}
