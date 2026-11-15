import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export const COMMUNITY_REACTIONS = ['like', 'love', 'funny', 'wow', 'sad', 'fire'] as const;
export type CommunityReaction = typeof COMMUNITY_REACTIONS[number];
type ReactionStore = Record<string, Record<string, CommunityReaction>>;

const INTERACTIONS_FILE = join(process.cwd(), 'data', 'community-interactions.json');

function readStore(): ReactionStore {
  if (!existsSync(INTERACTIONS_FILE)) return {};
  try {
    const value = JSON.parse(readFileSync(INTERACTIONS_FILE, 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ReactionStore : {};
  } catch {
    return {};
  }
}

function writeStore(store: ReactionStore) {
  mkdirSync(dirname(INTERACTIONS_FILE), { recursive: true });
  const temporary = `${INTERACTIONS_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  renameSync(temporary, INTERACTIONS_FILE);
}

export function getCommunityInteractions(postId: string, actorId?: string) {
  const reactions = readStore()[postId] ?? {};
  const counts = Object.fromEntries(COMMUNITY_REACTIONS.map((reaction) => [
    reaction,
    Object.values(reactions).filter((value) => value === reaction).length
  ])) as Record<CommunityReaction, number>;
  return {
    counts,
    total: Object.keys(reactions).length,
    viewerReaction: actorId ? reactions[actorId] ?? null : null
  };
}

export function getCommunityInteractionTotals(postIds: string[]) {
  const store = readStore();
  const totals: Record<string, number> = {};
  for (const postId of postIds) totals[postId] = Object.keys(store[postId] ?? {}).length;
  return totals;
}

export function setCommunityInteraction(postId: string, actorId: string, reaction: CommunityReaction | null) {
  const store = readStore();
  const reactions = store[postId] ?? {};
  if (reaction) reactions[actorId] = reaction;
  else delete reactions[actorId];
  if (Object.keys(reactions).length) store[postId] = reactions;
  else delete store[postId];
  writeStore(store);
  return getCommunityInteractions(postId, actorId);
}
