import { NextResponse } from 'next/server';
import { getUserSessionFromRequest } from '@/lib/user-auth';
import { can } from '@/lib/roles';
import { hasDatabaseConfig, saveListings } from '@/lib/db';
import { writeScrapedListings } from '@/lib/file-storage';
import { apiError, apiData } from '@/lib/api-response';
import { validateListingInput } from '@/js/domain-policies.js';
import { ensureClusterAssigned } from '@/lib/auto-cluster';

const MAX_TITLE = 120;
const MAX_SUMMARY = 3000;

export async function POST(request: Request) {
  const user = getUserSessionFromRequest(request);
  if (!user || !can(user, 'listing:create')) return apiError('Chỉ chủ trọ mới có thể đăng tin phòng.', 403, 'FORBIDDEN');
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const price = Number(body.price);
  const area = Number(body.area);
  if (title.length < 5 || title.length > MAX_TITLE || summary.length < 20 || summary.length > MAX_SUMMARY || !validateListingInput({ title, summary, address, price, area })) {
    return apiError('Vui lòng nhập đầy đủ tiêu đề, mô tả, địa chỉ, giá và diện tích hợp lệ.', 400, 'INVALID_INPUT');
  }
  const clusterId = ensureClusterAssigned({ address, title, summary, clusterId: typeof body.clusterId === 'string' ? body.clusterId : null });

  const listing = {
    externalId: `landlord-${user.id}-${Date.now()}`,
    title, summary, price: Math.round(price), area, address,
    phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : null,
    imageUrl: typeof body.imageUrl === 'string' && body.imageUrl.startsWith('https://') ? body.imageUrl : null,
    clusterId,
    source: { name: `Chủ trọ: ${user.name}`, url: null, permission: 'landlord_submission' },
    verificationStatus: 'needs_review', trustScore: 30
  };
  const saved = writeScrapedListings([listing]);
  let databaseSaved = 0;
  if (hasDatabaseConfig()) databaseSaved = await saveListings([listing]);
  return apiData(listing, { saved, databaseSaved, status: 'needs_review' }, { status: 201 });
}
