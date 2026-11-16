import { getSiteSettings } from "@/lib/server/site-settings";
import { NextResponse } from "next/server";
import { createUser, hasUserDatabase } from "@/lib/server/user-db";
import { applyUserSessionCookie, createUserToken } from "@/lib/server/user-auth";
import { isValidEmail, isValidPassword } from "@/lib/policies/domain-policies.js";
import { randomUUID } from "node:crypto";
import { classifyRegisterError, createRegistrationSession, missingRegisterConfiguration, registerErrorLog } from "@/lib/server/register-diagnostics.js";

function logRegisterError(id: string, error: unknown, code: string) {
  console.error(JSON.stringify(registerErrorLog({ requestId: id, error, code })));
}

export async function POST(request: Request) {
  let accountCreated = false;
  const id = randomUUID();
  const headers = { "X-Request-Id": id };
  const missing = missingRegisterConfiguration();
  if (missing.length) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), route: "/api/auth/register", code: "SERVER_MISCONFIGURED", missing, requestId: id }));
    return Response.json({ error: "Hệ thống chưa được cấu hình đầy đủ.", code: "SERVER_MISCONFIGURED", requestId: id }, { status: 500, headers });
  }
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object")
    return Response.json({ error: "JSON đăng ký không hợp lệ.", code: "INVALID_REQUEST", requestId: id }, { status: 400, headers });
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
    if (!hasUserDatabase()) {
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), route: "/api/auth/register", code: "SERVER_MISCONFIGURED", missing: ["MYSQL_URL"], requestId: id }));
      return Response.json({ error: "Hệ thống chưa được cấu hình đầy đủ.", code: "SERVER_MISCONFIGURED", requestId: id }, { status: 500, headers });
    }
    if (
      name.length < 2 ||
      name.length > 80 ||
      email.length > 254 ||
      !isValidEmail(email) ||
      !isValidPassword(password)
    )
      return Response.json({ error: "Thông tin tài khoản không hợp lệ.", code: "INVALID_INPUT", requestId: id }, { status: 400, headers });
    if (!(await getSiteSettings()).settings.registrationEnabled)
      return Response.json({ error: "Website đang tạm dừng đăng ký mới.", code: "REGISTRATION_DISABLED", requestId: id }, { status: 403, headers });
    const registration = await createRegistrationSession({ input: { name, email, password, role }, createUser, createToken: createUserToken });
    accountCreated = true;
    if (!registration.sessionCreated) {
      logRegisterError(id, new Error("Session creation failed after user insert"), "SESSION_CREATION_FAILED_AFTER_REGISTER");
      return Response.json({ error: "Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục.", code: "ACCOUNT_CREATED_LOGIN_REQUIRED", requestId: id }, { status: 201, headers });
    }
    return applyUserSessionCookie(
      NextResponse.json({ data: registration.user }, { status: 201, headers }),
      registration.token,
    );
  } catch (error) {
    if (accountCreated) {
      logRegisterError(id, error, "SESSION_CREATION_FAILED_AFTER_REGISTER");
      return Response.json({ error: "Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục.", code: "ACCOUNT_CREATED_LOGIN_REQUIRED", requestId: id }, { status: 201, headers });
    }
    const failure = classifyRegisterError(error);
    logRegisterError(id, error, failure.code);
    return Response.json({ error: failure.message, code: failure.code, requestId: id }, { status: failure.status, headers });
  }
}
