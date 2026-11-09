import { NextResponse } from 'next/server';
import { unlinkSync, existsSync } from 'fs';
import { getManagedJsonFilePath } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const { id } = await params;
    
    if (id === 'data-template' || id === 'cached-listings') {
      return NextResponse.json({ error: 'Cannot delete system files' }, { status: 403 });
    }

    const filePath = getManagedJsonFilePath(id);
    if (!filePath) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    unlinkSync(filePath);

    return NextResponse.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete file' 
    }, { status: 500 });
  }
}
