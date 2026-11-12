// Creates synthetic accounts and rooms; isolated localhost QA only.
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
if (
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set localhost TEST_BASE_URL and TEST_ADMIN_EMAIL/PASSWORD for an isolated database.",
  );
let checks = 0;
const stamp = Date.now();
async function api(
  path,
  { method = "GET", body, cookie = "", status = 200 } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "mutation-api-" + stamp,
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(response.status, status, path + ": " + JSON.stringify(payload));
  checks++;
  return {
    ...payload,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}
const admin = await api("/api/auth/login", {
  method: "POST",
  body: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
});
const owner = await api("/api/auth/register", {
  method: "POST",
  status: 201,
  body: {
    name: "[Kiểm thử] Mutation chủ trọ",
    email: `mut-owner-${stamp}@test.local`,
    password: "MutationTest123!",
    role: "landlord",
  },
});
await api("/api/admin/landlords", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { id: owner.data.id, status: "verified" },
});
const draft = {
  title: "[Kiểm thử] Mutation dữ liệu phòng " + stamp,
  summary:
    "Dữ liệu tổng hợp kiểm tra kiểu giá và diện tích. Không phải tin cho thuê thật.",
  address: "Hải Châu, Đà Nẵng",
  price: "2500000",
  area: "25.5",
  clusterId: "hai-chau",
};
for (const field of ["price", "area"])
  for (const value of [[25], ["2500000"], [[25]], {}, true, null, "Infinity"])
    await api("/api/listings/create", {
      method: "POST",
      cookie: owner.cookie,
      status: 400,
      body: { ...draft, [field]: value },
    });
const before = (await api("/api/landlord", { cookie: owner.cookie })).data
  .listings;
assert.equal(before.length, 0);
checks++;
const created = await api("/api/listings/create", {
  method: "POST",
  cookie: owner.cookie,
  status: 201,
  body: draft,
});
assert.equal(created.data.area, 25.5);
assert.equal(created.data.price, 2500000);
checks += 2;
const id = created.data.externalId;
await api("/api/landlord/listings/" + id, {
  method: "PATCH",
  status: 401,
  body: { action: "hide" },
});
const other = await api("/api/auth/register", {
  method: "POST",
  status: 201,
  body: {
    name: "[Kiểm thử] Mutation tài khoản khác",
    email: `mut-other-${stamp}@test.local`,
    password: "MutationTest123!",
    role: "landlord",
  },
});
await api("/api/landlord/listings/" + id, {
  method: "PATCH",
  cookie: other.cookie,
  status: 404,
  body: { action: "hide", revision: "invalid" },
});
const original = (
  await api("/api/landlord/listings/" + id, { cookie: owner.cookie })
).data;
await api("/api/landlord/listings/" + id, {
  method: "PATCH",
  cookie: owner.cookie,
  status: 400,
  body: { ...draft, action: "edit", revision: original.revision, area: [25] },
});
const unchanged = (
  await api("/api/landlord/listings/" + id, { cookie: owner.cookie })
).data;
assert.equal(unchanged.revision, original.revision);
checks++;
await api("/api/landlord/listings/" + id, {
  method: "PATCH",
  cookie: owner.cookie,
  body: { action: "hide", revision: original.revision },
});
await api("/api/landlord/listings/" + id, {
  method: "PATCH",
  cookie: owner.cookie,
  status: 409,
  body: { action: "rented", revision: original.revision },
});
console.log(
  `PASS: ${checks} mutation API checks: malformed numbers rejected without writes, valid decimals preserved, ownership/session guards and stale edits rejected.`,
);
