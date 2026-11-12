import { randomUUID } from "node:crypto";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import { getDatabasePool as db } from "./mysql-pool";
import { ChatError } from "./chat-db";
type Chat = RowDataPacket & {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  blocked_by: string | null;
};
type Visit = RowDataPacket & {
  id: string;
  conversation_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  version: number;
  startsAt: string;
  endsAt: string;
};
const dates =
  "DATE_FORMAT(starts_at,'%Y-%m-%dT%H:%i:%s.000Z') AS startsAt,DATE_FORMAT(ends_at,'%Y-%m-%dT%H:%i:%s.000Z') AS endsAt";
function sqlDate(d: Date) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
async function chat(c: PoolConnection, id: string, user: string) {
  const [rows] = await c.query<Chat[]>(
    "SELECT * FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?) FOR UPDATE",
    [id, user, user],
  );
  if (!rows[0]) throw new ChatError("Không tìm thấy cuộc trò chuyện.", 404);
  return rows[0];
}
async function available(c: PoolConnection, room: Chat) {
  if (room.blocked_by)
    throw new ChatError(
      "Hội thoại đang bị chặn. Không thể tạo hoặc xác nhận lịch.",
      409,
    );
  const days = Math.max(Number(process.env.LISTING_STALE_DAYS) || 30, 1);
  const [rows] = await c.query<RowDataPacket[]>(
    `SELECT l.external_id FROM listings l JOIN landlord_verifications v ON v.user_external_id=l.owner_external_id AND v.status='verified' JOIN users u ON u.external_id=l.owner_external_id AND u.role='landlord' WHERE l.external_id=? AND l.owner_external_id=? AND l.verification_status='verified' AND l.updated_at>=DATE_SUB(NOW(),INTERVAL ${days} DAY)`,
    [room.listing_id, room.seller_id],
  );
  if (!rows.length)
    throw new ChatError(
      "Phòng chưa công khai hoặc chủ trọ chưa được xác minh. Hãy trao đổi trước khi đặt lịch.",
      409,
    );
}
async function notify(
  c: PoolConnection,
  to: string,
  id: string,
  title: string,
) {
  await c.execute(
    "UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [id],
  );
  await c.execute(
    "INSERT INTO notifications(user_id,type,title,body,href) SELECT id,'viewing',?,'Mở lịch xem phòng để xem thời gian và trạng thái.',? FROM users WHERE external_id=?",
    [title, "/tin-nhan?hoi-thoai=" + id, to],
  );
}
export async function visits(
  user: string,
  conversation: string,
  history: boolean,
) {
  if (conversation) {
    const [member] = await db().query<RowDataPacket[]>(
      "SELECT id FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?)",
      [conversation, user, user],
    );
    if (!member.length)
      throw new ChatError("Không tìm thấy cuộc trò chuyện.", 404);
  }
  const conditions = conversation
    ? " AND a.conversation_id=?"
    : history
      ? " AND (a.ends_at<UTC_TIMESTAMP() OR a.status IN ('cancelled','declined','completed'))"
      : " AND a.ends_at>=UTC_TIMESTAMP() AND a.status IN ('requested','confirmed')";
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT a.id,a.conversation_id AS conversationId,a.buyer_id AS buyerId,a.seller_id AS sellerId,a.status,a.version,a.note,DATE_FORMAT(a.starts_at,'%Y-%m-%dT%H:%i:%s.000Z') AS startsAt,DATE_FORMAT(a.ends_at,'%Y-%m-%dT%H:%i:%s.000Z') AS endsAt,c.room_title AS title,(l.external_id IS NULL) AS roomDeleted,u.name AS otherName FROM viewing_appointments a JOIN conversations c ON c.id=a.conversation_id LEFT JOIN listings l ON l.external_id=c.listing_id JOIN users u ON u.external_id=IF(a.buyer_id=?,a.seller_id,a.buyer_id) WHERE (a.buyer_id=? OR a.seller_id=?)${conditions} ORDER BY ${conversation ? "(a.status IN ('requested','confirmed') AND a.ends_at>=UTC_TIMESTAMP()) DESC," : ""} a.starts_at ${conversation || history ? "DESC" : "ASC"},a.id DESC LIMIT 100`,
    conversation ? [user, user, user, conversation] : [user, user, user],
  );
  return rows;
}
export async function requestVisit(user: string, b: Record<string, unknown>) {
  if (
    typeof b.conversationId !== "string" ||
    !b.conversationId ||
    b.conversationId.length > 191 ||
    typeof b.startsAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      b.startsAt,
    )
  )
    throw new ChatError("Chọn ngày giờ xem phòng hợp lệ, có múi giờ.", 400);
  const day = b.startsAt.slice(0, 10);
  const parsedDay = new Date(day + "T00:00:00Z");
  if (
    !Number.isFinite(parsedDay.getTime()) ||
    parsedDay.toISOString().slice(0, 10) !== day ||
    Number(b.startsAt.slice(11, 13)) > 23 ||
    Number(b.startsAt.slice(14, 16)) > 59
  )
    throw new ChatError("Ngày xem phòng không tồn tại.", 400);
  const date = new Date(b.startsAt);
  const delta = date.getTime() - Date.now();
  if (!Number.isFinite(delta) || delta < 3600000 || delta > 60 * 86400000)
    throw new ChatError(
      "Lịch cần cách hiện tại ít nhất 1 giờ và trong 60 ngày tới.",
      400,
    );
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 500) throw new ChatError("Ghi chú tối đa 500 ký tự.", 400);
  const c = await db().getConnection();
  try {
    await c.beginTransaction();
    const room = await chat(c, b.conversationId, user);
    if (room.buyer_id !== user)
      throw new ChatError(
        "Người tìm phòng gửi đề xuất giờ; chủ trọ xác nhận trong lịch.",
        403,
      );
    await available(c, room);
    const [existing] = await c.query<RowDataPacket[]>(
      "SELECT id FROM viewing_appointments WHERE conversation_id=? AND status IN ('requested','confirmed') AND ends_at>=UTC_TIMESTAMP() LIMIT 1",
      [room.id],
    );
    if (existing.length)
      throw new ChatError(
        "Hội thoại đã có lịch đang chờ hoặc đã xác nhận. Hủy lịch cũ trước khi đề xuất giờ khác.",
        409,
      );
    const id = randomUUID(),
      end = new Date(date.getTime() + 1800000);
    await c.execute(
      "INSERT INTO viewing_appointments(id,conversation_id,buyer_id,seller_id,starts_at,ends_at,note) VALUES (?,?,?,?,?,?,?)",
      [
        id,
        room.id,
        room.buyer_id,
        room.seller_id,
        sqlDate(date),
        sqlDate(end),
        note,
      ],
    );
    await notify(c, room.seller_id, room.id, "Có đề xuất lịch xem phòng");
    await c.commit();
    return { id, status: "requested", version: 1 };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function updateVisit(
  user: string,
  id: string,
  b: Record<string, unknown>,
) {
  const action = b.action;
  if (
    !["confirm", "decline", "cancel", "complete"].includes(String(action)) ||
    !Number.isSafeInteger(b.version) ||
    Number(b.version) < 1
  )
    throw new ChatError("Thao tác hoặc phiên bản lịch không hợp lệ.", 400);
  const c = await db().getConnection();
  try {
    await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await c.beginTransaction();
    // Lock conversation first, matching request/block/send operations.
    const [found] = await c.query<RowDataPacket[]>(
      "SELECT conversation_id FROM viewing_appointments WHERE id=? AND (buyer_id=? OR seller_id=?)",
      [id, user, user],
    );
    if (!found[0]) throw new ChatError("Không tìm thấy lịch của bạn.", 404);
    const room = await chat(c, found[0].conversation_id, user);
    const [rows] = await c.query<Visit[]>(
      `SELECT *,${dates} FROM viewing_appointments WHERE id=? FOR UPDATE`,
      [id],
    );
    const visit = rows[0];
    if (!visit || Number(visit.version) !== b.version)
      throw new ChatError(
        "Lịch đã thay đổi. Tải lại để xem trạng thái mới.",
        409,
      );
    const seller = room.seller_id === user;
    if (action !== "cancel" && !seller)
      throw new ChatError(
        "Chỉ chủ trọ có thể xác nhận, từ chối hoặc hoàn tất lịch.",
        403,
      );
    if (action === "confirm") {
      if (
        visit.status !== "requested" ||
        new Date(visit.startsAt).getTime() <= Date.now()
      )
        throw new ChatError("Chỉ xác nhận lịch đang chờ và chưa bắt đầu.", 409);
      await available(c, room);
      // Serialize confirmations for BOTH people across different conversations.
      const people = [room.seller_id, room.buyer_id].sort();
      for (const person of people)
        await c.query(
          "SELECT external_id FROM users WHERE external_id=? FOR UPDATE",
          [person],
        );
      const [conflicts] = await c.query<RowDataPacket[]>(
        "SELECT id FROM viewing_appointments WHERE id<>? AND status='confirmed' AND starts_at<? AND ends_at>? AND (buyer_id IN (?,?) OR seller_id IN (?,?)) LIMIT 1",
        [
          id,
          sqlDate(new Date(visit.endsAt)),
          sqlDate(new Date(visit.startsAt)),
          ...people,
          ...people,
        ],
      );
      if (conflicts.length)
        throw new ChatError(
          "Một trong hai người đã có lịch xem phòng trùng giờ. Hãy đề xuất khung giờ khác.",
          409,
        );
    } else if (action === "decline" && visit.status !== "requested")
      throw new ChatError("Chỉ từ chối lịch đang chờ.", 409);
    else if (
      action === "cancel" &&
      !["requested", "confirmed"].includes(visit.status)
    )
      throw new ChatError("Lịch này không còn có thể hủy.", 409);
    else if (
      action === "complete" &&
      (visit.status !== "confirmed" ||
        new Date(visit.startsAt).getTime() > Date.now())
    )
      throw new ChatError(
        "Chỉ hoàn tất lịch đã xác nhận và đã đến giờ xem phòng.",
        409,
      );
    const status =
      action === "confirm"
        ? "confirmed"
        : action === "decline"
          ? "declined"
          : action === "cancel"
            ? "cancelled"
            : "completed";
    await c.execute(
      "UPDATE viewing_appointments SET status=?,version=version+1 WHERE id=?",
      [status, id],
    );
    await notify(
      c,
      seller ? room.buyer_id : room.seller_id,
      room.id,
      status === "confirmed"
        ? "Lịch xem phòng đã được xác nhận"
        : status === "cancelled"
          ? "Lịch xem phòng đã được hủy"
          : status === "declined"
            ? "Chủ trọ đã từ chối lịch xem phòng"
            : "Buổi xem phòng đã hoàn tất",
    );
    await c.commit();
    return { id, status, version: Number(visit.version) + 1 };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
