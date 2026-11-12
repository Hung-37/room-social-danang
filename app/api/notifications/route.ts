import { NextResponse } from "next/server";
import {
  listUserNotifications,
  markUserNotificationsRead,
  unreadNotificationCount,
} from "@/lib/community-db";
import { hasUserDatabase } from "@/lib/user-db";
import { resolveRequestUser } from "@/lib/user-auth";

export async function GET(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!hasUserDatabase()) return NextResponse.json({ data: [] });
  try {
    const [data, unreadCount] = await Promise.all([
      listUserNotifications(user.id),
      unreadNotificationCount(user.id),
    ]);
    return NextResponse.json(
      { data, meta: { unreadCount } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không tải được thông báo." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    if (hasUserDatabase()) await markUserNotificationsRead(user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Chưa thể cập nhật thông báo." },
      { status: 503 },
    );
  }
}
