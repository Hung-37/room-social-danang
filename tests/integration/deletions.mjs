// Destructive fixtures and an injected DB failure: isolated database/server ONLY.
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { readFile, writeFile, unlink } from "node:fs/promises";
const base = process.env.TEST_BASE_URL,
  broken = process.env.TEST_FAILURE_BASE_URL;
if (
  !base ||
  !broken ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD ||
  !process.env.TEST_DELETE_FIXTURES ||
  !process.env.TEST_CACHE_FILE
)
  throw new Error(
    "Set isolated server/database/admin, failure server, TEST_DELETE_FIXTURES and TEST_CACHE_FILE.",
  );
let checks = 0;
function equal(a, b, why) {
  assert.deepEqual(a, b, why);
  checks++;
}
async function api(
  path,
  { method = "GET", body, cookie = "", status = 200, url = base } = {},
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  equal(r.status, status, path + JSON.stringify(p));
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
const stamp = Date.now(),
  reason = "Tin kiểm thử không đáp ứng quy định đăng phòng.";
const credentials = {
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD,
};
const admin = await api("/api/auth/login", {
  method: "POST",
  body: credentials,
});
async function register(role) {
  return api("/api/auth/register", {
    method: "POST",
    status: 201,
    body: {
      name: "Kiểm thử xóa " + role,
      email: `delete-${role}-${stamp}@test.local`,
      password: "DeletionTest123!",
      role,
    },
  });
}
const owner = await register("landlord"),
  buyer = await register("student");
await api("/api/admin/landlords", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { id: owner.data.id, status: "verified" },
});
const buffer = await sharp({
  create: { width: 1200, height: 900, channels: 3, background: "#91b9ad" },
})
  .png()
  .toBuffer();
const form = new FormData();
form.append(
  "file",
  new Blob([buffer], { type: "image/png" }),
  "synthetic-test.png",
);
let imageResponse = await fetch(base + "/api/images", {
  method: "POST",
  headers: { cookie: owner.cookie },
  body: form,
});
equal(imageResponse.status, 201);
const image = (await imageResponse.json()).data;
async function room(label, imageIds = []) {
  const p = await api("/api/listings/create", {
    method: "POST",
    cookie: owner.cookie,
    status: 201,
    body: {
      title: `[Kiểm thử] ${label} ${stamp}`,
      summary:
        "Dữ liệu tổng hợp để kiểm tra xóa tin, không phải tin cho thuê thực tế.",
      address: "Hải Châu, Đà Nẵng",
      price: 2500000,
      area: 25,
      clusterId: "hai-chau",
      imageIds,
    },
  });
  return p.data.externalId;
}
async function status(id, value) {
  await api("/api/listings/" + id + "/status", {
    method: "POST",
    cookie: admin.cookie,
    body: { status: value },
  });
}
const id = await room("Tin có dữ liệu liên quan", [image.id]);
await api("/api/admin/listings/" + id, {
  method: "DELETE",
  cookie: admin.cookie,
  body: { reason },
  status: 409,
});
await status(id, "verified");
await api("/api/admin/listings/" + id, {
  method: "DELETE",
  cookie: admin.cookie,
  body: { reason },
  status: 409,
});
await api("/api/favorites", {
  method: "PUT",
  cookie: buyer.cookie,
  body: { id, saved: true },
});
const comment = await api("/api/community/posts/" + id + "/comments", {
  method: "POST",
  cookie: buyer.cookie,
  body: { text: "Bình luận kiểm thử cần được dọn cùng tin." },
  status: 201,
});
await api("/api/community/posts/" + id + "/comments", {
  method: "POST",
  cookie: owner.cookie,
  body: { text: "Trả lời kiểm thử trong cùng tin.", parentId: comment.data.id },
  status: 201,
});
await api("/api/community/posts/" + id + "/interactions", {
  method: "POST",
  cookie: buyer.cookie,
  body: { reaction: "like" },
});
await api("/api/community/posts/" + id + "/report", {
  method: "POST",
  cookie: buyer.cookie,
  body: { reason: "wrong_information", details: "Báo cáo kiểm thử." },
  status: 201,
});
const chat = await api("/api/chat", {
  method: "POST",
  cookie: buyer.cookie,
  body: { listingId: id },
  status: 200,
});
await api("/api/chat/" + chat.data.id, {
  method: "POST",
  cookie: buyer.cookie,
  body: { text: "Tin nhắn riêng kiểm thử phải được giữ lại." },
  status: 201,
});
const startsAt =
  new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16) + ":00.000Z";
const visit = await api("/api/appointments", {
  method: "POST",
  cookie: buyer.cookie,
  body: {
    conversationId: chat.data.id,
    startsAt,
    note: "Lịch kiểm thử được giữ lại.",
  },
  status: 201,
});
const db = await mysql.createConnection(process.env.MYSQL_URL);
await db.query(
  "INSERT INTO listing_ai_analysis(listing_id,status,model,prompt_version,content_hash,payload,error,analyzed_at) VALUES(?,'skipped','synthetic','qa',?,NULL,NULL,UTC_TIMESTAMP())",
  [id, "0".repeat(64)],
);
await status(id, "rejected");
await api("/api/admin/listings/" + id, {
  method: "DELETE",
  body: { reason },
  status: 401,
});
for (const cookie of [owner.cookie, buyer.cookie])
  await api("/api/admin/listings/" + id, {
    method: "DELETE",
    cookie,
    body: { reason },
    status: 401,
  });
for (const reason of ["", "ngắn", " ".repeat(20), "x".repeat(501)])
  await api("/api/admin/listings/" + id, {
    method: "DELETE",
    cookie: admin.cookie,
    body: { reason },
    status: 400,
  });
await api("/api/admin/listings/missing-" + stamp, {
  method: "DELETE",
  cookie: admin.cookie,
  body: { reason },
  status: 404,
});
async function count(table, column = "post_id", value = id) {
  return Number(
    (
      await db.query(
        `SELECT COUNT(*) AS total FROM ${table} WHERE ${column}=?`,
        [value],
      )
    )[0][0].total,
  );
}
const dependencies = [
  ["community_comments", "post_id"],
  ["community_reactions", "post_id"],
  ["community_reports", "post_id"],
  ["saved_posts", "post_id"],
  ["listing_images", "listing_id"],
  ["listing_ai_analysis", "listing_id"],
];
const before = new Map();
for (const [table, column] of dependencies) {
  const total = await count(table, column);
  assert(total > 0, table);
  checks++;
  before.set(table, total);
}
const trigger = "v15_delete_failure";
let oldCache = null;
try {
  oldCache = await readFile(process.env.TEST_CACHE_FILE).catch(() => null);
  await writeFile(
    process.env.TEST_CACHE_FILE,
    JSON.stringify([
      {
        externalId: id,
        verificationStatus: "verified",
        title: "Old cached room",
      },
      { externalId: "keep-cache-" + stamp, title: "Unrelated cached room" },
    ]),
  );
  await db.query(
    `CREATE TRIGGER ${trigger} BEFORE DELETE ON listings FOR EACH ROW BEGIN IF OLD.external_id=${mysql.escape(id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback test'; END IF; END`,
  );
  await api("/api/admin/listings/" + id, {
    method: "DELETE",
    cookie: admin.cookie,
    body: { reason },
    status: 503,
  });
  equal(await count("listings", "external_id"), 1);
  equal(await count("listing_deletions", "external_id"), 0);
  for (const [table, column] of dependencies)
    equal(await count(table, column), before.get(table), "Rollback " + table);
  await db.query("DROP TRIGGER " + trigger);
  const deleted = await api("/api/admin/listings/" + id, {
    method: "DELETE",
    cookie: admin.cookie,
    body: { reason },
  });
  equal(deleted.data.deleted, true);
  equal(deleted.data.cacheSynced, true);
  const cache = JSON.parse(await readFile(process.env.TEST_CACHE_FILE, "utf8"));
  equal(
    cache.map((row) => row.externalId),
    ["keep-cache-" + stamp],
  );
  for (const [table, column] of dependencies)
    equal(await count(table, column), 0, "Cleanup " + table);
  equal(await count("listings", "external_id"), 0);
  equal(await count("listing_deletions", "external_id"), 1);
  equal(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) AS n FROM comment_replies WHERE parent_id=?",
          [comment.data.id],
        )
      )[0][0].n,
    ),
    0,
  );
  const tombstone = (
    await db.query(
      "SELECT reason,deleted_by FROM listing_deletions WHERE external_id=?",
      [id],
    )
  )[0][0];
  equal(tombstone.reason, reason);
  equal(tombstone.deleted_by, credentials.email);
  const again = await api("/api/admin/listings/" + id, {
    method: "DELETE",
    cookie: admin.cookie,
    body: { reason: "Thử lại sau khi mất kết nối." },
  });
  equal(again.data.alreadyDeleted, true);
  equal(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) AS n FROM moderation_logs WHERE entity_id=? AND action='listing_deleted'",
          [id],
        )
      )[0][0].n,
    ),
    1,
  );
  for (const path of [
    "/api/listings/" + id,
    "/api/community/posts/" + id,
    "/api/admin/listings/" + id + "/preview",
  ])
    await api(path, { cookie: admin.cookie, status: 404 });
  await api("/api/landlord/listings/" + id, {
    cookie: owner.cookie,
    status: 404,
  });
  await api("/api/images/" + image.id, { cookie: admin.cookie, status: 404 });
  const history = await api("/api/chat/" + chat.data.id, {
    cookie: buyer.cookie,
  });
  equal(history.data.conversation.listingDeleted, true);
  equal(
    history.data.messages[0].body,
    "Tin nhắn riêng kiểm thử phải được giữ lại.",
  );
  equal(await count("viewing_appointments", "id", visit.data.id), 1);
  await api("/api/appointments/" + visit.data.id, {
    method: "PATCH",
    cookie: owner.cookie,
    body: { action: "confirm", version: 1 },
    status: 409,
  });
  const notices = await api("/api/notifications", { cookie: owner.cookie });
  assert(
    notices.data.some(
      (row) => row.type === "listing_deleted" && row.href === "/quan-ly-phong",
    ),
  );
  checks++;
  const failedAdmin = await api("/api/auth/login", {
    url: broken,
    method: "POST",
    body: credentials,
  });
  await api("/api/admin/listings/" + id, {
    url: broken,
    method: "DELETE",
    cookie: failedAdmin.cookie,
    body: { reason },
    status: 503,
  });
  await api("/api/listings/" + id, { url: broken, status: 503 });
  const input = {
    id: "deleted-import-" + stamp,
    title: "Phòng trọ Hải Châu kiểm thử nhập lại",
    description: "Phòng đủ thông tin để kiểm tra chống nhập lại tin đã xóa.",
    address: "Hải Châu, Đà Nẵng",
    price: "2.5 triệu",
    area: "25m2",
  };
  const importBody = {
    format: "json",
    content: JSON.stringify([input]),
  };
  const imported = await api("/api/import/listings", {
    method: "POST",
    cookie: admin.cookie,
    body: importBody,
  });
  equal(imported.saved, 1);
  const importedId = imported.data[0].externalId;
  await status(importedId, "rejected");
  await api(
    "/api/admin/listings/" + encodeURIComponent(importedId.toLowerCase()),
    {
      method: "DELETE",
      cookie: admin.cookie,
      body: { reason },
    },
  );
  const retry = await api("/api/import/listings", {
    method: "POST",
    cookie: admin.cookie,
    body: importBody,
  });
  equal(retry.saved, 0);
  equal(retry.data.length, 0);
  assert(retry.rejected.some((row) => row.id === importedId));
  checks++;
  equal(await count("listings", "external_id", importedId), 0);
  // Concurrent collector upsert and Admin deletion must leave the room absent in either order.
  input.id = "race-import-" + stamp;
  input.title = "Phòng trọ Hải Châu thử ghi đồng thời";
  const raceBody = { ...importBody, content: JSON.stringify([input]) };
  const importedRace = await api("/api/import/listings", {
    method: "POST",
    cookie: admin.cookie,
    body: raceBody,
  });
  const raceId = importedRace.data[0].externalId;
  await status(raceId, "rejected");
  await Promise.all([
    api("/api/admin/listings/" + encodeURIComponent(raceId), {
      method: "DELETE",
      cookie: admin.cookie,
      body: { reason },
    }),
    api("/api/import/listings", {
      method: "POST",
      cookie: admin.cookie,
      body: raceBody,
    }),
  ]);
  equal(await count("listings", "external_id", raceId), 0);
  const targets = [];
  for (const label of ["Tin xóa trên máy tính", "Tin xóa trên điện thoại"]) {
    const target = await room(label);
    await status(target, "rejected");
    targets.push({ id: target, title: `[Kiểm thử] ${label} ${stamp}` });
  }
  const keep = await room("Tin đang chờ duyệt phải được giữ");
  await writeFile(
    process.env.TEST_DELETE_FIXTURES,
    JSON.stringify(
      {
        base,
        admin: admin.cookie,
        owner: owner.cookie,
        buyer: buyer.cookie,
        targets,
        keep,
        chatId: chat.data.id,
        deletedId: id,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `PASS: ${checks} deletion checks; Admin/rejected guards, reason validation, rollback, cleanup and audit, idempotency, private chat/visit retention, notification, cache purge, DB failure, blocked reimport and concurrent collector/delete.`,
  );
} finally {
  await db.query("DROP TRIGGER IF EXISTS " + trigger);
  if (oldCache) await writeFile(process.env.TEST_CACHE_FILE, oldCache);
  else await unlink(process.env.TEST_CACHE_FILE).catch(() => {});
  await db.end();
}
