import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDatabasePool as getPool } from '@/lib/mysql-pool';
export { hasDatabaseConfig as hasUserDatabase } from '@/lib/mysql-pool';
import type { User } from '@/lib/types';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.externalId),
    name: String(row.name),
    email: String(row.email),
    role: row.role === 'landlord' || row.role === 'admin' ? row.role : 'student'
  };
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'landlord';
}) {
  const externalId = `user-${Date.now()}-${randomBytes(4).toString('hex')}`;
  await getPool().execute(
    `INSERT INTO users (external_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [externalId, input.name, input.email.toLowerCase(), hashPassword(input.password), input.role]
  );
  return {
    id: externalId,
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role
  } satisfies User;
}

export async function authenticateUser(email: string, password: string) {
  const [rows] = await getPool().query(
    `SELECT external_id AS externalId, name, email, password_hash AS passwordHash, role FROM users WHERE email = ? AND NOT EXISTS(SELECT 1 FROM user_controls c WHERE c.user_id=users.external_id AND c.blocked=1) LIMIT 1`,
    [email.toLowerCase()]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row || typeof row.passwordHash !== 'string' || !verifyPassword(password, row.passwordHash))
    return null;
  return mapUser(row);
}
