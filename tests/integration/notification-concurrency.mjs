// Creates synthetic content/notifications in an explicitly isolated local QA DB.
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL,
  uri = process.env.MYSQL_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  !uri ||
  !/(qa|test)/i.test(new URL(uri).pathname)
)
  throw new Error("Require isolated localhost QA and MYSQL_URL.");
const stamp = Date.now();
let checks = 0;
async function api(path, { cookie = "", body, status = 200 } = {}) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  assert.equal(r.status, status, JSON.stringify(p));
  checks++;
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
const reg = async (role) =>
  api("/api/auth/register", {
    status: 201,
    body: {
      name: "[Kiểm thử] Khóa thông báo " + role,
      email: "notice-" + stamp + "-" + role + "@test.local",
      password: "NoticeTest123!",
      role,
    },
  });
const owner = await reg("landlord"),
  buyer = await reg("student");
const admin = await api("/api/auth/login", {
  body: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
});
const verified = await fetch(base + "/api/admin/landlords", {
  method: "PATCH",
  headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ id: owner.data.id, status: "verified" }),
});
assert.equal(verified.status, 200);
checks++;
const room = await api("/api/listings/create", {
  cookie: owner.cookie,
  status: 201,
  body: {
    title: "[Kiểm thử] Hội thoại và xóa " + stamp,
    summary:
      "Dữ liệu tổng hợp để kiểm tra khóa database khi xóa và nhắn tin đồng thời.",
    address: "Hải Châu, Đà Nẵng",
    price: 2200000,
    area: 22,
  },
});
await api("/api/listings/" + room.data.externalId + "/status", {
  cookie: admin.cookie,
  body: { status: "verified" },
});
const chat = (
  await api("/api/chat", {
    cookie: buyer.cookie,
    body: { listingId: room.data.externalId },
  })
).data.id;
const db = await mysql.createConnection(uri);
const results = [];
const trigger = "qa_notice_pause_" + stamp;
try {
  // Controlled DB delay widens the deletion/insert overlap, without an app test hook.
  await db.query(
    `CREATE TRIGGER ${trigger} BEFORE DELETE ON listings FOR EACH ROW DO SLEEP(0.15)`,
  );
  const [users] = await db.query("SELECT id FROM users WHERE external_id=?", [
    owner.data.id,
  ]);
  const uid = users[0].id;
  const ids = Array.from(
    { length: 20 },
    (_, i) => "workflow-notice-" + stamp + "-" + i,
  );
  for (const id of ids)
    await db.execute(
      "INSERT INTO listings(external_id,title,summary,owner_external_id,verification_status) VALUES(?,'[Kiểm thử] Xóa cùng lúc','Dữ liệu tổng hợp, không phải tin cho thuê thật.',?,'rejected')",
      [id, owner.data.id],
    );
  const notifications = Array.from({ length: 4000 }, (_, i) => [
    uid,
    "test",
    "[Kiểm thử] Dữ liệu khóa " + stamp,
    "Nội dung tổng hợp",
    i < 1000 ? "/bai/" + ids[i % 20] : "/profile?qa=" + stamp,
  ]);
  for (let start = 0; start < notifications.length; start += 200)
    await db.query(
      "INSERT INTO notifications(user_id,type,title,body,href) VALUES ?",
      [notifications.slice(start, start + 200)],
    );
  for (const id of ids) {
    const pair = await Promise.all([
      fetch(base + "/api/admin/listings/" + id, {
        method: "DELETE",
        headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "[Kiểm thử] Xóa tin để xác minh luồng đồng thời.",
        }),
      }),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return fetch(base + "/api/chat/" + chat, {
          method: "POST",
          headers: { Cookie: buyer.cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ text: "[Kiểm thử] Gửi đồng thời " + id }),
        });
      })(),
    ]);
    results.push({ deletion: pair[0].status, message: pair[1].status });
  }
  const [messages] = await db.query(
    "SELECT COUNT(*) AS n FROM private_messages WHERE conversation_id=?",
    [chat],
  );
  const [unrelated] = await db.query(
    "SELECT COUNT(*) AS n FROM notifications WHERE href=?",
    ["/profile?qa=" + stamp],
  );
  const report = {
    pairs: results,
    messageRows: Number(messages[0].n),
    unrelatedNotifications: Number(unrelated[0].n),
  };
  if (process.env.TEST_CONCURRENCY_REPORT)
    await writeFile(
      process.env.TEST_CONCURRENCY_REPORT,
      JSON.stringify(report, null, 2),
    );
  assert(
    results.every((x) => x.deletion === 200 && x.message === 201),
    JSON.stringify(results),
  );
  checks += 40;
  assert.equal(Number(messages[0].n), 20);
  checks++;
  assert.equal(Number(unrelated[0].n), 3000);
  checks++;
  const [related] = await db.query(
    "SELECT COUNT(*) AS n FROM notifications WHERE href IN (?)",
    [ids.map((id) => "/bai/" + id)],
  );
  assert.equal(Number(related[0].n), 0);
  checks++;
  console.log(
    `PASS: ${checks} checks; 20 concurrent room-deletion/message pairs, exactly 20 messages, 3,000 unrelated notifications retained and matching notifications removed.`,
  );
} finally {
  await db.query(`DROP TRIGGER IF EXISTS ${trigger}`);
  await db.end();
}
