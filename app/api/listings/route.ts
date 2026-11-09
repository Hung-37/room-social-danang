import { NextResponse } from 'next/server';
import { getListingCounts, getListings, hasDatabaseConfig, type ListingFilters } from '@/lib/db';
import { readScrapedListings } from '@/lib/file-storage';
import { readWithDatabaseFallback } from '@/js/listing-read-service.js';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getCommunityCommentCounts } from '@/lib/server-community-storage';
import { getCommunityInteractionTotals } from '@/lib/community-interactions';

function readCachedListings(search: string, clusterId: string, includePending: boolean, limit: number, offset: number, filters: ListingFilters = {}) {
  const cachedData = readScrapedListings({ includeStale: includePending });
  const matchingData = cachedData.filter((item) => {
    const listing = item as { title?: string; summary?: string; address?: string; clusterId?: string };
    if (clusterId && listing.clusterId !== clusterId) return false;
    const price = Number((listing as { price?: unknown }).price);
    const area = Number((listing as { area?: unknown }).area);
    if (filters.minPrice !== undefined && (!Number.isFinite(price) || price < filters.minPrice)) return false;
    if (filters.maxPrice !== undefined && (!Number.isFinite(price) || price > filters.maxPrice)) return false;
    if (filters.minArea !== undefined && (!Number.isFinite(area) || area < filters.minArea)) return false;
    if (filters.maxArea !== undefined && (!Number.isFinite(area) || area > filters.maxArea)) return false;
    if (!search) return true;
    return [listing.title, listing.summary, listing.address, listing.clusterId]
      .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(search));
  });
  const pendingCount = matchingData.filter((item) => (item as { verificationStatus?: string }).verificationStatus === 'needs_review').length;
  const publishedCount = matchingData.filter((item) => (item as { verificationStatus?: string }).verificationStatus === 'verified').length;
  const filtered = includePending
    ? matchingData
    : matchingData.filter((item) => (item as { verificationStatus?: string }).verificationStatus === 'verified');
  const sorted = [...filtered].sort((left, right) => {
    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      const direction = filters.sort === 'price_asc' ? 1 : -1;
      return (Number((left as { price?: unknown }).price) - Number((right as { price?: unknown }).price)) * direction;
    }
    if (filters.sort === 'area_desc') return Number((right as { area?: unknown }).area) - Number((left as { area?: unknown }).area);
    return String((right as { updatedAt?: unknown }).updatedAt ?? '').localeCompare(String((left as { updatedAt?: unknown }).updatedAt ?? ''));
  });
  const data = sorted.slice(offset, offset + limit);
  return {
    data,
    meta: {
      configured: true,
      storage: 'file_cache',
      count: filtered.length,
      pendingCount,
      publishedCount,
      hasMore: offset + data.length < filtered.length,
      nextOffset: offset + data.length
    }
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const includePending = params.get('includePending') === 'true';
  if (includePending && !getAdminSessionFromRequest(request)) {
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  }
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), includePending ? 200 : 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const search = (params.get('q') ?? '').trim().slice(0, 100).toLocaleLowerCase('vi');
  const clusterId = (params.get('cluster') ?? '').trim().slice(0, 100);
  const numberParam = (name: string) => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  const sortValue = params.get('sort');
  const filters: ListingFilters = {
    minPrice: numberParam('minPrice'), maxPrice: numberParam('maxPrice'),
    minArea: numberParam('minArea'), maxArea: numberParam('maxArea'),
    sort: sortValue === 'price_asc' || sortValue === 'price_desc' || sortValue === 'area_desc' ? sortValue : 'newest'
  };

  try {
    const result = await readWithDatabaseFallback({
      databaseConfigured: hasDatabaseConfig(),
      readDatabase: async () => {
        const [data, counts] = await Promise.all([
          getListings(limit, offset, includePending, search, clusterId, filters),
          getListingCounts(search, clusterId, includePending, filters)
        ]);
        const totalCount = counts.publishedCount + counts.pendingCount + counts.rejectedCount;
        return {
          data,
          meta: {
            configured: true,
            ...counts,
            count: includePending ? totalCount : counts.publishedCount,
            hasMore: offset + data.length < (includePending ? totalCount : counts.publishedCount),
            nextOffset: offset + data.length
          }
        };
      },
      readCache: async () => readCachedListings(search, clusterId, includePending, limit, offset, filters)
    });
    const ids = result.data.map((item) => String((item as { externalId?: unknown }).externalId));
    const commentCounts = getCommunityCommentCounts(ids);
    const reactionCounts = getCommunityInteractionTotals(ids);
    const headers = includePending
      ? undefined
      : { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' };
    return NextResponse.json({
      data: result.data.map((item) => ({
        ...(item as Record<string, unknown>),
        commentCount: Number((item as { commentCount?: unknown }).commentCount ?? commentCounts[String((item as { externalId?: unknown }).externalId)] ?? 0),
        reactionCount: reactionCounts[String((item as { externalId?: unknown }).externalId)] ?? 0
      })),
      meta: result.meta
    }, headers ? { headers } : undefined);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đọc dữ liệu.' }, { status: 503 });
  }
}
