import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import "../lib/env.mjs";
import { upgradeCommunityMutations } from "./upgrade-v17.mjs";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
if (!process.env.MYSQL_URL?.trim())
  throw new Error(
    "MYSQL_URL must be configured before initializing the database.",
  );
const connection = await mysql.createConnection({
  ...mysqlConnectionOptions(),
  multipleStatements: true,
});
try {
  const schema = await readFile(
    new URL("../../database/schema.sql", import.meta.url),
    "utf8",
  );
  await connection.query(schema);
  await upgradeCommunityMutations(connection);
  console.log(
    "Database schema initialized. Existing tables and data were preserved.",
  );
} finally {
  await connection.end();
}
