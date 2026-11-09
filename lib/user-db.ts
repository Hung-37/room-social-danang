import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import mysql, { type Pool } from 'mysql2/promise';
import type { User } from '@/lib/auth';

let pool: Pool | undefined;
function getPool() {
  if (!process.env.MYSQL_URL?.trim()) throw new Error('MYSQL_URL is not configured.');
  pool ??= mysql.createPool({ uri: process.env.MYSQL_URL, connectionLimit: 5 });
  return pool;
}
export function hasUserDatabase() { return Boolean(process.env.MYSQL_URL?.trim()); }

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
  return { id: String(row.externalId), name: String(row.name), email: String(row.email), role: row.role === 'landlord' || row.role === 'admin' ? row.role : 'student' };
}

export async function createUser(input: { name: string; email: string; password: string; role: 'student' | 'landlord' }) {
  const externalId = `user-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const result = await getPool().execute(
    `INSERT INTO users (external_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [externalId, input.name, input.email.toLowerCase(), hashPassword(input.password), input.role]
  );
  return { id: externalId, name: input.name, email: input.email.toLowerCase(), role: input.role } satisfies User;
}

export async function authenticateUser(email: string, password: string) {
  const [rows] = await getPool().query(`SELECT external_id AS externalId, name, email, password_hash AS passwordHash, role FROM users WHERE email = ? LIMIT 1`, [email.toLowerCase()]);
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row || typeof row.passwordHash !== 'string' || !verifyPassword(password, row.passwordHash)) return null;
  return mapUser(row);
}
