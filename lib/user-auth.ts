import { apiError } from "@/lib/api-response";
import { getDatabasePool } from "@/lib/mysql-pool";
import type { RowDataPacket } from "mysql2/promise";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";

export const USER_SESSION_COOKIE = "room-danang-user-session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
type UserSession = User & { exp: number };

function getSecret() {
  return (
    process.env.USER_SESSION_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "room-danang-development-user-secret")
  );
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createUserToken(user: User) {
  if (!getSecret()) throw new Error("USER_SESSION_SECRET is not configured.");
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUserToken(token: string | undefined): User | null {
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
    ) as UserSession;
    return typeof session.exp === "number" &&
      Number.isFinite(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000) &&
      typeof session.name === "string" &&
      ["student", "landlord", "admin"].includes(session.role) &&
      typeof session.id === "string" &&
      typeof session.email === "string"
      ? {
          id: session.id,
          name: session.name,
          email: session.email,
          role: session.role,
        }
      : null;
  } catch {
    return null;
  }
}

export async function resolveRequestUser(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${USER_SESSION_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  try {
    return { user: await activeUser(verifyUserToken(token)), error: null };
  } catch {
    return {
      user: null,
      error: apiError(
        "Tạm thời chưa kết nối được dữ liệu tài khoản. Vui lòng thử lại.",
        503,
        "DATABASE_UNAVAILABLE",
      ),
    };
  }
}

export async function getUserSession() {
  const cookieStore = await cookies();
  return activeUser(
    verifyUserToken(cookieStore.get(USER_SESSION_COOKIE)?.value),
  );
}

export function applyUserSessionCookie(response: Response, token: string) {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${USER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function activeUser(user: User | null): Promise<User | null> {
  if (!user) return null;
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    "SELECT u.external_id AS id,u.name,u.email,u.role FROM users u LEFT JOIN user_controls c ON c.user_id=u.external_id WHERE u.external_id=? AND COALESCE(c.blocked,0)=0",
    [user.id],
  );
  return rows[0]
    ? {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        role: rows[0].role,
      }
    : null;
}
