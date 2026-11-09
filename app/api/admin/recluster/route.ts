import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { hasDatabaseConfig, getListings, updateListingCluster } from '@/lib/db';
import { readScrapedListings, writeScrapedListings } from '@/lib/file-storage';
import { ensureClusterAssigned } from '@/lib/auto-cluster';
import { apiData, apiError } from '@/lib/api-response';

export async function POST(request: Request) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return apiError('Yêu cầu quyền quản trị viên.', 401, 'UNAUTHORIZED');

  let updatedCount = 0;
  let databaseUpdated = 0;

  // Xử lý database nếu có
  if (hasDatabaseConfig()) {
    try {
      const listings = await getListings(1000, 0, true, '', '');
      for (const listing of listings) {
        const oldClusterId = listing.clusterId;
        const newClusterId = ensureClusterAssigned({
          address: listing.address,
          title: listing.title,
          summary: listing.summary,
          clusterId: listing.clusterId
        });

        if (oldClusterId !== newClusterId) {
          await updateListingCluster(listing.externalId, newClusterId);
          databaseUpdated++;
        }
      }
    } catch (error) {
      console.error('Error re-clustering database listings:', error);
    }
  }

  // Xử lý file storage
  try {
    const listings = readScrapedListings({ includeStale: true });
    const updatedListings = listings.map((listing) => {
      const oldClusterId = listing.clusterId;
      const newClusterId = ensureClusterAssigned({
        address: listing.address,
        title: listing.title,
        summary: listing.summary,
        clusterId: listing.clusterId
      });

      if (oldClusterId !== newClusterId) {
        updatedCount++;
        return { ...listing, clusterId: newClusterId };
      }
      return listing;
    });

    if (updatedCount > 0) {
      writeScrapedListings(updatedListings);
    }
  } catch (error) {
    console.error('Error re-clustering file listings:', error);
  }

  return apiData({
    fileUpdated: updatedCount,
    databaseUpdated,
    totalUpdated: updatedCount + databaseUpdated
  });
}
