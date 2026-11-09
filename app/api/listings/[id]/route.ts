import { NextResponse } from 'next/server';
import { getListingById, hasDatabaseConfig } from '@/lib/db';
import { readScrapedListings } from '@/lib/file-storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasDatabaseConfig()) {
    try {
      const listing = await getListingById(id);
      return NextResponse.json({
        data: listing,
        meta: { configured: true, found: Boolean(listing), storage: 'database' }
      }, { status: listing ? 200 : 404 });
    } catch (error) {
      console.warn('MySQL unavailable; reading listing cache.', error);
    }
  }

  try {
    const listing = readScrapedListings({ includeStale: false }).find((item) => (
      item && typeof item === 'object' && String((item as { externalId?: unknown }).externalId) === id
    ));
    if (listing) {
      if ((listing as { verificationStatus?: string }).verificationStatus !== 'verified') {
        return NextResponse.json({ data: null, meta: { configured: true, found: false } }, { status: 404 });
      }
      return NextResponse.json({ data: listing, meta: { configured: true, found: true, storage: 'file_cache' } });
    }
  } catch (error) {
    console.error('Không thể đọc file dữ liệu cào:', error);
  }
  
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ 
      data: null, 
      meta: { configured: false } 
    });
  }
  
  return NextResponse.json({ error: 'Không thể đọc dữ liệu từ MySQL hoặc cache.' }, { status: 503 });
}
