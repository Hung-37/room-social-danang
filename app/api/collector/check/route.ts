import { NextResponse } from 'next/server';
import { checkPublicSource } from '@/js/collector.js';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';
import { getManagedSourcesAsync, setSourceEnabledAsync } from '@/lib/collector-source-storage';

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const configuredSources = (await getManagedSourcesAsync()).filter((source) => source.permission !== 'manual_review');
  const results = await Promise.all(
    configuredSources.map(async (source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      permission: source.permission,
      enabled: source.enabled,
      note: source.note,
      listingSelectors: source.listingSelectors,
      result: source.permission === 'public_html' 
        ? { ok: source.enabled, status: 'ready', note: 'HTML crawler - verify source permission' }
        : source.permission === 'local_file'
        ? { ok: source.enabled, status: 'ready', note: 'Local file source - auto-enabled' }
        : await checkPublicSource(source)
    }))
  );

  return NextResponse.json({
    data: results,
    meta: {
      configured: configuredSources.length,
      policy: 'Approved public JSON/RSS feeds, HTML sources (with permission), and local file sources are eligible.'
    }
  });
}

export async function POST(request: Request) {
  if (!getAdminSessionFromRequest(request)) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const body = await request.json();
  if (typeof body.sourceId === 'string' && typeof body.enabled === 'boolean') {
    const updated = await setSourceEnabledAsync(body.sourceId, body.enabled);
    return updated ? NextResponse.json({ success: true, sourceId: body.sourceId, enabled: body.enabled }) : NextResponse.json({ error: 'Không tìm thấy nguồn.' }, { status: 404 });
  }
  const { url, selectors, enabled, name } = body;
  
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }
  
  // Tạo cấu hình HTML crawler mới
  const newSource = {
    id: `custom-${Date.now()}`,
    name: name || 'Custom HTML Source',
    type: 'html',
    url,
    permission: 'public_html',
    enabled: enabled || false,
    keywords: ['phòng trọ', 'phòng cho thuê', 'tìm phòng', 'ở ghép', 'đà nẵng'],
    listingSelectors: selectors || {
      itemSelector: 'div.listing-item',
      titleSelector: 'h2.title',
      descriptionSelector: 'div.description',
      priceSelector: 'span.price',
      areaSelector: 'span.area',
      addressSelector: 'div.address'
    },
    note: 'Nguồn HTML tùy chỉnh - cấu hình trong .env.local để persist'
  };
  
  return NextResponse.json({
    data: newSource,
    meta: {
      message: 'Thêm cấu hình sau vào .env.local để persist',
      envConfig: {
        HTML_CRAWLER_URL: url,
        HTML_ITEM_SELECTOR: selectors?.itemSelector || 'div.listing-item',
        HTML_TITLE_SELECTOR: selectors?.titleSelector || 'h2.title',
        HTML_DESCRIPTION_SELECTOR: selectors?.descriptionSelector || 'div.description',
        HTML_PRICE_SELECTOR: selectors?.priceSelector || 'span.price',
        HTML_AREA_SELECTOR: selectors?.areaSelector || 'span.area',
        HTML_ADDRESS_SELECTOR: selectors?.addressSelector || 'div.address'
      }
    }
  });
}
