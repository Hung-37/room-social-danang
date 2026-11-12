import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { conversationFor, ChatError } from '@/lib/chat-db';
import { getDatabasePool } from '@/lib/mysql-pool';
import type { RowDataPacket } from 'mysql2/promise';
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const u = sessionResult.user;
  if (!u) return apiError('Vui lòng đăng nhập.', 401);
  const p = new URL(r.url).searchParams,
    q = (p.get('q') || '').trim(),
    before = Number(p.get('before') || 0);
  if (q.length < 2 || q.length > 100 || !Number.isSafeInteger(before) || before < 0)
    return apiError('Nhập từ 2 đến 100 ký tự để tìm tin nhắn.', 400);
  try {
    const id = (await params).id;
    await conversationFor(id, u.id);
    const [rows] = await getDatabasePool().query<RowDataPacket[]>(
      'SELECT id,sender_id AS senderId,body,created_at AS createdAt FROM private_messages WHERE conversation_id=? AND (?=0 OR id<?) AND LOCATE(?,body)>0 ORDER BY id DESC LIMIT 51',
      [id, before, before, q]
    );
    return apiData(
      { messages: rows.slice(0, 50), hasMore: rows.length > 50 },
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return apiError(
      e instanceof ChatError ? e.message : 'Chưa thể tìm tin nhắn.',
      e instanceof ChatError ? e.status : 503
    );
  }
}
