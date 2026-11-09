import { NextResponse } from 'next/server';
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { readFileSettings, SCRAPED_DATA_FILE } from '@/lib/file-storage';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const projectRoot = process.cwd();
    const dataDir = projectRoot;
    
    const jsonFiles: Array<{
      id: string;
      name: string;
      path: string;
      enabled: boolean;
      lastUpdated: string | null;
      itemCount: number;
    }> = [];
    const settings = readFileSettings();

    // Check data-template.json
    const templatePath = join(dataDir, 'data-template.json');
    if (existsSync(templatePath)) {
      const stats = statSync(templatePath);
      const content = JSON.parse(readFileSync(templatePath, 'utf-8'));
      jsonFiles.push({
        id: 'data-template',
        name: 'data-template.json',
        path: 'data-template.json',
        enabled: settings['data-template'] !== false,
        lastUpdated: stats.mtime.toISOString(),
        itemCount: Array.isArray(content) ? content.length : 0
      });
    }

    // Check cached-listings.json
    const cachePath = SCRAPED_DATA_FILE;
    if (existsSync(cachePath)) {
      const stats = statSync(cachePath);
      const content = JSON.parse(readFileSync(cachePath, 'utf-8'));
      jsonFiles.push({
        id: 'cached-listings',
        name: 'cached-listings.json',
        path: 'data/cached-listings.json',
        enabled: settings['cached-listings'] !== false,
        lastUpdated: stats.mtime.toISOString(),
        itemCount: Array.isArray(content) ? content.length : 0
      });
    }

    return NextResponse.json({ files: jsonFiles });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
