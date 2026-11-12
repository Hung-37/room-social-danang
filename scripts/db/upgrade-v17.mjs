import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import "../lib/env.mjs";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
export async function upgradeCommunityMutations(c) {
  for (const table of ["community_posts", "community_comments"]) {
    const [rows] = await c.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?",
      [table],
    );
    const columns = new Set(rows.map((r) => r.name));
    if (!columns.size)
      throw new Error("Initialize the schema before upgrade-v17.");
    if (!columns.has("version"))
      await c.query(
        `ALTER TABLE ${table} ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1`,
      );
    if (!columns.has("deleted_at"))
      await c.query(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME NULL`);
  }
  for (const [table, name, columns] of [
    [
      "community_posts",
      "community_author_content",
      "author_id,deleted_at,updated_at,id",
    ],
    [
      "community_comments",
      "comments_author_content",
      "author_id,deleted_at,created_at,id",
    ],
    [
      "notifications",
      "notifications_user_unread",
      "user_id,is_read,created_at,id",
    ],
  ]) {
    const [rows] = await c.query(
      "SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1",
      [table, name],
    );
    if (!rows.length)
      await c.query(`ALTER TABLE ${table} ADD INDEX ${name} (${columns})`);
  }
  await c.query(
    await readFile(
      new URL("../../database/migrations/upgrade-v17.sql", import.meta.url),
      "utf8",
    ),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.env.MYSQL_URL) throw new Error("MYSQL_URL required.");
  const c = await mysql.createConnection({
    ...mysqlConnectionOptions(),
    multipleStatements: true,
  });
  try {
    await upgradeCommunityMutations(c);
    console.log("V17 mutations ready. Existing data preserved.");
  } finally {
    await c.end();
  }
}
