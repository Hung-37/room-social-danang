import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { updateVisit } from '@/lib/appointments';
import { ChatError } from '@/lib/chat-db';
export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const u = sessionResult.user;
  if (!u) return apiError('Vui lòng đăng nhập.', 401);
  const b = await r.json().catch(() => null);
  if (!b || typeof b !== 'object') return apiError('Thông tin lịch không hợp lệ.', 400);
  try {
    return apiData(await updateVisit(u.id, (await params).id, b));
  } catch (e) {
    return apiError(
      e instanceof ChatError ? e.message : 'Chưa cập nhật được lịch.',
      e instanceof ChatError ? e.status : 503
    );
  }
}
