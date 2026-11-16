import { getAdminSessionFromRequest } from "@/lib/server/admin-auth";
import { getDatabasePool } from "@/lib/server/mysql-pool";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return Response.json({ error: "Yêu cầu quyền Admin." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const configuration = {
    MYSQL_URL: Boolean(process.env.MYSQL_URL?.trim()),
    USER_SESSION_SECRET: Boolean(process.env.USER_SESSION_SECRET?.trim()),
  };
  const requestId = randomUUID();
  if (!configuration.MYSQL_URL || !configuration.USER_SESSION_SECRET)
    return Response.json({ status: "unavailable", configuration, requestId }, { status: 503, headers: { "Cache-Control": "no-store" } });

  try {
    const pool = getDatabasePool();
    const [databaseRows] = await pool.query<(RowDataPacket & { databaseName: string; readOnly: number })[]>("SELECT DATABASE() AS databaseName, @@global.read_only AS readOnly");
    const databaseName = databaseRows[0]?.databaseName ?? "";
    const readOnly = Number(databaseRows[0]?.readOnly ?? 0) === 1;
    const [columns] = await pool.query<(RowDataPacket & { column_name: string })[]>(
      "SELECT column_name AS column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name IN ('external_id','name','email','password_hash','role')",
    );
    const expected = ["external_id", "name", "email", "password_hash", "role"];
    const actual = new Set(columns.map((row) => row.column_name));
    const [indexes] = await pool.query<(RowDataPacket & { index_name: string; columns: string; non_unique: number })[]>(
      "SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns, MIN(non_unique) AS non_unique FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' GROUP BY index_name",
    );
    const emailUnique = indexes.some((row) => row.non_unique === 0 && row.columns === "email");
    let grantsAvailable = false;
    try {
      const [grants] = await pool.query<(RowDataPacket & { [key: string]: string })[]>("SHOW GRANTS");
      grantsAvailable = grants.some((row) => Object.values(row).some((grant) => {
        const normalized = grant.replaceAll("`", "").toLowerCase();
        if (!/\b(?:all privileges|insert)\b/i.test(normalized)) return false;
        const onIndex = normalized.indexOf(" on ");
        if (onIndex < 0) return false;
        const target = normalized.slice(onIndex + 4).split(/\s+/)[0];
        const database = databaseName.toLowerCase();
        return target === "*.*" || target === `${database}.*` || target === `${database}.users`;
      }));
    } catch {
      // Some managed databases do not permit SHOW GRANTS. No write probe is performed.
    }
    const schemaReady = expected.every((name) => actual.has(name)) && emailUnique;
    const ready = schemaReady && grantsAvailable && !readOnly;
    return Response.json({ status: ready ? "ok" : "unavailable", configuration, database: true, schema: { usersTable: actual.size === expected.length, requiredColumns: Object.fromEntries(expected.map((name) => [name, actual.has(name)])), emailUnique }, writePrivilegeReported: grantsAvailable, databaseReadOnly: readOnly, requestId }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", configuration, database: false, requestId }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
