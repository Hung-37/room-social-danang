import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getCollectorJobStatus } from '@/lib/collector-job-lock';
import { listCollectorRuns } from '@/lib/collector-run-storage';
import { hasCollectorDatabase, listCollectorRunsDb } from '@/lib/collector-db';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const status = getCollectorJobStatus();
  let runs = listCollectorRuns(1);
  if (hasCollectorDatabase()) {
    try { runs = await listCollectorRunsDb(1); } catch { /* local history remains available */ }
  }
  return NextResponse.json({ data: { ...status, lastRun: runs[0] ?? null } });
}
