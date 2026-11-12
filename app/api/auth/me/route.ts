import { account } from '@/lib/account-db';
import { landlordStatus } from '@/lib/landlord-db';
import { resolveRequestUser } from '@/lib/user-auth';
import { can, roleLabel } from '@/lib/roles';
import { apiError, apiData } from '@/lib/api-response';

export async function GET(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  let user = sessionResult.user;
  if (!user) return apiError('Unauthorized.', 401, 'UNAUTHORIZED');
  try {
    const fresh = await account(user.id);
    if (!fresh) return apiError('Tài khoản không còn tồn tại.', 401);
    user = fresh;
  } catch {
    return apiError('Chưa thể tải tài khoản.', 503);
  }
  let verificationStatus: string | null = null;
  if (user.role === 'landlord') {
    try {
      verificationStatus = await landlordStatus(user.id);
    } catch {
      return apiError('Không thể kiểm tra tài khoản chủ trọ.', 503, 'DATABASE_UNAVAILABLE');
    }
  }
  return apiData({
    verificationStatus,
    ...user,
    roleLabel: roleLabel(user.role),
    capabilities: {
      canPostCommunity: can(user, 'community:post'),
      canComment: can(user, 'community:comment'),
      canCreateListing:
        can(user, 'listing:create') &&
        (user.role !== 'landlord' || verificationStatus === 'verified'),
      canModerate: can(user, 'listing:moderate')
    }
  });
}
