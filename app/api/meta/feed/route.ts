import { NextResponse } from 'next/server';
import { fetchOfficialMetaFeed } from '@/lib/meta';
import { hasDatabaseConfig, saveListings } from '@/lib/db';

export async function GET() {
  try {
    const result = await fetchOfficialMetaFeed();
    const saved = hasDatabaseConfig() ? await saveListings(result.listings) : 0;
    return NextResponse.json({ data: result.listings, stats: result.stats, saved, provider: 'meta-graph-api' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể gọi Meta Graph API.' }, { status: 502 });
  }
}