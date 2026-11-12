// Writes/deletes its own fixtures. Run only against an isolated database/server pair.
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
const base = process.env.TEST_BASE_URL;
if (
  !base ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set TEST_BASE_URL, MYSQL_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for an isolated database.",
  );
const db = await mysql.createConnection({
  uri: process.env.MYSQL_URL,
  timezone: "Z",
});
const prefix = `recluster-${Date.now()}-`;
let checks = 0;
function equal(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
}
async function login(url) {
  const response = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    }),
  });
  equal(response.status, 200, "Admin login");
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function snapshot() {
  const [rows] = await db.query(
    "SELECT external_id, cluster_id, verification_status, UNIX_TIMESTAMP(updated_at) AS stamp FROM listings WHERE external_id LIKE ? ORDER BY external_id",
    [prefix + "%"],
  );
  return rows;
}
try {
  const values = Array.from({ length: 201 }, (_, index) => [
    prefix + index,
    "Phòng thử gần Đại học Bách khoa",
    "Dữ liệu kiểm thử tổng hợp",
    "Hải Châu, Đà Nẵng",
    "nam-da-nang",
    index === 0 ? "verified" : "needs_review",
    "2020-01-01 00:00:00",
  ]);
  values.push([
    prefix + "unknown",
    "Phòng cho sinh viên",
    "Dữ liệu kiểm thử",
    "Đà Nẵng",
    "bach-khoa-su-pham",
    "needs_review",
    "2020-01-01 00:00:00",
  ]);
  values.push([
    prefix + "invalid",
    "Phòng thử",
    "Dữ liệu kiểm thử",
    "Hòa Minh, Đà Nẵng",
    "invalid-user-value",
    "needs_review",
    "2020-01-01 00:00:00",
  ]);
  await db.query(
    "INSERT INTO listings(external_id,title,summary,address,cluster_id,verification_status,updated_at) VALUES ?",
    [values],
  );
  const before = await snapshot();
  equal(
    (await fetch(base + "/api/admin/recluster", { method: "POST" })).status,
    401,
    "Private endpoint",
  );
  equal(
    (await fetch(base + "/api/community/posts/" + prefix + "0")).status,
    404,
    "Old room hidden before operation",
  );
  const cookie = await login(base);
  const response = await fetch(base + "/api/admin/recluster", {
    method: "POST",
    headers: { cookie },
  });
  const result = await response.json();
  equal(response.status, 200, JSON.stringify(result));
  assert(result.data.scanned >= 203);
  checks++;
  assert(result.data.databaseUpdated >= 203);
  checks++;
  const after = await snapshot();
  equal(after.length, 203);
  for (const row of after) {
    const expected = row.external_id.endsWith("unknown")
      ? "chua-phan-cum"
      : row.external_id.endsWith("invalid")
        ? "bach-khoa-su-pham"
        : "hai-chau";
    equal(row.cluster_id, expected, row.external_id);
    const prior = before.find((item) => item.external_id === row.external_id);
    equal(row.stamp, prior.stamp, "Metadata change must preserve freshness");
    equal(
      row.verification_status,
      prior.verification_status,
      "Review state must remain",
    );
  }
  equal(
    (await fetch(base + "/api/community/posts/" + prefix + "0")).status,
    404,
    "Old room must stay hidden",
  );
  const repeated = await fetch(base + "/api/admin/recluster", {
    method: "POST",
    headers: { cookie },
  });
  equal(repeated.status, 200);
  equal(
    (await repeated.json()).data.databaseUpdated,
    0,
    "Repeated operation is idempotent",
  );
  if (process.env.TEST_FAILURE_BASE_URL) {
    const failureBase = process.env.TEST_FAILURE_BASE_URL;
    const failureCookie = await login(failureBase);
    const failed = await fetch(failureBase + "/api/admin/recluster", {
      method: "POST",
      headers: { cookie: failureCookie },
    });
    equal(failed.status, 503, "Unavailable DB cannot report success");
    equal((await failed.json()).code, "RECLUSTER_FAILED");
  }
  console.log(
    `PASS: ${checks} reclustering checks; 203 fixtures, full pagination, correction of assigned/invalid clusters, timestamp/review preservation, stale visibility, idempotency, database failure.`,
  );
} finally {
  await db.query("DELETE FROM listings WHERE external_id LIKE ?", [
    prefix + "%",
  ]);
  await db.end();
}
