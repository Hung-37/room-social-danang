import type { User } from '@/lib/auth';

export type Capability = 'community:post' | 'community:comment' | 'listing:create' | 'listing:moderate' | 'collector:run';

const capabilities: Record<User['role'], readonly Capability[]> = {
  student: ['community:post', 'community:comment'],
  landlord: ['community:post', 'community:comment', 'listing:create'],
  admin: ['community:post', 'community:comment', 'listing:create', 'listing:moderate', 'collector:run']
};

export function can(user: User | null | undefined, capability: Capability) {
  return Boolean(user && capabilities[user.role]?.includes(capability));
}

export function roleLabel(role: User['role']) {
  return role === 'landlord' ? 'Chủ trọ' : role === 'admin' ? 'Quản trị viên' : 'Sinh viên';
}
