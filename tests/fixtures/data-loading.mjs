import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
const root = process.cwd(),
  req = createRequire(root + "/package.json"),
  mysql = req("mysql2/promise");
const uri = process.env.MYSQL_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !uri ||
  !["127.0.0.1", "localhost"].includes(new URL(uri).hostname) ||
  !/(?:qa|test)/i.test(new URL(uri).pathname)
)
  throw new Error(
    "Require TEST_ISOLATED_DB=1 and a localhost QA/test MYSQL_URL. Never seed production.",
  );
const db = await mysql.createConnection({ uri, multipleStatements: true });
await db.query(await readFile(root + "/database/schema.sql", "utf8"));
const salt = randomBytes(16).toString("hex"),
  hash = salt + ":" + scryptSync("PerfTest123!", salt, 64).toString("hex");
await db.execute(
  "INSERT IGNORE INTO users(external_id,name,email,password_hash,role) VALUES ('perf-viewer','[Kiểm thử] Người đọc','perf-viewer@test.local',?,'student')",
  [hash],
);
const [seed] = await db.query(
  "SELECT COUNT(*) AS n FROM listings WHERE external_id LIKE 'perf-room-%'",
);
if (!seed[0].n) {
  await db.beginTransaction();
  const time = new Date().toISOString().slice(0, 19).replace("T", " ");
  for (let start = 0; start < 1080; start += 100) {
    const values = [];
    for (let i = start; i < Math.min(start + 100, 1080); i++) {
      const id = String(i).padStart(5, "0");
      const status =
        i < 1000
          ? "verified"
          : i < 1020
            ? "needs_review"
            : i < 1040
              ? "rejected"
              : i < 1060
                ? "hidden"
                : "rented";
      values.push([
        "perf-room-" + id,
        "[Kiểm thử dữ liệu] Phòng " + id,
        "Dữ liệu tổng hợp để kiểm tra đọc, tìm kiếm và phân trang. Không phải tin cho thuê thật.",
        2500000,
        25,
        i % 2 ? "Liên Chiểu, Đà Nẵng" : "Hải Châu, Đà Nẵng",
        i % 2 ? "bach-khoa-su-pham" : "hai-chau",
        "[Kiểm thử] Nguồn dữ liệu",
        "https://example.invalid/room/" + id,
        "public_html",
        status,
        30,
        time,
      ]);
    }
    await db.query(
      "INSERT INTO listings(external_id,title,summary,price,area_m2,address,cluster_id,source_name,source_url,permission,verification_status,trust_score,updated_at) VALUES ?",
      [values],
    );
  }
  for (let i = 0; i < 88; i++) {
    const id = "perf-post-" + String(i).padStart(5, "0");
    await db.execute(
      "INSERT INTO community_posts(id,title,summary,cluster_id,cluster_name,post_kind,author_name,status,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        "[Kiểm thử dữ liệu] Thảo luận " + String(i).padStart(5, "0"),
        "Dữ liệu tổng hợp để kiểm tra tương tác và danh sách, không phải chia sẻ thực tế.",
        "hai-chau",
        "Hải Châu",
        "question",
        "[Kiểm thử] Thành viên",
        i < 72 ? "verified" : "needs_review",
        time,
        i >= 80 ? time : null,
      ],
    );
  }
  const [users] = await db.query(
    "SELECT id FROM users WHERE external_id='perf-viewer'",
  );
  const uid = users[0].id;
  for (let i = 0; i < 88; i++) {
    await db.execute(
      "INSERT INTO community_reactions(post_id,user_id,reaction) VALUES (?,?,'like')",
      ["perf-post-" + String(i).padStart(5, "0"), uid],
    );
    for (let j = 0; j < 3; j++)
      await db.execute(
        "INSERT INTO community_comments(id,post_id,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?)",
        [
          "perf-comment-" + i + "-" + j,
          "perf-post-" + String(i).padStart(5, "0"),
          uid,
          "[Kiểm thử] Người đọc",
          "Bình luận tổng hợp để kiểm tra số liệu.",
          time,
        ],
      );
  }
  await db.commit();
  console.log("Seeded isolated dataset: 1,080 rooms and 88 discussions.");
}
await db.end();
