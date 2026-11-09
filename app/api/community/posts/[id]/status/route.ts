import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { moderateCommunityPost } from '@/lib/community-db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!process.env.MYSQL_URL?.trim()) return NextResponse.json({ error: 'MYSQL_URL is not configured.' }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: unknown };
  const status = body.status === 'verified' || body.status === 'rejected' || body.status === 'needs_review' ? body.status : null;
  if (!status) return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 });
  const updated = await moderateCommunityPost(id, status, admin.email);
  return updated ? NextResponse.json({ success: true, id, status }) : NextResponse.json({ error: 'Không tìm thấy bài viết.' }, { status: 404 });
}
