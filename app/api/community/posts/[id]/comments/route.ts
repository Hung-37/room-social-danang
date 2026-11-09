import { NextResponse } from 'next/server';
import { createCommunityComment, listCommunityComments } from '@/lib/server-community-storage';
import { communityPostExists, createCommunityComment as createCommunityCommentDb, hasCommunityDatabase, listCommunityComments as listCommunityCommentsDb } from '@/lib/community-db';
import { getUserSessionFromRequest } from '@/lib/user-auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (hasCommunityDatabase()) {
    try {
      if (await communityPostExists(id)) return NextResponse.json({ data: await listCommunityCommentsDb(id), storage: 'database' });
    }
    catch { /* use file fallback */ }
  }
  return NextResponse.json({ data: listCommunityComments(id), storage: 'file_cache' });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để bình luận.' }, { status: 401 });
  const { id } = await params;
  let body: { authorName?: unknown; text?: unknown };
  try {
    body = await request.json() as { authorName?: unknown; text?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 2 || text.length > 2000) {
    return NextResponse.json({ error: 'Bình luận phải có từ 2 đến 2000 ký tự.' }, { status: 400 });
  }

  const comment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorName: user.name.slice(0, 40),
    text,
    createdAt: new Date().toISOString()
  };

  if (hasCommunityDatabase()) {
    try {
      if (!(await communityPostExists(id))) throw new Error('Listing thread is stored in file fallback.');
      const comments = await createCommunityCommentDb(id, comment, user.id);
      return NextResponse.json({ data: comments.at(-1), count: comments.length, storage: 'database' }, { status: 201 });
    } catch (error) { console.warn('Community database unavailable; using file fallback.', error); }
  }

  const comments = createCommunityComment(id, comment);

  if (!comments) return NextResponse.json({ error: 'Không tìm thấy bài thảo luận.' }, { status: 404 });
  return NextResponse.json({ data: comments.at(-1), count: comments.length }, { status: 201 });
}
