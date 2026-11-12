import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import '../lib/env.mjs';
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
if (!process.env.MYSQL_URL) throw new Error("MYSQL_URL is required.");
const connection = await mysql.createConnection({
  ...mysqlConnectionOptions(),
  multipleStatements: true,
});
try {
  await connection.query(
    await readFile(
      new URL("../../database/migrations/upgrade-v15.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "V15 deletion markers ready. No listings or user data were deleted.",
  );
} finally {
  await connection.end();
}
