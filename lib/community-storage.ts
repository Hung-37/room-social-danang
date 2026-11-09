import type { RoomPost } from '@/lib/data';
import { decodeHtmlText } from '@/lib/html-text';

export type CommunityComment = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

const POSTS_KEY = 'room-danang-community-posts';
const COMMENTS_PREFIX = 'room-danang-community-comments:';

export function getCommunityPosts(): RoomPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(POSTS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((post): post is RoomPost => (
      post !== null
      && typeof post === 'object'
      && typeof (post as RoomPost).id === 'string'
      && typeof (post as RoomPost).title === 'string'
      && typeof (post as RoomPost).summary === 'string'
    )).map((post) => ({
      ...post,
      title: decodeHtmlText(post.title),
      summary: decodeHtmlText(post.summary),
      address: post.address ? decodeHtmlText(post.address) : undefined,
      tags: Array.isArray(post.tags) ? post.tags.map(decodeHtmlText) : []
    }));
  } catch {
    return [];
  }
}

export function saveCommunityPost(post: RoomPost) {
  const posts = getCommunityPosts().filter((item) => item.id !== post.id);
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify([post, ...posts].slice(0, 100)));
  } catch {
    return false;
  }
  return true;
}

export function saveCommunityPosts(posts: RoomPost[]) {
  if (typeof window === 'undefined') return false;
  const uniquePosts = new Map<string, RoomPost>();
  for (const post of posts) {
    if (post && typeof post.id === 'string') uniquePosts.set(post.id, post);
  }
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify([...uniquePosts.values()].slice(0, 100)));
  } catch {
    return false;
  }
  return true;
}

export function getCommunityComments(postId: string): CommunityComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(`${COMMENTS_PREFIX}${postId}`) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((comment): comment is CommunityComment => (
      comment !== null
      && typeof comment === 'object'
      && typeof (comment as CommunityComment).id === 'string'
      && typeof (comment as CommunityComment).text === 'string'
    ));
  } catch {
    return [];
  }
}

export function addCommunityComment(postId: string, comment: CommunityComment) {
  const comments = getCommunityComments(postId);
  const updatedComments = [...comments, comment].slice(-100);
  try {
    localStorage.setItem(`${COMMENTS_PREFIX}${postId}`, JSON.stringify(updatedComments));
  } catch {
    return false;
  }

  const posts = getCommunityPosts();
  const post = posts.find((item) => item.id === postId);
  if (post) saveCommunityPost({ ...post, comments: updatedComments.length });
  return true;
}
