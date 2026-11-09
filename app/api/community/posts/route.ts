import { NextResponse } from 'next/server';
import type { RoomPost } from '@/lib/data';
import { createCommunityPost, listCommunityPosts } from '@/lib/server-community-storage';
import { normalizeToRoomPost } from '@/lib/data';
import { createCommunityPost as createCommunityPostDb, hasCommunityDatabase, listCommunityPosts as listCommunityPostsDb } from '@/lib/community-db';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getUserSessionFromRequest } from '@/lib/user-auth';
import { apiData, apiError } from '@/lib/api-response';

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 3000;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const includePending = Boolean(getAdminSessionFromRequest(request));
  let posts;
  if (hasCommunityDatabase()) {
    try {
      posts = await listCommunityPostsDb(limit, offset, includePending);
      return apiData(posts, {
        meta: { count: posts.length, hasMore: posts.length === limit, nextOffset: offset + posts.length },
        storage: 'database'
      }, { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' } });
    } catch { /* use file fallback when MySQL is unavailable */ }
  }
  posts = listCommunityPosts(includePending).slice(offset, offset + limit);
  return apiData(posts, {
    meta: { count: posts.length, hasMore: posts.length === limit, nextOffset: offset + posts.length },
    storage: 'file_cache'
  }, { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' } });
}

export async function POST(request: Request) {
  const user = getUserSessionFromRequest(request);
  if (!user) return apiError('Bạn cần đăng nhập để đăng bài.', 401, 'UNAUTHORIZED');
  let body: Partial<RoomPost>;
  try {
    body = await request.json() as Partial<RoomPost>;
  } catch {
    return apiError('Invalid JSON body.', 400, 'INVALID_JSON');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || title.length < 5 || title.length > MAX_TITLE_LENGTH || summary.length < 20 || summary.length > MAX_BODY_LENGTH) {
    return apiError('Tiêu đề hoặc nội dung chưa hợp lệ.', 400, 'INVALID_INPUT');
  }

  const post: RoomPost = {
    ...body,
    id,
    title,
    summary,
    price: '',
    area: '',
    distance: '',
    source: 'Website',
    comments: 0,
    updated: new Date().toISOString(),
    status: 'Cần kiểm chứng',
    image: '💬',
    trust: 20,
    clusterId: typeof body.clusterId === 'string' ? body.clusterId : 'chua-phan-cum',
    clusterName: typeof body.clusterName === 'string' ? body.clusterName : 'Chưa phân cụm',
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 5).map(String) : [],
    authorName: user.name.slice(0, 40),
    postKind: body.postKind === 'experience' || body.postKind === 'warning' ? body.postKind : 'question'
  };

  if (hasCommunityDatabase()) {
    try { return apiData(await createCommunityPostDb(post, user.id), { success: true, storage: 'database' }, { status: 201 }); }
    catch (error) { console.warn('Community database unavailable; using file fallback.', error); }
  }
  return apiData(createCommunityPost(post), { success: true, storage: 'file_cache' }, { status: 201 });
}
