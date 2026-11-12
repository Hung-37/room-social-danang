import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
// Creates synthetic accounts: use isolated localhost test servers only.
const base = process.env.TEST_BASE_URL,
  broken = process.env.TEST_FAILURE_BASE_URL;
if (
  !base ||
  !broken ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD ||
  ![base, broken].every((url) =>
    ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  )
)
  throw new Error(
    "Set isolated localhost TEST_BASE_URL/TEST_FAILURE_BASE_URL and TEST_ADMIN_EMAIL/PASSWORD.",
  );
let checks = 0;
async function req(
  path,
  { url = base, method = "GET", cookie = "", body, status = 200 } = {},
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "session-qa-" + Date.now(),
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  assert.equal(r.status, status, path + JSON.stringify(p));
  checks++;
  return {
    p,
    cookie: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
    r,
  };
}
const a = await req("/api/auth/login", {
  method: "POST",
  body: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
});
await req("/api/admin/users", { cookie: a.cookie + ".extra", status: 401 });
await req("/api/auth/me", { cookie: a.cookie + ".extra", status: 401 });
for (const p of [
  "/api/files",
  "/api/files/list",
  "/api/files/package/content",
  "/api/files/cached-listings/toggle",
  "/api/files/create",
])
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    await req(p, { method, status: 401 });
    const r = await req(p, { method, cookie: a.cookie, status: 410 });
    assert.equal(r.p.code, "FEATURE_RETIRED");
    checks++;
  }
const u = await req("/api/auth/register", {
  method: "POST",
  status: 201,
  body: {
    name: "Kiểm thử phiên server",
    email: `session-${Date.now()}@test.local`,
    password: "SessionTest123!",
    role: "student",
  },
});
for (const path of [
  "/api/auth/me",
  "/api/profile",
  "/api/favorites",
  "/api/notifications",
  "/api/chat",
  "/api/appointments",
]) {
  await req(path, { status: 401 });
  await req(path, { url: broken, status: 401 });
  await req(path, { cookie: u.cookie });
  const f = await req(path, { url: broken, cookie: u.cookie, status: 503 });
  assert.equal(f.p.code, "DATABASE_UNAVAILABLE");
  checks++;
  assert.equal(f.r.headers.get("set-cookie"), null);
  checks++;
  await req(path, { cookie: u.cookie + ".extra", status: 401 });
}
if (process.env.TEST_SESSION_FIXTURES)
  await writeFile(
    process.env.TEST_SESSION_FIXTURES,
    JSON.stringify({ cookie: u.cookie, user: u.p.data }),
    { mode: 0o600 },
  );
console.log(
  `PASS: ${checks} checks; retired file endpoints, authoritative sessions, invalid token suffix and DB 503 without clearing cookies.`,
);
