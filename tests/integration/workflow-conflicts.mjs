// Synthetic accounts/content on an explicitly isolated local QA database only.
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Require TEST_ISOLATED_DB=1 and isolated localhost QA.");
let checks = 0;
const stamp = Date.now();
async function api(
  path,
  { cookie = "", method = "GET", body, status = 200 } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  assert.equal(
    r.status,
    status,
    method + " " + path + ": " + JSON.stringify(p),
  );
  checks++;
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
const owner = await api("/api/auth/register", {
  method: "POST",
  status: 201,
  body: {
    name: "[Kiểm thử] Xung đột " + stamp,
    email: "conflict-" + stamp + "@test.local",
    password: "ConflictTest123!",
    role: "landlord",
  },
});
const admin = await api("/api/auth/login", {
  method: "POST",
  body: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
});
async function verify(status) {
  return api("/api/admin/landlords", {
    cookie: admin.cookie,
    method: "PATCH",
    body: { id: owner.data.id, status },
  });
}
await verify("verified");
const draft = {
  title: "[Kiểm thử] Phòng xung đột " + stamp,
  summary:
    "Dữ liệu tổng hợp để kiểm tra luồng duyệt phòng và thay đổi chủ trọ.",
  address: "Hải Châu, Đà Nẵng",
  price: 2500000,
  area: 25,
};
const created = await api("/api/listings/create", {
  cookie: owner.cookie,
  method: "POST",
  body: draft,
  status: 201,
});
const id = created.data.externalId,
  path = "/api/landlord/listings/" + id;
const moderate = (status, reviewRevision) =>
  api("/api/listings/" + id + "/status", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      status,
      ...(reviewRevision === undefined ? {} : { reviewRevision }),
    },
  });
const state = async () => (await api(path, { cookie: owner.cookie })).data;
const action = async (action) =>
  api(path, {
    cookie: owner.cookie,
    method: "PATCH",
    body: { action, revision: (await state()).revision },
  });
await moderate("verified");
await action("hide");
await api("/api/listings/" + id + "/status", {
  cookie: admin.cookie,
  method: "POST",
  body: { status: "verified" },
  status: 409,
});
assert.equal((await state()).verificationStatus, "hidden");
checks++;
await action("resubmit");
await moderate("verified");
await action("rented");
await api("/api/listings/" + id + "/status", {
  cookie: admin.cookie,
  method: "POST",
  body: { status: "verified" },
  status: 409,
});
await action("resubmit");
await moderate("verified");
await verify("rejected");
await api("/api/listings/" + id, { status: 404 });
assert.equal((await state()).verificationStatus, "needs_review");
checks++;
await api("/api/listings/" + id + "/status", {
  cookie: admin.cookie,
  method: "POST",
  body: { status: "verified" },
  status: 403,
});
await api("/api/listings/create", {
  cookie: owner.cookie,
  method: "POST",
  body: draft,
  status: 403,
});
await verify("verified");
await api("/api/listings/" + id, { status: 404 });
const snapshot = async () => {
  const p = await api(
    "/api/listings?includePending=true&q=" + encodeURIComponent(draft.title),
    { cookie: admin.cookie },
  );
  const row = p.data.find((v) => v.externalId === id);
  assert.match(row.reviewRevision, /^[a-f0-9]{64}$/);
  checks++;
  return row.reviewRevision;
};
const before = await snapshot();
await api(path, {
  cookie: owner.cookie,
  method: "PATCH",
  body: {
    ...draft,
    title: draft.title + " đã sửa",
    action: "edit",
    revision: (await state()).revision,
  },
});
await api("/api/listings/" + id + "/status", {
  cookie: admin.cookie,
  method: "POST",
  body: { status: "verified", reviewRevision: before },
  status: 409,
});
const current = await snapshot();
await moderate("verified", current);
const same = await snapshot();
const responses = await Promise.all(
  ["needs_review", "rejected"].map((status) =>
    fetch(base + "/api/listings/" + id + "/status", {
      method: "POST",
      headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewRevision: same }),
    }),
  ),
);
assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
checks++;
await api("/api/listings/" + id + "/status", {
  cookie: admin.cookie,
  method: "POST",
  body: { status: "verified", reviewRevision: "bad" },
  status: 400,
});
// Publish versus revoke: either operation may acquire the owner lock first.
// The final room must never remain public after revocation commits.
for (let i = 0; i < 3; i++) {
  await verify("verified");
  await verify("verified");
  const requests = await Promise.all([
    fetch(base + "/api/listings/" + id + "/status", {
      method: "POST",
      headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "verified" }),
    }),
    fetch(base + "/api/admin/landlords", {
      method: "PATCH",
      headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ id: owner.data.id, status: "rejected" }),
    }),
  ]);
  assert([200, 403].includes(requests[0].status));
  checks++;
  assert.equal(requests[1].status, 200);
  checks++;
  await api("/api/listings/" + id, { status: 404 });
  assert.notEqual((await state()).verificationStatus, "verified");
  checks++;
}
console.log(
  `PASS: ${checks} workflow checks: hidden/rented gates, revoked landlord withdrawal, re-verification requires moderation, stale review snapshots and concurrent Admin decisions.`,
);
