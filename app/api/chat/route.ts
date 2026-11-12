import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { startConversation, inbox, ChatError } from '@/lib/chat-db';
export async function GET(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get('q') || '').trim();
    const filter = params.get('filter') || 'all';
    if (query.length > 100 || !['all', 'unread', 'blocked'].includes(filter))
      return apiError('Bộ lọc hội thoại không hợp lệ.', 400);
    return apiData(
      await inbox(user.id, query, filter),
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return apiError('Chưa thể tải hộp thư.', 503);
  }
}
export async function POST(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const body = await request.json().catch(() => null);
  if (typeof body?.listingId !== 'string' || body.listingId.length > 191)
    return apiError('Phòng không hợp lệ.', 400);
  try {
    return apiData(await startConversation(body.listingId, user.id));
  } catch (e) {
    return apiError(
      e instanceof ChatError ? e.message : 'Chưa thể mở cuộc trò chuyện.',
      e instanceof ChatError ? e.status : 503
    );
  }
}
