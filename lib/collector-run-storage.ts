import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const RUNS_FILE = join(process.cwd(), 'data', 'collector-runs.json');

export type CollectorRunRecord = {
  ranAt: string;
  status: string;
  configured: number;
  collected: number;
  duplicates: number;
  errors: number;
};

export function listCollectorRuns(limit = 50): CollectorRunRecord[] {
  if (!existsSync(RUNS_FILE)) return [];
  try {
    const content = JSON.parse(readFileSync(RUNS_FILE, 'utf8')) as unknown;
    return Array.isArray(content) ? content.slice(0, limit) as CollectorRunRecord[] : [];
  } catch {
    return [];
  }
}

export function recordCollectorRun(run: CollectorRunRecord) {
  mkdirSync(dirname(RUNS_FILE), { recursive: true });
  const temporary = `${RUNS_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify([run, ...listCollectorRuns(99)], null, 2)}\n`, 'utf8');
  renameSync(temporary, RUNS_FILE);
}
