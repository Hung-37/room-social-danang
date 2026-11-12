// Synthetic data on isolated localhost QA only; verifies all 201 records remain reachable.
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL,
  uri = process.env.MYSQL_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !uri ||
  !/(qa|test)/i.test(new URL(uri).pathname)
)
  throw new Error("Isolated localhost QA required.");
let checks = 0;
function equal(a, b) {
  assert.deepEqual(a, b);
  checks++;
}
async function api(
  path,
  { cookie = "", method = "GET", body, status = 200 } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  equal(r.status, status);
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
    cache: r.headers.get("cache-control"),
  };
}
const stamp = Date.now(),
  prefix = "[QA phân trang] " + stamp;
const register = (role) =>
  api("/api/auth/register", {
    method: "POST",
    status: 201,
    body: {
      name: prefix + " " + role,
      email: "page-" + role + "-" + stamp + "@test.local",
      password: "PaginationTest123!",
      role,
    },
  });
const owner = await register("landlord"),
  student = await register("student"),
  other = await api("/api/auth/register", {
    method: "POST",
    status: 201,
    body: {
      name: prefix + " khác",
      email: "page-other-" + stamp + "@test.local",
      password: "PaginationTest123!",
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
await api("/api/admin/landlords", {
  cookie: admin.cookie,
  method: "PATCH",
  body: { id: owner.data.id, status: "verified" },
});
const db = await mysql.createConnection(uri),
  roomIds = [],
  userIds = [owner.data.id];
try {
  await db.beginTransaction();
  const users = [],
    controls = [];
  for (let i = 0; i < 200; i++) {
    const id = "qa-page-user-" + stamp + "-" + i;
    userIds.push(id);
    users.push([
      id,
      prefix + (i < 21 ? " subset " : " mục ") + String(i).padStart(3, "0"),
      "qa-page-" + stamp + "-" + i + "@test.invalid",
      "qa-unusable-password-hash",
      "landlord",
    ]);
    controls.push([id, 1, 1, "Synthetic pagination fixture", "qa-pagination"]);
  }
  await db.query(
    "INSERT INTO users(external_id,name,email,password_hash,role) VALUES ?",
    [users],
  );
  await db.query(
    "INSERT INTO user_controls(user_id,blocked,is_demo,reason,updated_by) VALUES ?",
    [controls],
  );
  for (let i = 0; i < 201; i++) {
    const id = "qa-page-room-" + stamp + "-" + i;
    roomIds.push(id);
    await db.execute(
      "INSERT INTO listings(external_id,title,summary,price,area_m2,address,cluster_id,source_name,permission,owner_external_id,verification_status,updated_at) VALUES(?,?,?,2000000,20,'Hải Châu, Đà Nẵng','hai-chau','[QA] Tổng hợp','landlord_submission',?,?,TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP()))",
      [
        id,
        prefix + " phòng " + String(i).padStart(3, "0"),
        "Dữ liệu tổng hợp để kiểm tra giao diện và phân trang, không phải tin cho thuê thật.",
        owner.data.id,
        ["verified", "needs_review", "rejected", "hidden", "rented"][i % 5],
        -i,
      ],
    );
  }
  await db.commit();
  const adminUrl = "/api/admin/landlords?q=" + encodeURIComponent(prefix),
    ownUrl = "/api/landlord?q=" + encodeURIComponent(prefix);
  // The other owner has the same name prefix; isolate the 201-owner dataset by excluding it from the filter.
  await db.execute("UPDATE users SET name=? WHERE external_id=?", [
    "[QA] Chủ trọ khác " + stamp,
    other.data.id,
  ]);
  for (const [url, cookie, pluck, expected] of [
    [adminUrl, admin.cookie, (p) => p.data, userIds],
    [ownUrl, owner.cookie, (p) => p.data.listings, roomIds],
  ]) {
    const first = await api(url, { cookie });
    equal(first.meta.total, 201);
    equal(first.meta.limit, 20);
    equal(pluck(first).length, 20);
    equal(first.meta.hasMore, true);
    assert.match(first.cache, /private.*no-store/);
    checks++;
    const last = await api(url + "&offset=200", { cookie });
    equal(pluck(last).length, 1);
    equal(last.meta.total, 201);
    equal(last.meta.hasMore, false);
    const ids = [];
    for (let offset = 0; offset < 201; offset += 37) {
      const p = await api(url + "&limit=37&offset=" + offset, { cookie });
      ids.push(...pluck(p).map((v) => v.id ?? v.externalId));
    }
    equal(ids.length, 201);
    equal([...new Set(ids)].sort(), [...expected].sort());
    const bounded = await api(url + "&limit=100000&offset=-1", { cookie });
    equal(bounded.meta.limit, 100);
    equal(bounded.meta.offset, 0);
    const malformed = await api(url + "&limit=no&offset=2.5", { cookie });
    equal(malformed.meta.limit, 20);
    equal(malformed.meta.offset, 0);
    const empty = await api(url + "&offset=99999", { cookie });
    equal(pluck(empty), []);
    equal(empty.meta.total, 201);
    equal(empty.meta.hasMore, false);
  }
  equal(
    (await api(adminUrl + "&status=verified", { cookie: admin.cookie })).meta
      .total,
    1,
  );
  equal(
    (await api(adminUrl + "&status=pending", { cookie: admin.cookie })).meta
      .total,
    200,
  );
  equal(
    (
      await api(
        "/api/admin/landlords?q=" + encodeURIComponent(owner.data.email),
        { cookie: admin.cookie },
      )
    ).meta.total,
    1,
  );
  for (const [status, n] of [
    ["verified", 41],
    ["needs_review", 40],
    ["rejected", 40],
    ["hidden", 40],
    ["rented", 40],
  ])
    equal(
      (await api(ownUrl + "&status=" + status, { cookie: owner.cookie })).meta
        .total,
      n,
    );
  equal(
    (
      await api(
        "/api/landlord?q=" + encodeURIComponent(prefix + " phòng 200"),
        { cookie: owner.cookie },
      )
    ).meta.total,
    1,
  );
  equal(
    (
      await api(
        "/api/landlord?q=" +
          encodeURIComponent(prefix) +
          "&ownerExternalId=" +
          owner.data.id,
        { cookie: other.cookie },
      )
    ).meta.total,
    0,
  );
  await api("/api/admin/landlords", { status: 401 });
  await api("/api/admin/landlords", { cookie: student.cookie, status: 401 });
  await api("/api/landlord", { cookie: student.cookie, status: 403 });
  await api("/api/admin/landlords?status=admin", {
    cookie: admin.cookie,
    status: 400,
  });
  await api("/api/landlord?status=admin", {
    cookie: owner.cookie,
    status: 400,
  });
  equal(
    (
      await api("/api/admin/landlords?q=" + encodeURIComponent("' OR 1=1 --"), {
        cookie: admin.cookie,
      })
    ).meta.total,
    0,
  );
  if (process.env.TEST_PAGINATION_FIXTURES)
    await writeFile(
      process.env.TEST_PAGINATION_FIXTURES,
      JSON.stringify(
        {
          base,
          prefix,
          owner: owner.cookie,
          admin: admin.cookie,
          other: other.cookie,
          ownerName: owner.data.name,
          ownerId: owner.data.id,
          roomIds,
          userIds,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  console.log(
    `PASS: ${checks} pagination API checks; all 201 owners/rooms reachable, true totals, status/search, bounded inputs and ownership protection.`,
  );
} finally {
  await db.end();
}
