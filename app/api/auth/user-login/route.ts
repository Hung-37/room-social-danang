import { NextResponse } from 'next/server';
import { authenticateUser, hasUserDatabase } from '@/lib/user-db';
import { applyUserSessionCookie, createUserToken } from '@/lib/user-auth';
import { apiError } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!hasUserDatabase()) return apiError('User database is not configured.', 503, 'DATABASE_UNAVAILABLE');
    const user = await authenticateUser(email, password);
    return user ? applyUserSessionCookie(NextResponse.json({ data: user }), createUserToken(user)) : apiError('Email hoặc mật khẩu không đúng.', 401, 'INVALID_CREDENTIALS');
  } catch {
    return apiError('Không thể đăng nhập.', 400, 'LOGIN_FAILED');
  }
}
