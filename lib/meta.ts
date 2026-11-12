import { collectListings } from '@/lib/collector/parser.js';

export async function fetchOfficialMetaFeed() {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pageId || !accessToken) throw new Error('META_PAGE_ID và META_ACCESS_TOKEN là bắt buộc.');

  const version = process.env.META_GRAPH_VERSION ?? 'v23.0';
  const fields = 'id,message,created_time,permalink_url';
  const url = new URL(`https://graph.facebook.com/${version}/${pageId}/feed`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await response.json() as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Meta Graph API trả về HTTP ${response.status}.`);

  return collectListings((payload.data ?? []).map((item) => ({
    item: {
      id: item.id,
      title: typeof item.message === 'string' ? item.message.slice(0, 120) : 'Bài đăng Meta',
      description: item.message,
      url: item.permalink_url
    },
    source: { name: 'Meta Graph API', url: url.origin, permission: 'official_meta_api', keywords: undefined }
  })));
}