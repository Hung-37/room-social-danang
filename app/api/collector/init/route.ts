import { NextResponse } from 'next/server';
import { collectConfiguredSources, mergeCollectedRuns } from '@/js/collector-service.js';
import { hasDatabaseConfig, saveListings } from '@/lib/db';
import { writeScrapedListings, readScrapedListings } from '@/lib/file-storage';
import { recordCollectorRun } from '@/lib/collector-run-storage';
import { rateLimit } from '@/lib/rate-limit';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getManagedSources } from '@/lib/collector-source-storage';

/**
 * Khởi tạo nền: giữ dữ liệu cũ và thu thập thêm dữ liệu mới.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const suppliedCronSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!getAdminSessionFromRequest(request) && (!cronSecret || suppliedCronSecret !== cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const limit = rateLimit(`collector-init:${request.headers.get('x-forwarded-for') ?? 'unknown'}`, 2, 10 * 60 * 1000);
    if (!limit.allowed) {
      const existingData = readScrapedListings({ includeStale: true });
      return NextResponse.json({ status: 'rate_limited', count: existingData.length }, { status: 429 });
    }

    // Merge dữ liệu mới vào cache; trạng thái verified/rejected được bảo toàn.
    const fileSources = getManagedSources().filter(source => source.enabled && [
      'local_file', 'public_api', 'public_feed', 'public_html'
    ].includes(source.permission));
    
    if (fileSources.length === 0) {
      return NextResponse.json({
        status: 'no_sources',
        message: 'Không có nguồn công khai nào được bật.'
      });
    }

    const { sources, runs } = await collectConfiguredSources({ sources: fileSources });

    if (sources.length === 0) {
      return NextResponse.json({
        status: 'no_enabled_sources',
        message: 'Không có nguồn nào được bật.'
      });
    }

    const { listings, duplicates } = mergeCollectedRuns(runs);
    
    if (listings.length === 0) {
      return NextResponse.json({
        status: 'no_listings',
        message: 'Không có tin mới; dữ liệu đã lưu vẫn được giữ nguyên.'
      });
    }

    // Lưu vào cache
    const saved = writeScrapedListings(listings);
    if (hasDatabaseConfig()) {
      await saveListings(listings);
    }

    recordCollectorRun({
      ranAt: new Date().toISOString(),
      status: 'completed',
      configured: sources.length,
      collected: listings.length,
      duplicates,
      errors: runs.filter(run => run.status === 'error').length
    });

    return NextResponse.json({
      status: 'initialized',
      message: 'Đã cập nhật dữ liệu; tin mới đang chờ duyệt.',
      meta: {
        configured: sources.length,
        collected: listings.length,
        duplicates,
        saved,
        storage: 'data/cached-listings.json'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Lỗi không xác định.'
    }, { status: 500 });
  }
}
