import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { RoomPost } from '@/lib/data';
import { clusters, UNASSIGNED_CLUSTER_ID } from '@/lib/data';
import { readScrapedListings } from '@/lib/file-storage';
import type { CommunityComment } from '@/lib/types';

type CommunityThread = {
  post: RoomPost;
  comments: CommunityComment[];
};

const COMMUNITY_FILE = join(process.cwd(), 'data', 'community-posts.json');

function readThreads(): CommunityThread[] {
  if (!existsSync(COMMUNITY_FILE)) return [];
  try {
    const value = JSON.parse(readFileSync(COMMUNITY_FILE, 'utf8')) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is CommunityThread =>
        entry !== null &&
        typeof entry === 'object' &&
        'post' in entry &&
        typeof entry.post === 'object' &&
        entry.post !== null &&
        typeof entry.post.id === 'string' &&
        Array.isArray(entry.comments)
    );
  } catch {
    return [];
  }
}

function writeThreads(threads: CommunityThread[]) {
  mkdirSync(dirname(COMMUNITY_FILE), { recursive: true });
  writeFileSync(COMMUNITY_FILE, JSON.stringify(threads, null, 2), 'utf8');
}

function ensureThread(threads: CommunityThread[], postId: string) {
  let thread = threads.find((entry) => entry.post.id === postId);
  if (thread) return thread;

  const listing = readScrapedListings({ includeStale: false }).find(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      String((entry as { externalId?: unknown }).externalId) === postId &&
      (entry as { verificationStatus?: string }).verificationStatus === 'verified'
  ) as Record<string, unknown> | undefined;
  if (!listing) return null;

  const clusterId = String(listing.clusterId || UNASSIGNED_CLUSTER_ID);
  const cluster = clusters.find((item) => item.id === clusterId);
  const price =
    typeof listing.price === 'number' ? `${listing.price.toLocaleString('vi-VN')}đ/tháng` : '';
  const area = typeof listing.area === 'number' ? `${listing.area}m²` : '';
  const post: RoomPost = {
    id: postId,
    title: String(listing.title ?? ''),
    summary: String(listing.summary ?? ''),
    price,
    area,
    distance: '',
    clusterId,
    clusterName: cluster?.name ?? 'Đà Nẵng',
    source: 'Website',
    trust: Number(listing.trustScore ?? 20),
    comments: 0,
    updated: 'mới cập nhật',
    status: 'Còn phòng',
    tags: [],
    image: '🏠',
    sourceUrl: typeof listing.sourceUrl === 'string' ? listing.sourceUrl : undefined
  };
  thread = { post, comments: [] };
  threads.push(thread);
  return thread;
}

export function listCommunityPosts(includePending = false) {
  const listingIds = new Set(
    readScrapedListings({ includeStale: true })
      .filter(
        (value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
      )
      .map((value) => String(value.externalId))
  );
  return readThreads()
    .filter(
      ({ post }) =>
        !post.price && !listingIds.has(post.id) && (includePending || post.status === 'Còn phòng')
    )
    .map(({ post, comments }) => ({ ...post, comments: comments.length }));
}

export function getCommunityCommentCounts(postIds: string[]) {
  const wanted = new Set(postIds);
  const counts: Record<string, number> = {};
  for (const thread of readThreads()) {
    if (wanted.has(thread.post.id)) counts[thread.post.id] = thread.comments.length;
  }
  return counts;
}

export function createCommunityPost(post: RoomPost) {
  const threads = readThreads();
  const existing = threads.find((thread) => thread.post.id === post.id);
  if (!existing) threads.unshift({ post: { ...post, comments: 0 }, comments: [] });
  writeThreads(threads.slice(0, 200));
  return existing ? existing.post : post;
}

export function listCommunityComments(postId: string) {
  const threads = readThreads();
  return ensureThread(threads, postId)?.comments ?? [];
}

export function createCommunityComment(postId: string, comment: CommunityComment) {
  const threads = readThreads();
  const thread = ensureThread(threads, postId);
  if (!thread) return null;
  thread.comments.push(comment);
  thread.post.comments = thread.comments.length;
  writeThreads(threads);
  return thread.comments;
}
