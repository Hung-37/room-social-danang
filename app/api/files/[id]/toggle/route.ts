import { NextResponse } from 'next/server';
import { getManagedJsonFilePath, writeFileSetting } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const { id } = await params;
    const { enabled } = await request.json();
    if (!getManagedJsonFilePath(id)) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });
    if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 });
    writeFileSetting(id, enabled);
    return NextResponse.json({ 
      success: true, 
      message: `File ${id} ${enabled ? 'enabled' : 'disabled'}`,
      enabled 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to toggle file' 
    }, { status: 500 });
  }
}
