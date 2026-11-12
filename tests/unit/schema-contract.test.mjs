import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
// Fail when the schema evolves without updating the runtime readiness contract.
test("readiness contract covers every table and column of the shipped schema", async () => {
  const sql = await readFile(
    new URL("../../database/schema.sql", import.meta.url),
    "utf8",
  );
  const actual = {};
  for (const [, table, body] of sql.matchAll(
    /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\((.*?)\) ENGINE/gs,
  )) {
    actual[table] = [
      ...body.matchAll(
        /(?:^|,)\s*(\w+)\s+(?:BIGINT|INT|SMALLINT|TINYINT|VARCHAR|TEXT|MEDIUMTEXT|LONGTEXT|DECIMAL|ENUM|TIMESTAMP|DATETIME|DATE|BOOLEAN|JSON|CHAR)\b/gi,
      ),
    ].map((m) => m[1]);
  }
  const expected = JSON.parse(
    await readFile(
      new URL("../../database/schema-contract.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(Object.keys(actual).length, 23);
  assert.deepEqual(expected, actual);
  for (const [table, columns] of Object.entries(expected)) {
    assert.match(table, /^[a-z][a-z0-9_]*$/);
    assert(columns.length > 0);
    for (const column of columns) assert.match(column, /^[a-z][a-z0-9_]*$/);
  }
});
