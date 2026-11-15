import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDatabasePool } from './mysql-pool';
export class ChatError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
type Conversation = RowDataPacket & {
  id: string;
  listing_id: string;
  room_title: string;
  buyer_id: string;
  seller_id: string;
  blocked_by: string | null;
  buyer_read: number;
  seller_read: number;
};
export async function conversationFor(id: string, user: string) {
  const [rows] = await getDatabasePool().query<Conversation[]>(
    'SELECT c.*,u.name AS otherName,(l.external_id IS NULL) AS listingDeleted FROM conversations c JOIN users u ON u.external_id=IF(c.buyer_id=?,c.seller_id,c.buyer_id) LEFT JOIN listings l ON l.external_id=c.listing_id WHERE c.id=? AND (c.buyer_id=? OR c.seller_id=?)',
    [user, id, user, user]
  );
  if (!rows[0]) throw new ChatError('Không tìm thấy cuộc trò chuyện.', 404);
  return rows[0];
}
export async function startConversation(listing: string, user: string) {
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    `SELECT l.title,l.owner_external_id AS owner FROM listings l JOIN users u ON u.external_id=l.owner_external_id AND u.role='landlord' JOIN landlord_verifications v ON v.user_external_id=u.external_id AND v.status='verified' WHERE l.external_id=? AND l.verification_status='verified' AND l.updated_at>=DATE_SUB(NOW(),INTERVAL ${Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1)} DAY)`,
    [listing]
  );
  const room = rows[0];
  if (!room) throw new ChatError('Phòng chưa có chủ trọ đã xác minh để nhắn tin.', 409);
  if (room.owner === user)
    throw new ChatError('Đây là phòng của bạn. Hãy trả lời người quan tâm trong hộp thư.', 400);
  await getDatabasePool().execute(
    'INSERT INTO conversations (id,listing_id,room_title,buyer_id,seller_id) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id',
    [randomUUID(), listing, room.title, user, room.owner]
  );
  const [items] = await getDatabasePool().query<RowDataPacket[]>(
    'SELECT id FROM conversations WHERE listing_id=? AND buyer_id=?',
    [listing, user]
  );
  return { id: items[0].id };
}
export async function inbox(user: string, query = '', filter = 'all') {
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    `SELECT * FROM (SELECT c.id,c.room_title AS title,c.blocked_by AS blockedBy,other.name AS otherName,c.updated_at AS updatedAt,
 (SELECT COUNT(*) FROM private_messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.id>IF(c.buyer_id=?,c.buyer_read,c.seller_read)) AS unread,
 (SELECT body FROM private_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage
 FROM conversations c JOIN users other ON other.external_id=IF(c.buyer_id=?,c.seller_id,c.buyer_id)
 WHERE (c.buyer_id=? OR c.seller_id=?) AND (?='' OR LOCATE(?,c.room_title)>0 OR LOCATE(?,other.name)>0)) AS matched
 WHERE (?<>'unread' OR unread>0) AND (?<>'blocked' OR blockedBy IS NOT NULL)
 ORDER BY updatedAt DESC,id DESC LIMIT 200`,
    [user, user, user, user, user, query, query, query, filter, filter]
  );
  return rows;
}

export async function messages(id: string, user: string, before: number, after = 0) {
  const c = await conversationFor(id, user);
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    `SELECT id,sender_id AS senderId,body,created_at AS createdAt FROM private_messages WHERE conversation_id=? AND (?=0 OR id<?) AND (?=0 OR id>?) ORDER BY id ${after ? 'ASC' : 'DESC'} LIMIT 51`,
    [id, before, before, after, after]
  );
  const more = rows.length > 50;
  return {
    conversation: {
      id: c.id,
      title: c.room_title,
      blockedBy: c.blocked_by,
      listingId: c.listing_id,
      listingDeleted: Boolean(c.listingDeleted),
      buyer: c.buyer_id === user,
      otherName: c.otherName
    },
    messages: after ? rows.slice(0, 50) : rows.slice(0, 50).reverse(),
    hasMore: more
  };
}
export async function sendMessage(id: string, user: string, body: string) {
  const c = await getDatabasePool().getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<Conversation[]>(
      'SELECT * FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?) FOR UPDATE',
      [id, user, user]
    );
    const chat = rows[0];
    if (!chat) throw new ChatError('Không tìm thấy cuộc trò chuyện.', 404);
    if (chat.blocked_by) throw new ChatError('Cuộc trò chuyện đang bị chặn.', 409);
    const [result] = await c.execute<ResultSetHeader>(
      'INSERT INTO private_messages (conversation_id,sender_id,body) VALUES (?,?,?)',
      [id, user, body]
    );
    await c.execute('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    const recipient = chat.buyer_id === user ? chat.seller_id : chat.buyer_id;
    await c.execute(
      "INSERT INTO notifications (user_id,type,title,body,href) SELECT id,'message','Bạn có tin nhắn mới','Mở hộp thư để xem nội dung.',? FROM users WHERE external_id=?",
      ['/tin-nhan?hoi-thoai=' + id, recipient]
    );
    await c.commit();
    return { id: result.insertId, senderId: user, body, createdAt: new Date().toISOString() };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function chatAction(
  id: string,
  user: string,
  action: string,
  reason: string,
  upto = 0
) {
  const c = await getDatabasePool().getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<Conversation[]>(
      'SELECT * FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?) FOR UPDATE',
      [id, user, user]
    );
    const chat = rows[0];
    if (!chat) throw new ChatError('Không tìm thấy cuộc trò chuyện.', 404);
    if (action === 'block') {
      if (chat.blocked_by && chat.blocked_by !== user)
        throw new ChatError('Người còn lại đã chặn hội thoại.', 409);
      await c.execute('UPDATE conversations SET blocked_by=? WHERE id=?', [user, id]);
    } else if (action === 'unblock') {
      if (chat.blocked_by !== user)
        throw new ChatError('Chỉ người đã chặn mới có thể bỏ chặn.', 403);
      await c.execute('UPDATE conversations SET blocked_by=NULL WHERE id=?', [id]);
    } else if (action === 'read') {
      await c.execute(
        `UPDATE conversations SET ${chat.buyer_id === user ? 'buyer_read' : 'seller_read'}=GREATEST(${chat.buyer_id === user ? 'buyer_read' : 'seller_read'},LEAST(?,COALESCE((SELECT MAX(id) FROM private_messages WHERE conversation_id=?),0))) WHERE id=?`,
        [upto, id, id]
      );
    } else if (action === 'report')
      await c.execute(
        'INSERT INTO conversation_reports (id,conversation_id,reporter_id,reason) VALUES (?,?,?,?)',
        [randomUUID(), id, user, reason]
      );
    else throw new ChatError('Thao tác không hợp lệ.', 400);
    await c.commit();
    return { success: true };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
