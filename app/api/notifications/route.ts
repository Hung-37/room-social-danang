import { NextResponse } from 'next/server';
import { listUserNotifications, markUserNotificationsRead } from '@/lib/community-db';
import { hasUserDatabase } from '@/lib/user-db';
import { getUserSessionFromRequest } from '@/lib/user-auth';

export async function GET(request: Request) {
  const user = getUserSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasUserDatabase()) return NextResponse.json({ data: [] });
  try { return NextResponse.json({ data: await listUserNotifications(user.id) }); }
  catch { return NextResponse.json({ error: 'Không tải được thông báo.' }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const user = getUserSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (hasUserDatabase()) await markUserNotificationsRead(user.id).catch(() => undefined);
  return NextResponse.json({ success: true });
}
