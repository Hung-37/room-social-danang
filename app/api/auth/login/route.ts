import { NextResponse } from 'next/server';
import { createAdminToken, isValidAdminCredentials } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, apiData } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const address = request.headers.get('x-forwarded-for') ?? 'unknown';
    const limit = rateLimit(`admin-login:${address}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return apiError('Too many login attempts. Try again later.', 429, 'RATE_LIMITED');
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!isValidAdminCredentials(email, password)) return apiError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    const response = apiData({ email, role: 'admin' });
    response.cookies.set('room-danang-admin-session', createAdminToken(email), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 8 * 60 * 60
    });
    return response;
  } catch {
    return apiError('Invalid request.', 400, 'INVALID_REQUEST');
  }
}
