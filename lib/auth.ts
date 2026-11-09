/**
 * Client-side identity mirror for UI state. Server APIs authenticate with the
 * HttpOnly user session cookie from lib/user-auth.ts.
 */

import type { User } from '@/lib/types';
export type { User } from '@/lib/types';

const AUTH_KEY = 'room-danang-auth';
const USER_KEY = 'room-danang-user';

export type UserStats = {
  postsCreated: number;
  commentsMade: number;
  helpfulVotes: number;
  reportsSubmitted: number;
};

const DEFAULT_USER_STATS: UserStats = {
  postsCreated: 0,
  commentsMade: 0,
  helpfulVotes: 0,
  reportsSubmitted: 0
};

function userStatsKey(userId: string) {
  return `room-danang-user-stats-${userId}`;
}

export function getUserStats(userId: string): UserStats {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_STATS };
  try {
    const stored = JSON.parse(localStorage.getItem(userStatsKey(userId)) ?? '{}') as Partial<UserStats>;
    return Object.fromEntries(
      Object.keys(DEFAULT_USER_STATS).map((key) => [key, Math.max(0, Number(stored[key as keyof UserStats]) || 0)])
    ) as UserStats;
  } catch {
    return { ...DEFAULT_USER_STATS };
  }
}

export function updateUserStats(userId: string, updates: Partial<UserStats>): UserStats {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_STATS };
  const next = { ...getUserStats(userId), ...updates };
  const normalized = Object.fromEntries(
    Object.keys(DEFAULT_USER_STATS).map((key) => [key, Math.max(0, Number(next[key as keyof UserStats]) || 0)])
  ) as UserStats;
  localStorage.setItem(userStatsKey(userId), JSON.stringify(normalized));
  return normalized;
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function login(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, 'true');
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function register(user: Omit<User, 'id'>): User {
  const newUser: User = {
    ...user,
    id: `user-${Date.now()}`
  };
  login(newUser);
  return newUser;
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

export function requireAdmin(): boolean {
  if (!isLoggedIn()) return false;
  return isAdmin();
}
