// Creates synthetic accounts/posts. Isolated database and failure server only.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL,
  broken = process.env.TEST_FAILURE_BASE_URL;
if (
  !base ||
  !broken ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set TEST_BASE_URL, TEST_FAILURE_BASE_URL and TEST_ADMIN_EMAIL/PASSWORD for isolated servers.",
  );
let checks = 0;
async function api(
  path,
  {
    url = base,
    status = 200,
    method = "GET",
    body,
    cookie = "",
    address = "v13-audit",
  } = {},
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": address,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  assert.equal(r.status, status, path + ": " + JSON.stringify(p));
  checks++;
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
const credentials = {
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD,
};
const admin = await api("/api/auth/login", {
  method: "POST",
  body: credentials,
});
for (const path of ["/api/listings", "/api/community/posts"]) {
  const normal = await api(path + "?limit=20&offset=0");
  for (const invalid of ["1.5", "Infinity", "NaN", "1e99", "-1"]) {
    const response = await api(
      path + "?limit=" + invalid + "&offset=" + invalid,
    );
    assert.deepEqual(response.data, normal.data);
    checks++;
  }
}
const stamp = Date.now(),
  email = `regression-${stamp}@test.local`;
const user = await api("/api/auth/register", {
  method: "POST",
  status: 201,
  body: { name: "Kiểm thử lỗi V13", email, password: "StrongTest123!" },
});
await api("/api/auth/register", {
  method: "POST",
  status: 400,
  body: {
    name: "x".repeat(81),
    email: `long-${stamp}@test.local`,
    password: "StrongTest123!",
  },
});
await api("/api/auth/register", {
  method: "POST",
  status: 400,
  body: { name: "Kiểm thử trùng", email, password: "StrongTest123!" },
});
for (const path of [
  "/api/auth/user-login",
  "/api/auth/register",
  "/api/auth/login",
])
  await api(path, { method: "POST", status: 400, body: null });
await api("/api/community/posts", {
  method: "POST",
  cookie: user.cookie,
  status: 400,
  body: {
    title: "Thảo luận thử khu vực",
    summary: "Dữ liệu tổng hợp để kiểm thử, không phải lời đánh giá thật.",
    clusterId: "not-a-real-cluster",
  },
});
const created = await api("/api/community/posts", {
  method: "POST",
  cookie: user.cookie,
  status: 201,
  body: {
    title: "Thảo luận thử khu vực",
    summary: "Dữ liệu tổng hợp để kiểm thử, không phải lời đánh giá thật.",
    clusterId: "son-tra",
  },
});
assert.equal(created.data.clusterId, "son-tra");
checks++;
await api("/api/community/posts/" + created.data.id, { status: 404 });
const invalid = await fetch(base + "/api/collector/run", {
  method: "POST",
  headers: {
    cookie: admin.cookie,
    "Content-Type": "application/json",
    "x-forwarded-for": "v13-invalid-collector",
  },
  body: "{invalid-json",
});
assert.equal(invalid.status, 400);
checks++;
for (let i = 0; i < 12; i++)
  await api("/api/auth/login", {
    method: "POST",
    status: 401,
    address: "v13-shared-login-ip",
    body: { email: `unrelated-${i}@test.local`, password: "invalid-password" },
  });
await api("/api/auth/login", {
  method: "POST",
  address: "v13-shared-login-ip",
  body: credentials,
});
for (let i = 0; i < 11; i++)
  await api("/api/auth/user-login", {
    method: "POST",
    status: i < 10 ? 401 : 429,
    address: "v13-user-rate",
    body: { email: "rate-only@test.local", password: "incorrect-password" },
  });
const failedAdmin = await api("/api/auth/login", {
  url: broken,
  method: "POST",
  body: credentials,
});
for (const path of [
  "/api/community/posts",
  "/api/listings",
  "/api/admin/stats",
  "/api/collector/status",
  "/api/collector/check",
])
  await api(path, { url: broken, cookie: failedAdmin.cookie, status: 503 });
for (const path of ["/api/auth/user-login", "/api/auth/register"])
  await api(path, {
    url: broken,
    method: "POST",
    body: {
      name: "Kiểm thử lỗi DB",
      email: `failure-${stamp}@test.local`,
      password: "StrongTest123!",
    },
    status: 503,
  });
if (process.env.TEST_ERROR_FIXTURES)
  await writeFile(
    process.env.TEST_ERROR_FIXTURES,
    JSON.stringify(
      { admin: admin.cookie, user: user.cookie, email, base },
      null,
      2,
    ),
    { mode: 0o600 },
  );
console.log(
  `PASS: ${checks} V13 regressions: safe pagination, invalid cluster rejection, pending privacy, JSON validation, separate login quotas, user rate limit, database failures return 503 without stale cache or fake zero statistics.`,
);
