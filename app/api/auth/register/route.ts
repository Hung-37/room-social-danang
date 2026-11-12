import { getSiteSettings } from "@/lib/site-settings";
import { NextResponse } from "next/server";
import { createUser, hasUserDatabase } from "@/lib/user-db";
import { applyUserSessionCookie, createUserToken } from "@/lib/user-auth";
import { apiError } from "@/lib/api-response";
import { isValidEmail, isValidPassword } from "@/lib/policies/domain-policies.js";

export async function POST(request: Request) {
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object")
    return apiError("JSON đăng ký không hợp lệ.", 400, "INVALID_REQUEST");
  try {
    const body = parsed as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "landlord" ? "landlord" : "student";
    if (!hasUserDatabase())
      return apiError(
        "User database is not configured.",
        503,
        "DATABASE_UNAVAILABLE",
      );
    if (
      name.length < 2 ||
      name.length > 80 ||
      email.length > 254 ||
      !isValidEmail(email) ||
      !isValidPassword(password)
    )
      return apiError(
        "Thông tin tài khoản không hợp lệ.",
        400,
        "INVALID_INPUT",
      );
    if (!(await getSiteSettings()).settings.registrationEnabled)
      return apiError("Website đang tạm dừng đăng ký mới.", 403);
    const user = await createUser({ name, email, password, role });
    return applyUserSessionCookie(
      NextResponse.json({ data: user }, { status: 201 }),
      createUserToken(user),
    );
  } catch (error) {
    const message = String(error).includes("Duplicate")
      ? "Email đã được sử dụng."
      : "Không thể tạo tài khoản.";
    return apiError(
      message,
      String(error).includes("Duplicate") ? 400 : 503,
      String(error).includes("Duplicate")
        ? "DUPLICATE_USER"
        : "DATABASE_UNAVAILABLE",
    );
  }
}
