import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { getManagedJsonFilePath, writeJsonAtomically } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const { id } = await params;
    const filePath = getManagedJsonFilePath(id);
    if (!filePath) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = JSON.parse(readFileSync(filePath, 'utf-8'));

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to read file' 
    }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const { id } = await params;
    const { content } = await request.json();
    const filePath = getManagedJsonFilePath(id);
    if (!filePath) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (id === 'cached-listings' && !Array.isArray(content)) {
      return NextResponse.json({ error: 'cached-listings.json phải là một mảng JSON.' }, { status: 400 });
    }
    if (id === 'data-template' && !Array.isArray(content)) {
      return NextResponse.json({ error: 'data-template.json phải là một mảng JSON.' }, { status: 400 });
    }
    writeJsonAtomically(filePath, content);

    return NextResponse.json({ 
      success: true, 
      message: 'File content saved successfully' 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to save file' 
    }, { status: 500 });
  }
}
