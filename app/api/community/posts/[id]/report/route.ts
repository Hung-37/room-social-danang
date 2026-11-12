import { NextResponse } from 'next/server';
import { resolveRequestUser } from '@/lib/user-auth';
import { createCommunityReport, hasCommunityDatabase } from '@/lib/community-db';

const allowedReasons = ['spam', 'scam', 'harassment', 'wrong_information', 'other'] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để báo cáo.' }, { status: 401 });
  if (!hasCommunityDatabase()) return NextResponse.json({ error: 'Tính năng báo cáo cần database.' }, { status: 503 });
  const { id: postId } = await params;
  const body = await request.json().catch(() => ({})) as { reason?: unknown; details?: unknown };
  const reason = allowedReasons.includes(body.reason as typeof allowedReasons[number]) ? body.reason as string : null;
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1000) : '';
  if (!reason) return NextResponse.json({ error: 'Lý do báo cáo không hợp lệ.' }, { status: 400 });
  try {
    await createCommunityReport({ id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, postId, reporterExternalId: user.id, reason, details });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Không thể lưu báo cáo hoặc bài viết không tồn tại.' }, { status: 400 });
  }
}
