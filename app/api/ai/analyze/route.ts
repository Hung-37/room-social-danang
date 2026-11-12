import { analyzeWithOllama } from '@/lib/ollama';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { apiData, apiError } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(r: Request) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quyền Admin để phân tích AI.', 401);
  if (!rateLimit('ai-admin', 20, 3600000).allowed)
    return apiError('Đã đạt giới hạn phân tích AI. Hãy thử lại sau.', 429);
  const b = await r.json().catch(() => null);
  if (typeof b?.text !== 'string' || !b.text.trim() || b.text.length > 12000)
    return apiError('Nội dung cần từ 1 đến 12.000 ký tự.', 400);
  try {
    return apiData(await analyzeWithOllama(b.text));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Chưa phân tích được AI.', 503);
  }
}
