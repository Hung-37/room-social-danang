import { NextResponse } from 'next/server';
import { fetchGenericUrlListings, isPublicFeedUrl } from '@/js/collector.js';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const limit = rateLimit(`collector-preview:${request.headers.get('x-forwarded-for') ?? 'unknown'}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'Bạn đã vượt giới hạn thử URL trong giờ này.' }, { status: 429 });

  try {
    const body = await request.json() as { url?: unknown; maxPages?: unknown };
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!isPublicFeedUrl(url)) {
      return NextResponse.json({ error: 'Chỉ nhận URL HTTPS công khai; không nhận localhost, IP nội bộ, URL có tài khoản hoặc trang mẫu.' }, { status: 400 });
    }
    const maxPages = Math.min(20, Math.max(1, Number(body.maxPages ?? 1) || 1));
    const result = await fetchGenericUrlListings(url, fetch, { maxPages });
    return NextResponse.json({
      data: result.listings.slice(0, 100),
      meta: { url, format: result.format, pages: result.pages, maxPages, received: result.listings.length, limited: result.listings.length > 100, robots: result.robots, warnings: result.warnings }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đọc URL này.' }, { status: 400 });
  }
}
