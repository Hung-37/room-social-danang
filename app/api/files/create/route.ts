import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getManagedJsonFilePath, writeJsonAtomically } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const { fileName, content } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const normalizedName = String(fileName).endsWith('.json') ? String(fileName) : `${fileName}.json`;
    const fileId = normalizedName.slice(0, -5);
    const filePath = getManagedJsonFilePath(fileId);
    if (!filePath || fileId === 'data-template' || fileId === 'cached-listings') {
      return NextResponse.json({ error: 'Invalid or reserved file name' }, { status: 400 });
    }
    if (existsSync(filePath)) {
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    }
    
    // Validate and format content
    let formattedContent = content;
    if (typeof content === 'string') {
      try {
        formattedContent = JSON.parse(content);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON content' }, { status: 400 });
      }
    }

    writeJsonAtomically(filePath, formattedContent);

    return NextResponse.json({ 
      success: true, 
      message: `File ${normalizedName} created successfully`,
      path: filePath
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create file' 
    }, { status: 500 });
  }
}
