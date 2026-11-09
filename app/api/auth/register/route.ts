import { NextResponse } from 'next/server';
import { createUser, hasUserDatabase } from '@/lib/user-db';
import { applyUserSessionCookie, createUserToken } from '@/lib/user-auth';
import { apiError } from '@/lib/api-response';
import { isValidEmail, isValidPassword } from '@/js/domain-policies.js';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown; role?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role === 'landlord' ? 'landlord' : 'student';
    if (!hasUserDatabase()) return apiError('User database is not configured.', 503, 'DATABASE_UNAVAILABLE');
    if (name.length < 2 || !isValidEmail(email) || !isValidPassword(password)) return apiError('Thông tin tài khoản không hợp lệ.', 400, 'INVALID_INPUT');
    const user = await createUser({ name, email, password, role });
    return applyUserSessionCookie(NextResponse.json({ data: user }, { status: 201 }), createUserToken(user));
  } catch (error) {
    const message = String(error).includes('Duplicate') ? 'Email đã được sử dụng.' : 'Không thể tạo tài khoản.';
    return apiError(message, 400, String(error).includes('Duplicate') ? 'DUPLICATE_USER' : 'REGISTER_FAILED');
  }
}
