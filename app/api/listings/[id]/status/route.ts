import { NextResponse } from 'next/server';
import { updateListingStatus, hasDatabaseConfig } from '@/lib/db';
import { updateScrapedListingStatus } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { recordModerationLog } from '@/lib/community-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { status } = body;
  
  if (!status || !['needs_review', 'verified', 'rejected'].includes(status)) {
    return NextResponse.json({ 
      error: 'Invalid status. Must be needs_review, verified, or rejected' 
    }, { status: 400 });
  }
  
  if (hasDatabaseConfig()) {
    try {
      await updateListingStatus(id, status);
      try {
        updateScrapedListingStatus(id, status);
      } catch (cacheError) {
        console.warn('Database status updated; cache sync failed.', cacheError);
      }
      await recordModerationLog({ entityType: 'listing', entityId: id, action: `listing_${status}`, actorEmail: admin.email, details: { status } }).catch(() => undefined);
      return NextResponse.json({ success: true, storage: 'database', databaseSynced: true });
    } catch (error) {
      console.warn('MySQL status update failed; trying file cache.', error);
    }
  }

  if (updateScrapedListingStatus(id, status)) {
    await recordModerationLog({ entityType: 'listing', entityId: id, action: `listing_${status}`, actorEmail: admin.email, details: { status, storage: 'file_cache' } }).catch(() => undefined);
    return NextResponse.json({
      success: true,
      storage: 'file_cache',
      databaseSynced: false,
      message: 'Status updated in the local file cache.'
    });
  }

  return NextResponse.json({ error: 'Listing not found or storage unavailable' }, { status: 404 });
}
