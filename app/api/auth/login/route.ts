import { createAdminToken, isValidAdminCredentials } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { apiError, apiData } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const address = request.headers.get("x-forwarded-for") ?? "unknown";
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || email.length > 254 || !password || password.length > 128)
      return apiError("Kiểm tra email và mật khẩu.", 400, "INVALID_INPUT");
    const limit = rateLimit(
      `admin-login:${address}:${email}`,
      10,
      15 * 60 * 1000,
    );
    if (!limit.allowed)
      return apiError(
        "Đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
        429,
        "RATE_LIMITED",
      );
    if (!isValidAdminCredentials(email, password))
      return apiError(
        "Email hoặc mật khẩu không đúng.",
        401,
        "INVALID_CREDENTIALS",
      );
    const response = apiData({ email, role: "admin" });
    response.cookies.set("room-danang-admin-session", createAdminToken(email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    return apiError("Yêu cầu đăng nhập không hợp lệ.", 400, "INVALID_REQUEST");
  }
}
