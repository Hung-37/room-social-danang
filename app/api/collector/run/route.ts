import { NextResponse } from 'next/server';
import { publicSources } from '@/js/collector.js';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { getManagedSourcesAsync } from '@/lib/collector-source-storage';
import { withCollectorJobLock } from '@/lib/collector-job-lock';
import { runCollectorPipeline } from '@/lib/collector-runner';

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.COLLECTOR_CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function getAvailableSources() {
  return publicSources.filter((source) => !source.enabled && ['public_api', 'public_feed', 'public_html'].includes(source.permission));
}

function noSourcesResponse(includeInstructions: boolean) {
  const available = getAvailableSources();
  const message = available.length > 0
    ? `Có ${available.length} nguồn có thể bật. Vui lòng cấu hình URL trong .env.local.`
    : 'Vui lòng sử dụng tính năng Import trong Admin để nhập dữ liệu từ file CSV/JSON.';
  return NextResponse.json(includeInstructions ? {
    data: [],
    meta: {
      ranAt: new Date().toISOString(), configured: 0, collected: 0,
      status: 'no_enabled_sources', available: available.length, message,
      instructions: [
        '1. Cấu hình PUBLIC_FEED_URL trong .env.local cho nguồn JSON',
        '2. Cấu hình HTML_CRAWLER_URL trong .env.local cho nguồn HTML',
        '3. Hoặc sử dụng tính năng Import trong Admin để nhập từ file'
      ]
    }
  } : { status: 'skipped', reason: 'No enabled sources configured', ranAt: new Date().toISOString(), available: available.length, message });
}

async function run(request: Request, mode: 'cron' | 'manual') {
  if (mode === 'cron' && !isAuthorizedCronRequest(request)) return NextResponse.json({ error: 'Cron authorization required.' }, { status: 401 });
  if (mode === 'manual' && !getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  if (mode === 'manual') {
    const limit = rateLimit(`collector:${request.headers.get('x-forwarded-for') ?? 'unknown'}`, 4, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: 'Collector rate limit exceeded.' }, { status: 429 });
  }

  const result = await runCollectorPipeline(await getManagedSourcesAsync());
  if (result.enabledSources.length === 0) return noSourcesResponse(mode === 'manual');
  const payload = {
    data: result.runs,
    meta: {
      ranAt: new Date().toISOString(), configured: result.enabledSources.length,
      collected: result.listings.length, duplicates: result.duplicates,
      persistence: result.persistence, ai: result.ai
    }
  };
  return mode === 'manual'
    ? NextResponse.json(payload)
    : NextResponse.json({ status: 'completed', ranAt: payload.meta.ranAt, ...payload });
}

export async function GET(request: Request) {
  return withCollectorJobLock(() => run(request, 'cron'));
}

export async function POST(request: Request) {
  return withCollectorJobLock(() => run(request, 'manual'));
}
