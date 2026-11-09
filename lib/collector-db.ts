import mysql, { type Pool } from 'mysql2/promise';
import type { CollectorRunRecord } from '@/lib/collector-run-storage';
import type { CollectorSource } from '@/js/collector.js';

let pool: Pool | undefined;

function getPool() {
  const url = process.env.MYSQL_URL?.trim();
  if (!url) throw new Error('MYSQL_URL is not configured.');
  pool ??= mysql.createPool({ uri: url, connectionLimit: 5, waitForConnections: true, queueLimit: 0 });
  return pool;
}

export function hasCollectorDatabase() {
  return Boolean(process.env.MYSQL_URL?.trim());
}

export async function listCollectorSourceSettings() {
  const [rows] = await getPool().query('SELECT source_id AS sourceId, enabled, config FROM collector_source_settings');
  return (rows as Array<{ sourceId: string; enabled: number | boolean; config: unknown }>).map((row) => ({
    sourceId: row.sourceId,
    enabled: Boolean(row.enabled),
    config: typeof row.config === 'string' ? JSON.parse(row.config) as Record<string, unknown> : row.config
  }));
}

export async function saveCollectorSourceSetting(source: CollectorSource, enabled: boolean, updatedBy?: string) {
  await getPool().query(
    `INSERT INTO collector_source_settings (source_id, enabled, config, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config), updated_by = VALUES(updated_by)`,
    [source.id, enabled, JSON.stringify(source), updatedBy ?? null]
  );
}

export async function recordCollectorRunDb(run: CollectorRunRecord) {
  await getPool().query(
    `INSERT INTO collector_runs
      (status, configured_sources, collected_count, duplicate_count, error_count, details, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [run.status, run.configured, run.collected, run.duplicates, run.errors, JSON.stringify(run), run.ranAt, run.ranAt]
  );
}

export async function listCollectorRunsDb(limit = 50): Promise<CollectorRunRecord[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const [rows] = await getPool().query(
    `SELECT status, configured_sources AS configured, collected_count AS collected,
            duplicate_count AS duplicates, error_count AS errors, started_at AS ranAt
       FROM collector_runs ORDER BY started_at DESC LIMIT ${safeLimit}`
  );
  return rows as CollectorRunRecord[];
}
