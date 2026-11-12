import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { visits, requestVisit } from '@/lib/appointments';
import { ChatError } from '@/lib/chat-db';
import { rateLimit } from '@/lib/rate-limit';
export async function GET(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const u = sessionResult.user;
  if (!u) return apiError('Vui lòng đăng nhập.', 401);
  const p = new URL(r.url).searchParams;
  try {
    return apiData(
      await visits(u.id, (p.get('conversation') || '').slice(0, 191), p.get('history') === '1'),
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return apiError(
      e instanceof ChatError ? e.message : 'Chưa tải được lịch xem phòng.',
      e instanceof ChatError ? e.status : 503
    );
  }
}
export async function POST(r: Request) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const u = sessionResult.user;
  if (!u) return apiError('Vui lòng đăng nhập.', 401);
  const b = await r.json().catch(() => null);
  if (!b || typeof b !== 'object' || Array.isArray(b))
    return apiError('Thông tin lịch không hợp lệ.', 400);
  if (!rateLimit('visit:' + u.id, 20, 3600000).allowed)
    return apiError('Bạn đã gửi nhiều đề xuất. Hãy thử lại sau.', 429);
  try {
    return apiData(await requestVisit(u.id, b), {}, { status: 201 });
  } catch (e) {
    return apiError(
      e instanceof ChatError ? e.message : 'Chưa thể lưu lịch. Vui lòng thử lại.',
      e instanceof ChatError ? e.status : 503
    );
  }
}
