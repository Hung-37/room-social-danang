import { NextResponse } from 'next/server';
import { collectListings, DEFAULT_RELEVANCE_KEYWORDS } from '@/lib/collector/parser.js';

import { processListings } from '@/lib/listing-pipeline';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_LISTINGS = 500;

type ImportBody = { content?: unknown; format?: unknown; sourceUrl?: unknown };

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index],
      next = content[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.toLowerCase().replace(/\s+/g, '_'));
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  );
}

function parseContent(content: string, format: string): unknown[] {
  if (format === 'csv') return parseCsv(content);
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items))
    return (parsed as { items: unknown[] }).items;
  throw new Error('JSON phải là một mảng hoặc có trường items.');
}

function mapItem(item: unknown) {
  const value = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  return {
    id: value.id ?? value.externalId ?? value.external_id ?? value.url ?? value.link,
    title: value.title ?? value.tieu_de ?? value.name,
    description: value.description ?? value.summary ?? value.mo_ta ?? value.content,
    price: value.price ?? value.gia,
    area: value.area ?? value.area_m2 ?? value.dien_tich,
    address: value.address ?? value.location ?? value.dia_chi,
    url:
      value.url ??
      value.link ??
      (value.source && typeof value.source === 'object'
        ? (value.source as { url?: unknown }).url
        : undefined),
    phone:
      [value.phone, value.phone_number, value.so_dien_thoai].find(
        (item) => typeof item === 'string'
      ) ?? null,
    imageUrl:
      [value.imageUrl, value.image_url, value.image, value.thumbnail].find(
        (item) => typeof item === 'string'
      ) ?? null,
    images: value.images
  };
}

export async function POST(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const limit = rateLimit(
    `import:${request.headers.get('x-forwarded-for') ?? 'unknown'}`,
    20,
    60 * 60 * 1000
  );
  if (!limit.allowed)
    return NextResponse.json({ error: 'Import rate limit exceeded.' }, { status: 429 });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_INPUT_BYTES)
    return NextResponse.json({ error: 'Tệp hoặc nội dung tối đa 2 MB.' }, { status: 413 });
  let processing = false;
  try {
    let body: ImportBody;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      body =
        file instanceof File
          ? {
              content: await file.text(),
              format: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'
            }
          : {
              content: form.get('content'),
              format: form.get('format')
            };
      if (file instanceof File && file.size > MAX_INPUT_BYTES) throw new Error('Tệp tối đa 2 MB.');
    } else body = (await request.json()) as ImportBody;

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) throw new Error('Hãy dán nội dung hoặc tải lên một tệp.');
    const format = body.format === 'csv' ? 'csv' : 'json';
    const inputItems = parseContent(content, format).slice(0, MAX_LISTINGS).map(mapItem);
    const sourceUrl =
      typeof body.sourceUrl === 'string' && body.sourceUrl.startsWith('https://')
        ? body.sourceUrl
        : null;
    const collected = collectListings(
      inputItems.map((item) => ({
        item,
        source: {
          name: 'User import',
          url: sourceUrl ?? '',
          permission: 'manual_review',
          keywords: DEFAULT_RELEVANCE_KEYWORDS
        }
      }))
    );
    const listings = collected.listings.map((listing) => {
      const metadata = inputItems.find(
        (item) =>
          (item.url && listing.source.url === item.url) ||
          String(item.title ?? '').trim() === listing.title
        );
        return { ...listing, phone: metadata?.phone ?? null, imageUrl: metadata?.imageUrl ?? null };
    }) as Array<
        (typeof collected.listings)[number] & {
          phone?: string | null;
          imageUrl?: string | null;
        }
    >;

    processing = true;
    const result = await processListings(listings, {
        configured: 1,
        duplicates: collected.stats.duplicates
    });
    return NextResponse.json(
      {
        data: result.listings,
        stats: { ...collected.stats, rejected: collected.stats.rejected + result.rejected.length },
        saved: result.persistence.saved,
        storage: 'mysql',
        persistence: result.persistence,
        status: result.status,
        rejected: result.rejected
      },
      { status: result.persistence.status === 'error' && result.listings.length ? 503 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: processing
          ? 'Không xử lý được dữ liệu do lỗi dịch vụ/database. Kiểm tra cấu hình máy chủ.'
          : error instanceof Error
            ? error.message
            : 'Không thể xử lý dữ liệu nhập.'
      },
      { status: processing ? 503 : 400 }
    );
  }
}
