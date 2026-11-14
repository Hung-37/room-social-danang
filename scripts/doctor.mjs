import { mysqlConnectionOptions } from '../lib/mysql-options.js';
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
let failed = false;
const result = (ok, name) => {
  console.log(`${ok ? "OK" : "FAIL"} ${name}`);
  if (!ok) failed = true;
};
const [major, minor] = process.versions.node.split(".").map(Number);
result(major > 22 || (major === 22 && minor >= 13), "Node.js >= 22.13");
for (const name of [
  "next",
  "react",
  "react-dom",
  "cheerio",
  "mysql2",
  "typescript",
]) {
  try {
    require.resolve(`${name}/package.json`);
    result(true, `dependency ${name}`);
  } catch {
    result(false, `dependency ${name}; chạy npm ci`);
  }
}
if (!failed && !process.argv.includes("--dependencies-only")) {
  await import("./lib/env.mjs");
  for (const name of ["MYSQL_URL", "ADMIN_EMAIL", "ADMIN_PASSWORD"])
    result(Boolean(process.env[name]?.trim()), `configuration ${name}`);
  for (const name of ["ADMIN_SESSION_SECRET", "USER_SESSION_SECRET"])
    result((process.env[name]?.length || 0) >= 32, `${name} >= 32 characters`);
  if (process.env.ADMIN_SESSION_SECRET && process.env.USER_SESSION_SECRET)
    result(
      process.env.ADMIN_SESSION_SECRET !== process.env.USER_SESSION_SECRET,
      "separate Admin/user session secrets",
    );
  if (process.env.MYSQL_URL) {
    let db;
    try {
      const { default: mysql } = await import("mysql2/promise");
      db = await mysql.createConnection({
        ...mysqlConnectionOptions(),
        connectTimeout: 5000,
      });
      const schema = await readFile(
        new URL("../database/schema.sql", import.meta.url),
        "utf8",
      );
      const expected = [
        ...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g),
      ].map((match) => match[1]);
      const [rows] = await db.query(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE()",
      );
      const actual = new Set(rows.map((row) => row.name));
      const missing = expected.filter((name) => !actual.has(name));
      result(
        !missing.length,
        `database schema (${expected.length} required tables)${missing.length ? "; missing: " + missing.join(", ") : ""}`,
      );
      const [mutationColumns] = await db.query(
        "SELECT table_name AS tableName,column_name AS columnName FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN ('community_posts','community_comments') AND column_name IN ('version','deleted_at')",
      );
      result(
        mutationColumns.length === 4,
        "V17 content version/deletion columns; run npm run db:upgrade-v17 if missing",
      );
    } catch {
      result(
        false,
        "database connection/configuration; check MYSQL_URL and migrations",
      );
    } finally {
      await db?.end();
    }
  }
  console.log(
    "NOTE: HTTPS, external source access and production hosting need separate verification.",
  );
}
if (failed) process.exitCode = 1;
