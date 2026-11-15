import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "room-danang-admin-session";
const SESSION_MAX_AGE = 8 * 60 * 60;
const DEVELOPMENT_ADMIN = {
  email: "admin@roomdanang.com",
  password: "admin123",
  name: "System Admin",
};

type AdminSession = { email: string; name: string; role: "admin"; exp: number };

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "room-danang-development-secret")
  );
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function isValidAdminCredentials(email: string, password: string) {
  const expectedEmail =
    process.env.ADMIN_EMAIL ||
    (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_ADMIN.email);
  const expectedPassword =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_ADMIN.password);
  return Boolean(
    getSecret() &&
    expectedEmail &&
    expectedPassword &&
    email === expectedEmail &&
    password === expectedPassword,
  );
}

export function createAdminToken(email: string) {
  if (!getSecret()) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  const payload: AdminSession = {
    email,
    name:
      process.env.ADMIN_NAME ||
      (process.env.NODE_ENV === "production"
        ? "Administrator"
        : DEVELOPMENT_ADMIN.name),
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(
  token: string | undefined,
): AdminSession | null {
  if (!token || !getSecret()) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  )
    return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
    return session.role === "admin" &&
      typeof session.email === "string" &&
      typeof session.name === "string" &&
      typeof session.exp === "number" &&
      Number.isFinite(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000)
      ? session
      : null;
  } catch {
    return null;
  }
}

export function getAdminSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  return verifyAdminToken(token);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function applyAdminSessionCookie(response: Response, token: string) {
  const headers = new Headers(response.headers);
  const cookie = `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
