import { resolveRequestUser } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';
import { messages, sendMessage, chatAction, ChatError } from '@/lib/chat-db';
import { rateLimit } from '@/lib/rate-limit';
type Context = { params: Promise<{ id: string }> };
function failure(e: unknown) {
  return apiError(
    e instanceof ChatError ? e.message : 'Chưa thể xử lý tin nhắn. Vui lòng thử lại.',
    e instanceof ChatError ? e.status : 503
  );
}
export async function GET(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const raw = Number(new URL(r.url).searchParams.get('before'));
  const before = Number.isSafeInteger(raw) && raw > 0 ? raw : 0;
  const a = Number(new URL(r.url).searchParams.get('after'));
  const after = Number.isSafeInteger(a) && a > 0 ? a : 0;
  try {
    return apiData(
      await messages((await ctx.params).id, user.id, before, after),
      {},
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const body = await r.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 3000) return apiError('Tin nhắn cần từ 1 đến 3000 ký tự.', 400);
  if (!rateLimit('message:' + user.id, 30, 60000).allowed)
    return apiError('Bạn gửi quá nhanh. Hãy đợi một phút.', 429);
  try {
    return apiData(await sendMessage((await ctx.params).id, user.id, text), {}, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError('Vui lòng đăng nhập.', 401);
  const body = await r.json().catch(() => null);
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (
    !['read', 'block', 'unblock', 'report'].includes(action) ||
    (action === 'report' && (reason.length < 5 || reason.length > 1000))
  )
    return apiError('Thao tác hoặc lý do không hợp lệ.', 400);
  try {
    return apiData(
      await chatAction(
        (await ctx.params).id,
        user.id,
        action,
        reason,
        Number.isSafeInteger(body.upto) && body.upto >= 0 ? body.upto : 0
      )
    );
  } catch (e) {
    return failure(e);
  }
}
