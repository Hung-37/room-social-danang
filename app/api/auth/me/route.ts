import { NextResponse } from 'next/server';
import { getUserSessionFromRequest } from '@/lib/user-auth';
import { can, roleLabel } from '@/lib/roles';
import { apiError, apiData } from '@/lib/api-response';

export async function GET(request: Request) {
  const user = getUserSessionFromRequest(request);
  if (!user) return apiError('Unauthorized.', 401, 'UNAUTHORIZED');
  return apiData({
      ...user,
      roleLabel: roleLabel(user.role),
      capabilities: {
        canPostCommunity: can(user, 'community:post'),
        canComment: can(user, 'community:comment'),
        canCreateListing: can(user, 'listing:create'),
        canModerate: can(user, 'listing:moderate')
      }
  });
}
