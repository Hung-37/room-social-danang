import { getPublicThread } from '@/lib/thread-access';
import { NextResponse } from 'next/server';
import {
  COMMUNITY_REACTIONS,
  getCommunityInteractions,
  setCommunityInteraction,
  type CommunityReaction
} from '@/lib/community-interactions';
import { resolveRequestUser } from '@/lib/user-auth';
import {
  getCommunityInteractionsDb,
  hasCommunityDatabase,
  setCommunityInteractionDb
} from '@/lib/community-db';

function validActorId(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  try {
    if (!(await getPublicThread(id)))
      return NextResponse.json(
        { error: 'Nội dung không tồn tại hoặc chưa được duyệt.' },
        { status: 404 }
      );
  } catch {
    return NextResponse.json({ error: 'Không thể tải tương tác.' }, { status: 503 });
  }
  if (hasCommunityDatabase()) {
    try {
      return NextResponse.json(
        { data: await getCommunityInteractionsDb(id, user?.id), storage: 'database' },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    } catch {
      return NextResponse.json({ error: 'Không thể tải tương tác.' }, { status: 503 });
    }
  }
  return NextResponse.json({ data: getCommunityInteractions(id, user?.id), storage: 'file_cache' });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user)
    return NextResponse.json({ error: 'Bạn cần đăng nhập để tương tác.' }, { status: 401 });
  let body: { reaction?: unknown };
  try {
    body = (await request.json()) as { reaction?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const actorId = validActorId(user.id);
  const reaction =
    body.reaction === null || body.reaction === undefined
      ? null
      : COMMUNITY_REACTIONS.includes(body.reaction as CommunityReaction)
        ? (body.reaction as CommunityReaction)
        : undefined;
  if (!actorId || reaction === undefined) {
    return NextResponse.json({ error: 'Người dùng hoặc reaction không hợp lệ.' }, { status: 400 });
  }
  try {
    if (!(await getPublicThread(id)))
      return NextResponse.json(
        { error: 'Nội dung không tồn tại hoặc chưa được duyệt.' },
        { status: 404 }
      );
  } catch {
    return NextResponse.json({ error: 'Không thể gửi tương tác.' }, { status: 503 });
  }
  if (hasCommunityDatabase()) {
    try {
      return NextResponse.json({
        data: await setCommunityInteractionDb(id, actorId, reaction),
        storage: 'database'
      });
    } catch {
      return NextResponse.json({ error: 'Không thể gửi tương tác.' }, { status: 503 });
    }
  }
  if (process.env.NODE_ENV === 'production')
    return NextResponse.json({ error: 'Chưa kết nối cơ sở dữ liệu.' }, { status: 503 });
  return NextResponse.json({ data: setCommunityInteraction(id, actorId, reaction) });
}
