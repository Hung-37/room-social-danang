import { NextResponse } from 'next/server';
import { COMMUNITY_REACTIONS, getCommunityInteractions, setCommunityInteraction, type CommunityReaction } from '@/lib/community-interactions';
import { getUserSessionFromRequest } from '@/lib/user-auth';
import { communityPostExists, getCommunityInteractionsDb, hasCommunityDatabase, setCommunityInteractionDb } from '@/lib/community-db';

function validActorId(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUserSessionFromRequest(request);
  if (hasCommunityDatabase()) {
    try {
      if (await communityPostExists(id)) return NextResponse.json({ data: await getCommunityInteractionsDb(id, user?.id), storage: 'database' });
    }
    catch { /* use file fallback */ }
  }
  return NextResponse.json({ data: getCommunityInteractions(id, user?.id), storage: 'file_cache' });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUserSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để tương tác.' }, { status: 401 });
  let body: { reaction?: unknown };
  try {
    body = await request.json() as { reaction?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const actorId = validActorId(user.id);
  const reaction = body.reaction === null || body.reaction === undefined
    ? null
    : COMMUNITY_REACTIONS.includes(body.reaction as CommunityReaction) ? body.reaction as CommunityReaction : undefined;
  if (!actorId || reaction === undefined) {
    return NextResponse.json({ error: 'Người dùng hoặc reaction không hợp lệ.' }, { status: 400 });
  }
  if (hasCommunityDatabase()) {
    try {
      if (await communityPostExists(id)) return NextResponse.json({ data: await setCommunityInteractionDb(id, actorId, reaction), storage: 'database' });
    }
    catch { /* use file fallback */ }
  }
  return NextResponse.json({ data: setCommunityInteraction(id, actorId, reaction) });
}
