import { NextResponse } from "next/server";
import { authenticateUser, hasUserDatabase } from "@/lib/user-db";
import { applyUserSessionCookie, createUserToken } from "@/lib/user-auth";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return apiError("JSON đăng nhập không hợp lệ.", 400, "INVALID_REQUEST");
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !password || password.length > 128)
    return apiError("Kiểm tra email và mật khẩu.", 400, "INVALID_INPUT");
  const address = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`user-login:${address}:${email}`, 10, 15 * 60 * 1000).allowed)
    return apiError(
      "Đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
      429,
      "RATE_LIMITED",
    );
  if (!hasUserDatabase())
    return apiError("Chưa cấu hình database.", 503, "DATABASE_UNAVAILABLE");
  try {
    const user = await authenticateUser(email, password);
    return user
      ? applyUserSessionCookie(
          NextResponse.json({ data: user }),
          createUserToken(user),
        )
      : apiError("Email hoặc mật khẩu không đúng.", 401, "INVALID_CREDENTIALS");
  } catch {
    return apiError(
      "Chưa thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  }
}
