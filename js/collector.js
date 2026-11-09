import { load } from 'cheerio';
import { createHash } from 'node:crypto';

/**
 * Collector cho cac nguon cong khai/duoc cap phep.
 * Khong dung cookie, token dang nhap, CAPTCHA bypass hay scraping noi dung bi gioi han.
 */

const CLUSTER_RULES = [
  { id: 'bach-khoa-su-pham', keywords: ['bách khoa', 'bach khoa', 'sư phạm', 'su pham', 'hòa khánh', 'hoa khanh', 'liên chiểu', 'lien chieu', 'nguyễn lương bằng', 'nguyen luong bang', 'tôn đức thắng', 'ton duc thang'] },
  { id: 'hoa-cuong', keywords: ['hòa cường', 'hoa cuong', 'núi thành', 'nui thanh', 'đông á', 'dong a', 'kiến trúc', 'kien truc', 'xô viết nghệ tĩnh', 'xo viet nghe tinh', 'cách mạng tháng tám', 'cach mang thang tam'] },
  { id: 'hai-chau', keywords: ['hải châu', 'hai chau', 'trung tâm', 'trung tam', 'sư phạm kỹ thuật', 'su pham ky thuat', 'lê duẩn', 'le duan', 'trưng nữ vương', 'trung nu vuong', 'thanh khê', 'thanh khe', 'hoà xuân', 'hoa xuan'] },
  { id: 'ngu-hanh-son', keywords: ['ngũ hành sơn', 'ngu hanh son', 'mỹ an', 'my an', 'mỹ khê', 'my khe', 'an thượng', 'an thuong', 'kinh tế', 'kinh te', 'fpt', 'hòa hải', 'hoa hai', 'đại học kinh tế', 'dai hoc kinh te'] },
  { id: 'nam-da-nang', keywords: ['nam đà nẵng', 'nam da nang', 'trần đại nghĩa', 'tran dai nghi', 'vku', 'việt hàn', 'viet han', 'khu đô thị đại học', 'khu do thi dai hoc', 'hòa quý', 'hoa quy', 'đại học y', 'dai hoc y', 'đại học dược', 'dai hoc duoc'] }
];

export const DEFAULT_RELEVANCE_KEYWORDS = [
  'phòng trọ', 'phong tro', 'phòng cho thuê', 'phong cho thue',
  'tìm phòng', 'tim phong', 'ở ghép', 'o ghep', 'nhà trọ', 'nha tro',
  'hòa khánh', 'hoa khanh', 'mỹ an', 'my an',
  'vku', 'bách khoa', 'bach khoa', 'đại học kinh tế', 'dai hoc kinh te',
  'room for rent', 'for rent', 'rental room', 'apartment for rent', 'boarding room'
];

function firstNumber(value) {
  const match = String(value ?? '').replace(/\./g, '').match(/[0-9]+/);
  return match ? Number(match[0]) : null;
}

function removeDiacritics(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D');
}

function parsePrice(value) {
  const text = String(value ?? '').toLowerCase().trim();
  const match = text.match(/([0-9][0-9.,]*)/);
  if (!match) return null;

  const rawNumber = match[1];
  const groups = rawNumber.split(/[.,]/);
  const usesThousandsSeparator = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
  const number = text.includes('triệu')
    ? Number(rawNumber.replace(',', '.')) * 1000000
    : text.includes('nghìn') || text.includes('ngàn')
      ? Number(rawNumber.replace(/[.,]/g, '')) * 1000
    : /\d\s*tr(?:\b|\/|$)/i.test(text)
      ? Number(rawNumber.replace(',', '.')) * 1000000
    : usesThousandsSeparator
      ? Number(rawNumber.replace(/[.,]/g, ''))
      : Number(rawNumber.replace(',', '.'));

  return Number.isFinite(number) ? Math.round(number) : null;
}

function inferCluster(text) {
  const normalized = removeDiacritics(text).toLowerCase();
  const matches = CLUSTER_RULES.flatMap((rule) => rule.keywords
    .map((keyword) => removeDiacritics(keyword).toLowerCase())
    .filter((keyword) => normalized.includes(keyword))
    .map((keyword) => ({ id: rule.id, score: keyword.length })));
  return matches.sort((left, right) => right.score - left.score)[0]?.id ?? null;
}

function resolveSourceUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;

  const baseOrigin = (
    typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000') : 'http://localhost:3000'
  ).replace(/\/$/, '');

  try {
    return new URL(raw, `${baseOrigin}/`).href;
  } catch {
    return raw;
  }
}

function toAbsoluteUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), baseUrl || undefined);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function isPublicFeedUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const reservedDomain = hostname === 'example.com'
      || hostname.endsWith('.example.com')
      || hostname === 'example.org'
      || hostname.endsWith('.example.org')
      || hostname === 'example.net'
      || hostname.endsWith('.example.net')
      || ['.example', '.invalid', '.test', '.localhost', '.local', '.internal', '.lan'].some((suffix) => hostname.endsWith(suffix));
    const privateAddress = hostname === 'localhost'
      || hostname === '::1'
      || hostname === '::'
      || /^::ffff:(?:0|10|127|169\.254|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./i.test(hostname)
      || /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i.test(hostname)
      || /^(?:fc|fd|fe80:)/i.test(hostname);

    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !reservedDomain
      && !privateAddress;
  } catch {
    return false;
  }
}

export function isPlaceholderListingUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'example.com'
      || hostname.endsWith('.example.com')
      || hostname === 'example.org'
      || hostname.endsWith('.example.org')
      || hostname === 'example.net'
      || hostname.endsWith('.example.net')
      || ['.example', '.invalid', '.test'].some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function sanitizeListingSummary(value) {
  return String(value ?? '')
    .replace(/(?:\+?84|0)\d[\d* .()-]{7,12}(?=\s|$)/g, ' ')
    .replace(/(?:hiện\s+số|nhắn\s+zalo|gọi\s+ngay)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImageUrl(item, baseUrl) {
  const seen = new Set();
  const candidateStack = [
    item?.imageUrl, item?.image_url, item?.image, item?.thumbnail,
    item?.imageSrc, item?.image_src, item?.featuredImage, item?.cover,
    item?.avatar, item?.logo, item?.ogImage, item?.og_image,
    item?.media?.image, item?.media?.thumbnail, item?.media?.contentUrl,
    item?.media?.url, item?.picture, item?.photos, item?.gallery,
    ...(Array.isArray(item?.images) ? item.images : []),
    ...(Array.isArray(item?.photos) ? item.photos : []),
    ...(Array.isArray(item?.gallery) ? item.gallery : [])
  ];

  const collectNested = (value) => {
    if (!value || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return;
    if (Array.isArray(value)) {
      value.forEach(collectNested);
      return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
      if (typeof nestedValue === 'string' || typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
        if (/(image|img|photo|thumbnail|avatar|cover|featured|media)/i.test(key)) {
          candidateStack.push(nestedValue);
        }
      } else {
        collectNested(nestedValue);
      }
    }
  };

  collectNested(item);

  for (const candidate of candidateStack) {
    if (candidate === null || candidate === undefined) continue;
    const normalized = typeof candidate === 'object'
      ? candidate.url ?? candidate.src ?? candidate.contentUrl ?? candidate.href ?? candidate.image ?? candidate.link ?? candidate.thumbnailUrl ?? candidate.large ?? candidate.medium
      : candidate;

    const raw = String(normalized ?? '').trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);

    const imageCandidates = raw.includes(',')
      ? raw.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean)
      : [raw];
    for (const imageCandidate of imageCandidates) {
      const url = toAbsoluteUrl(imageCandidate, baseUrl);
      if (url) return url;
    }
  }

  return null;
}

export function isRelevantListing(item, keywords = DEFAULT_RELEVANCE_KEYWORDS) {
  const title = String(item?.title ?? '').trim().toLowerCase();
  const description = String(item?.description ?? item?.summary ?? item?.content ?? '').trim().toLowerCase();
  const haystack = `${title} ${description}`;
  return Boolean(title) && keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function normalizeListing(item, source) {
  const text = [item.title, item.description, item.address].filter(Boolean).join(' ');
  const price = parsePrice(item.price);
  const area = firstNumber(item.area);
  const sourceBaseUrl = resolveSourceUrl(source.url);
  const listingUrl = toAbsoluteUrl(item.url ?? source.url, sourceBaseUrl || source.url);
  const sourceId = String(source.id ?? source.name ?? sourceBaseUrl);
  const rawExternalId = String(item.id ?? item.externalId ?? item.external_id ?? item.url ?? item.title);
  const externalId = `${sourceId}:${createHash('sha256').update(rawExternalId).digest('hex').slice(0, 32)}`;

  const normalized = {
    externalId,
    title: String(item.title ?? 'Bài đăng chưa có tiêu đề').trim(),
    summary: String(item.description ?? '').trim(),
    price,
    area,
    address: item.address ?? null,
    clusterId: inferCluster(text) ?? 'chua-phan-cum',
    imageUrl: firstImageUrl(item, listingUrl ?? sourceBaseUrl ?? source.url),
    source: {
      name: source.name,
      url: listingUrl,
      collectedAt: new Date().toISOString(),
      permission: source.permission ?? 'unknown'
    },
    verificationStatus: 'needs_review',
    trustScore: 20
  };

  return normalized;
}

function isUsableListing(listing) {
  return listing.title.length >= 8 && (listing.price !== null || listing.area !== null || listing.address !== null);
}

export function deduplicateListings(listings) {
  const unique = new Map();
  for (const listing of listings) {
    const title = removeDiacritics(listing.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = title && (listing.price !== null || listing.area !== null)
      ? `listing:${title}|${listing.price ?? ''}|${listing.area ?? ''}|${listing.clusterId ?? ''}`
      : `source:${listing.externalId || listing.source.url || title}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, listing);
      continue;
    }

    const preferred = listing.summary.length > existing.summary.length ? listing : existing;
    unique.set(key, {
      ...preferred,
      verificationStatus: existing.verificationStatus === 'verified' || listing.verificationStatus === 'verified'
        ? 'verified'
        : preferred.verificationStatus,
      trustScore: Math.max(existing.trustScore, listing.trustScore)
    });
  }
  return [...unique.values()];
}

export function collectListings(listings) {
  const normalized = listings
    .filter(({ item, source }) => isRelevantListing(item, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS))
    .map(({ item, source }) => normalizeListing(item, source));
  const valid = normalized.filter(isUsableListing);
  const irrelevant = listings.length - normalized.length;
  const unique = deduplicateListings(valid);

  return {
    listings: unique,
    stats: {
      received: listings.length,
      rejected: normalized.length - valid.length,
      irrelevant,
      duplicates: valid.length - unique.length,
      needsReview: unique.filter((listing) => listing.verificationStatus === 'needs_review').length
    }
  };
}

export async function fetchPublicListings(source, fetchImpl = fetch) {
  if (!source?.url) throw new Error('Nguon phai co URL cong khai.');
  if (source.permission !== 'public_api' && source.permission !== 'public_feed') {
    throw new Error('Chi cho phep nguon public_api hoac public_feed.');
  }

  const sourceUrl = resolveSourceUrl(source.url);
  const response = await fetchImpl(sourceUrl, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json, application/rss+xml, application/xml, text/xml' }
  });
  if (!response.ok) throw new Error(`Nguon tra ve HTTP ${response.status}.`);
  const contentType = response.headers?.get?.('content-type') ?? '';
  const body = await response.text();
  if (body.length > 4 * 1024 * 1024) throw new Error('Nguồn trả về vượt quá giới hạn 4 MB.');

  if (contentType.includes('xml') || body.trim().startsWith('<')) {
    return parseRssListings(body, source).filter((listing) => isRelevantListing(listing, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS));
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('Nguon phai tra ve JSON hoac RSS/XML hop le.');
  }
  const items = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(items)) throw new Error('JSON nguon phai la mang hoac co truong items.');
  return items
    .filter((item) => isRelevantListing(item, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS))
    .map((item) => normalizeListing(item, source));
}

export async function checkPublicSource(source, fetchImpl = fetch) {
  if (!source?.url) return { ok: false, status: 'invalid', reason: 'missing_url' };

  try {
    const sourceUrl = resolveSourceUrl(source.url);
    const response = await fetchImpl(sourceUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { Accept: 'application/json, application/rss+xml, application/xml, text/xml' }
    });

    const contentType = response.headers?.get?.('content-type') ?? '';
    if (!response.ok) {
      return { ok: false, status: 'blocked', httpStatus: response.status, contentType };
    }

    const isMachineReadable = contentType.includes('json') || contentType.includes('xml') || contentType.includes('rss');
    return {
      ok: isMachineReadable,
      status: isMachineReadable ? 'ready' : 'manual_review',
      httpStatus: response.status,
      contentType,
      reason: isMachineReadable ? null : 'source_is_html_or_unknown_format'
    };
  } catch (error) {
    return { ok: false, status: 'unreachable', reason: error instanceof Error ? error.message : 'unknown_error' };
  }
}

export function parseRssListings(xml, source) {
  const decode = (value) => String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  const getTag = (content, tag) => {
    const match = content.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
    return match?.[1] ?? '';
  };
  const getAttribute = (content, tag, attribute) => {
    const match = content.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*\\/?\\s*>`, 'i'));
    return match?.[1] ?? '';
  };
  const blocks = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)\s*>/gi) ?? [];

  return blocks.map((block) => {
    const encodedContent = getTag(block, 'content:encoded') || getTag(block, 'content') || getTag(block, 'description') || getTag(block, 'summary');
    const linkTag = block.match(/<link\b[^>]*\/?\s*>/i)?.[0] ?? '';
    const mediaTag = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\/?\s*>/i)?.[0] ?? '';
    const mediaType = mediaTag.match(/^<([\w:]+)/)?.[1] ?? 'media:content';
    const imageFromMarkup = encodedContent.match(/<(?:img|source)\b[^>]*\b(?:src|data-src|data-original)=["']([^"']+)["']/i)?.[1];
    const link = getAttribute(linkTag, 'link', 'href') || decode(getTag(block, 'link'));
    const imageUrl = getAttribute(mediaTag, mediaType, 'url') || imageFromMarkup;

    return normalizeListing({
      title: decode(getTag(block, 'title')),
      description: decode(encodedContent),
      url: link,
      id: decode(getTag(block, 'guid')) || decode(getTag(block, 'id')) || link,
      imageUrl
    }, source);
  });
}

export const collectorPolicy = {
  allowed: ['API cong khai', 'RSS/feed duoc cap phep', 'du lieu do chu tro gui', 'website cho phep truy cap'],
  blocked: ['noi dung sau dang nhap', 'vuot CAPTCHA', 'lay thong tin ca nhan', 'bo qua robots.txt/terms'],
  reviewRequired: true
};

function flattenPayloadItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const value = payload;
  for (const key of ['items', 'data', 'results', 'listings', 'posts', 'properties', 'rooms']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [value];
}

function structuredType(value) {
  const type = value?.['@type'];
  return Array.isArray(type) ? type.join(' ') : String(type ?? '');
}

function structuredAddress(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return null;
  return [value.streetAddress, value.addressLocality, value.addressRegion, value.addressCountry]
    .filter(Boolean).join(', ') || null;
}

function structuredToListing(item, baseUrl) {
  if (!item || typeof item !== 'object') return null;
  const offer = item.offers && typeof item.offers === 'object' && !Array.isArray(item.offers) ? item.offers : {};
  const area = item.floorSize?.value ?? item.floorSize ?? item.area ?? item.size ?? item.area_m2;
  const image = item.image ?? item.photo ?? item.thumbnailUrl;
  return {
    id: item.url ?? item['@id'] ?? item.id ?? item.sku,
    title: item.name ?? item.headline ?? item.title,
    description: item.description ?? item.articleBody ?? item.summary,
    price: item.price ?? item.priceRange ?? offer.price,
    area,
    address: structuredAddress(item.address ?? item.location),
    url: toAbsoluteUrl(item.url ?? item['@id'], baseUrl),
    imageUrl: firstImageUrl({ image, images: item.images, photo: item.photo }, baseUrl)
  };
}

function parseJsonLdListings($, source) {
  const result = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const parsed = JSON.parse($(script).text());
      const values = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ?? [parsed];
      for (const value of values) {
        const type = structuredType(value).toLowerCase();
        if (!/(product|offer|residence|apartment|house|accommodation|article|realestate|lodging)/i.test(type) && !value?.name) continue;
        const item = structuredToListing(value, source.url);
        if (item?.title) result.push(item);
      }
    } catch {
      // Một trang có thể có nhiều JSON-LD, chỉ bỏ qua khối hỏng.
    }
  });
  return result;
}

function metaValue($, selector) {
  return String($(selector).first().attr('content') ?? '').trim() || null;
}

function genericCardToListing($, element, source) {
  const card = $(element);
  const text = textWithElementSpacing($, element);
  const title = card.find('h1,h2,h3,h4,[itemprop="name"],[class*="title"],[class*="name"]').first().text().trim()
    || card.find('a[title]').first().attr('title')
    || card.find('a').first().text().trim();
  const link = card.find('a[href]').first().attr('href');
  const price = text.match(/(?:\d[\d.,]*\s*(?:triệu|tr|nghìn|ngàn|đồng|đ)\b|\d[\d.,]*\s*\/\s*tháng)/i)?.[0] ?? null;
  const area = text.match(/\d+(?:[.,]\d+)?\s*m(?:²|2)(?!\d)/i)?.[0] ?? null;
  const image = imageFromElement($, element, source.url);
  const address = card.find('[itemprop="address"],[class*="address"],[class*="location"],address').first().text().trim() || null;
  const description = card.find('[itemprop="description"],p,[class*="description"],[class*="content"]').first().text().trim() || text;
  if (!title || text.length < 12) return null;
  return { id: link || title, title, description, price, area, address, url: link, imageUrl: image };
}

export function parseGenericHtmlListings(html, source) {
  const $ = load(html);
  const raw = [...parseJsonLdListings($, source)];
  const candidates = new Set();
  $('article,[itemtype*="Product"],[itemtype*="Residence"],[itemtype*="Apartment"],[class*="listing"],[class*="property"],[class*="product"],[class*="room"],[class*="post"],[data-testid*="listing"]').each((_, element) => candidates.add(element));
  if (candidates.size === 0) $('main').find('a[href]').each((_, element) => candidates.add($(element).closest('article,div,li').get(0) ?? element));
  for (const element of candidates) {
    const item = genericCardToListing($, element, source);
    if (item) raw.push(item);
  }

  if (raw.length === 0) {
    const title = metaValue($, 'meta[property="og:title"]') || $('title').first().text().trim();
    const description = metaValue($, 'meta[property="og:description"]') || metaValue($, 'meta[name="description"]') || $('main').text().replace(/\s+/g, ' ').trim();
    const imageUrl = metaValue($, 'meta[property="og:image"]');
    const canonical = $('link[rel="canonical"]').attr('href') || source.url;
    if (title && description) raw.push({ id: canonical, title, description, url: canonical, imageUrl });
  } else {
    const pageImage = metaValue($, 'meta[property="og:image"]');
    if (pageImage && raw[0] && !raw[0].imageUrl) raw[0].imageUrl = pageImage;
  }

  const filtered = raw
    .filter((item) => isRelevantListing(item, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS))
    .map((item) => normalizeListing(item, source));
  return deduplicateListings(filtered);
}

export async function checkRobotsAllowed(value, fetchImpl = fetch) {
  const sourceUrl = new URL(String(value));
  const robotsUrl = `${sourceUrl.origin}/robots.txt`;
  try {
    const response = await fetchImpl(robotsUrl, { signal: AbortSignal.timeout(5000), headers: { Accept: 'text/plain' } });
    if (!response.ok) return { allowed: true, checked: false, warning: `Không đọc được robots.txt (HTTP ${response.status}).` };
    const lines = (await response.text()).split(/\r?\n/);
    let applies = false;
    const disallow = [];
    for (const line of lines) {
      const value = line.replace(/#.*$/, '').trim();
      const [key, rawRule = ''] = value.split(':', 2);
      if (!key) continue;
      if (key.toLowerCase() === 'user-agent') applies = rawRule.trim() === '*' || rawRule.trim().toLowerCase() === 'roomdanganhcollector';
      if (key.toLowerCase() === 'disallow' && applies && rawRule.trim()) disallow.push(rawRule.trim());
    }
    const path = `${sourceUrl.pathname}${sourceUrl.search}`;
    const blocked = disallow.some((rule) => path.startsWith(rule.replace(/\*+$/, '')));
    return { allowed: !blocked, checked: true, warning: blocked ? 'robots.txt không cho phép truy cập đường dẫn này.' : null };
  } catch (error) {
    return { allowed: true, checked: false, warning: error instanceof Error ? `Không kiểm tra được robots.txt: ${error.message}` : 'Không kiểm tra được robots.txt.' };
  }
}

function nextPageUrlFromBody(body, contentType, currentUrl) {
  try {
    if (contentType.includes('json') || /^[\s]*[\[{]/.test(body)) {
      const payload = JSON.parse(body);
      const links = payload && typeof payload === 'object' ? payload.links : null;
      const next = payload?.next ?? payload?.next_url ?? payload?.nextPage ?? links?.next;
      return toAbsoluteUrl(typeof next === 'object' ? next?.href ?? next?.url : next, currentUrl);
    }
  } catch {
    return null;
  }
  const $ = load(body);
  const next = $('link[rel="next"], a[rel="next"], a[aria-label*="next" i], a[aria-label*="sau" i], a.next, a.next-page, .pagination a:last-child').first().attr('href');
  return toAbsoluteUrl(next, currentUrl);
}

export async function fetchGenericUrlListings(url, fetchImpl = fetch, options = {}) {
  if (!isPublicFeedUrl(url)) throw new Error('URL phải là HTTPS công khai, không chứa thông tin đăng nhập và không trỏ tới mạng nội bộ.');
  const maxPages = Math.min(20, Math.max(1, Number(options.maxPages ?? 1) || 1));
  const origin = new URL(url).origin;
  let currentUrl = url;
  const visited = new Set();
  const allListings = [];
  const warnings = [];
  let format = 'html';
  let firstRobots = { allowed: true, checked: false, warning: null };

  for (let page = 0; page < maxPages && currentUrl; page += 1) {
    if (visited.has(currentUrl)) break;
    if (new URL(currentUrl).origin !== origin) break;
    visited.add(currentUrl);
    const robots = await checkRobotsAllowed(currentUrl, fetchImpl);
    if (page === 0) firstRobots = robots;
    if (robots.warning) warnings.push(`${currentUrl}: ${robots.warning}`);
    if (!robots.allowed) break;
    const response = await fetchImpl(currentUrl, {
      redirect: 'follow', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json, application/rss+xml, application/xml, text/xml, text/html;q=0.9,*/*;q=0.8', 'User-Agent': 'RoomDaNangCollector/1.0 (+public-data-review)' }
    });
    if (!response.ok) throw new Error(`Nguồn trả về HTTP ${response.status} tại trang ${page + 1}.`);
    const body = await response.text();
    if (body.length > 8 * 1024 * 1024) throw new Error('Nguồn trả về vượt quá giới hạn 8 MB.');
    const contentType = response.headers?.get?.('content-type') ?? '';
    if (page === 0) format = contentType.includes('json') || /^[\s]*[\[{]/.test(body) ? 'json' : contentType.includes('xml') || /<rss\b|<feed\b|<channel\b/i.test(body) ? 'rss' : 'html';
    const pageUrl = new URL(currentUrl);
    const source = { id: `url:${pageUrl.hostname}`, name: pageUrl.hostname, url: currentUrl, permission: format === 'html' ? 'public_html' : 'public_feed', keywords: DEFAULT_RELEVANCE_KEYWORDS };
    if (format === 'json') {
      const payload = JSON.parse(body);
      allListings.push(...flattenPayloadItems(payload).filter((item) => isRelevantListing(item, source.keywords)).map((item) => normalizeListing(item, source)));
    } else if (format === 'rss') {
      allListings.push(...parseRssListings(body, source).filter((item) => isRelevantListing(item, source.keywords)));
    } else {
      allListings.push(...parseGenericHtmlListings(body, source));
    }
    const next = nextPageUrlFromBody(body, contentType, currentUrl);
    currentUrl = next && new URL(next).origin === origin ? next : null;
  }

  return { listings: deduplicateListings(allListings), format, robots: firstRobots, pages: visited.size, warnings };
}

/**
 * Parser HTML đơn giản dùng regex/string methods
 * Không phụ thuộc vào DOMParser hoặc các thư viện bên ngoài
 */
function parseHtmlListings(html, source) {
  const listings = [];
  const listingSelectors = source.listingSelectors || {};
  const itemSelector = listingSelectors.itemSelector || 'div.listing-item, div.product-item, div.item';
  const items = findHtmlElements(html, itemSelector);

  for (const itemHtml of items) {
    try {
      const listing = parseSingleListing(itemHtml, source, listingSelectors);
      if (listing && isRelevantListing(listing, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS)) {
        listings.push(normalizeListing(listing, source));
      }
    } catch (error) {
      console.warn('Failed to parse listing item:', error);
    }
  }
  
  return listings;
}

function matchingHtmlElementEnd(html, tag, contentStart) {
  const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = contentStart;
  let depth = 1;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith('</')) depth -= 1;
    else if (!match[0].endsWith('/>')) depth += 1;
    if (depth === 0) return tagPattern.lastIndex;
  }
  return -1;
}

function findHtmlElements(html, selectors) {
  const found = [];
  const selectorList = String(selectors).split(',').map((selector) => selector.trim()).filter(Boolean);

  for (const selector of selectorList) {
    const parsed = selector.match(/^(?:([a-z][\w-]*)\s*)?(?:\.([\w-]+))?$/i);
    if (!parsed || (!parsed[1] && !parsed[2])) continue;
    const tagPattern = parsed[1] ?? '[a-z][\\w-]*';
    const className = parsed[2];
    const openPattern = new RegExp(`<(${tagPattern})\\b([^>]*)>`, 'gi');
    let match;

    while ((match = openPattern.exec(html))) {
      const elementClasses = match[2].match(/\bclass=["']([^"']*)["']/i)?.[1].split(/\s+/) ?? [];
      if (className && !elementClasses.includes(className)) continue;
      const end = matchingHtmlElementEnd(html, match[1], openPattern.lastIndex);
      if (end < 0) continue;
      const item = html.slice(match.index, end);
      if (!found.some((existing) => existing.start === match.index)) found.push({ start: match.index, item });
    }
  }

  return found.sort((left, right) => left.start - right.start).map(({ item }) => item);
}

function htmlText(value) {
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSingleListing(html, source, selectors) {
  const extractText = (selector) => findHtmlElements(html, selector).map(htmlText).find(Boolean) ?? null;
  const extractAttribute = (attribute, tag = 'a') => {
    return html.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']*)["'][^>]*>`, 'i'))?.[1] ?? null;
  };
  const imageUrl = extractAttribute('src', 'img')
    || extractAttribute('data-src', 'img')
    || extractAttribute('data-lazy-src', 'img')
    || extractAttribute('data-original', 'img')
    || extractAttribute('srcset', 'img')?.split(',')[0].trim().split(/\s+/)[0]
    || extractAttribute('src', 'source')
    || extractAttribute('srcset', 'source')?.split(',')[0].trim().split(/\s+/)[0];
  
  return {
    title: extractText(selectors.titleSelector || 'h2.title, h2, h3, .title'),
    description: extractText(selectors.descriptionSelector || '.description, .content, p'),
    price: extractText(selectors.priceSelector || '.price'),
    area: extractText(selectors.areaSelector || '.area'),
    address: extractText(selectors.addressSelector || '.address'),
    url: extractAttribute('href') || extractAttribute('data-url'),
    id: extractAttribute('data-id') || extractAttribute('id'),
    imageUrl
  };
}

export async function fetchHtmlListings(source, fetchImpl = fetch) {
  if (!source?.url) throw new Error('Nguon phai co URL cong khai.');
  if (source.permission !== 'public_html') {
    throw new Error('Chi cho phep nguon public_html.');
  }

  const robots = await checkRobotsAllowed(source.url, fetchImpl);
  if (!robots.allowed) throw new Error('robots.txt không cho phép truy cập nguồn này.');

  const response = await fetchImpl(source.url, {
    signal: AbortSignal.timeout(15000),
    headers: { 
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'RoomDaNangCollector/1.0'
    }
  });
  
  if (!response.ok) throw new Error(`Nguon tra ve HTTP ${response.status}.`);
  const html = await response.text();
  if (html.length > 8 * 1024 * 1024) throw new Error('Nguồn HTML trả về vượt quá giới hạn 8 MB.');

  const adapter = HTML_SOURCE_ADAPTERS[source.id];
  if (adapter) return parseKnownSourceListings(html, source, adapter);

  return parseHtmlListings(html, source);
}

const HTML_SOURCE_ADAPTERS = {
  'phongtro123-da-nang': { listingPath: /\/[^/]+-pr\d+\.html$/i },
  // Trọ Mới currently uses both numeric and slug-only detail URLs.
  'tromoi-da-nang': { listingPath: /\/phong-tro\/[^/?#]+\/?$/i },
  'thuephongtro-da-nang': { listingPath: /\/[^/]+-\d+\.html$/i }
};

const DISTRICT_NAMES = [
  'Cẩm Lệ', 'Hải Châu', 'Hòa Vang', 'Liên Chiểu', 'Ngũ Hành Sơn', 'Sơn Trà', 'Thanh Khê',
  'Hòa Khánh', 'Hòa Minh', 'Hòa Xuân', 'Hòa Hải', 'Hòa Quý', 'Mỹ An', 'An Hải', 'Hòa Cường'
];

function parseListingDate(value) {
  const match = String(value ?? '').match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function textWithElementSpacing($, element) {
  const clone = $(element).clone();
  clone.find('*').each((_, nestedElement) => {
    $(nestedElement).prepend(' ').append(' ');
  });
  return clone.text().replace(/\s+/g, ' ').trim();
}

function normalizeListingUrl(value, baseUrl) {
  const absoluteUrl = toAbsoluteUrl(value, baseUrl);
  if (!absoluteUrl) return null;
  const url = new URL(absoluteUrl);
  url.hash = '';
  url.search = '';
  return url.href;
}

function readStructuredListings($, source, adapter) {
  const listings = new Map();
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const parsed = JSON.parse($(script).text());
      const items = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ?? [parsed];
      for (const item of items) {
        if (!item || typeof item !== 'object' || typeof item.url !== 'string') continue;
        const url = normalizeListingUrl(item.url, source.url);
        if (!url || !adapter.listingPath.test(new URL(url).pathname)) continue;
        listings.set(url, {
          title: typeof item.name === 'string' ? item.name.trim() : null,
          description: typeof item.description === 'string' ? item.description.trim() : null,
          price: item.priceRange ?? item.offers?.price ?? null,
          area: item.floorSize?.value ?? item.floorSize ?? item.area ?? null,
          address: typeof item.address?.streetAddress === 'string' ? item.address.streetAddress.trim() : null,
          imageUrl: firstImageUrl({ image: item.image, images: item.images, thumbnail: item.thumbnailUrl }, url)
        });
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue parsing visible listing cards.
    }
  });
  return listings;
}

function imageFromElement($, element, baseUrl) {
  const candidates = [];
  $(element).find('img, source').addBack('img, source').each((_, image) => {
    for (const attribute of ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-image', 'srcset']) {
      const value = $(image).attr(attribute);
      if (value) candidates.push(value);
    }
  });
  for (const candidate of candidates) {
    const values = String(candidate).split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
    for (const value of values) {
      const url = toAbsoluteUrl(value, baseUrl);
      if (url) return url;
    }
  }
  return null;
}

function imageNearElement($, element, baseUrl) {
  let current = $(element);
  for (let depth = 0; depth < 8 && current.length; depth += 1) {
    const imageUrl = imageFromElement($, current, baseUrl);
    if (imageUrl) return imageUrl;
    current = current.parent();
  }
  return null;
}

function parseKnownSourceListings(html, source, adapter) {
  const $ = load(html);
  const candidates = new Map();
  const structuredListings = readStructuredListings($, source, adapter);

  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    const url = toAbsoluteUrl(href, source.url);
    if (!url) return;

    const parsedUrl = new URL(url);
    if (!adapter.listingPath.test(parsedUrl.pathname)) return;
    parsedUrl.hash = '';
    parsedUrl.search = '';
    candidates.set(parsedUrl.href, anchor);
  });

  const listings = [];
  for (const [url, anchor] of candidates) {
    const structured = structuredListings.get(url);
    let card = $(anchor);
    let cardText = '';
    for (let depth = 0; depth < 7; depth += 1) {
      const text = textWithElementSpacing($, card);
      const listingLinks = new Set(card.find('a[href]').toArray()
        .map((link) => toAbsoluteUrl($(link).attr('href'), source.url))
        .filter((link) => link && adapter.listingPath.test(new URL(link).pathname))
        .map((link) => {
          const normalized = new URL(link);
          normalized.hash = '';
          normalized.search = '';
          return normalized.href;
        }));

      if (text.length >= 20 && text.length <= 1800 && listingLinks.size === 1) {
        cardText = text;
        break;
      }
      card = card.parent();
    }

    const title = $(anchor).text().replace(/\s+/g, ' ').trim()
      || structured?.title
      || String($(anchor).attr('title') ?? '').trim();
    const description = structured?.description || cardText;
    const relevanceText = `${title} ${description} ${structured?.address ?? ''} ${cardText}`;
    if (!title || !cardText || !isRelevantListing({ title, description: relevanceText }, source.keywords)) continue;

    const publishedDate = parseListingDate(cardText);
    if (publishedDate && Date.now() - publishedDate.getTime() > 180 * 24 * 60 * 60 * 1000) continue;

    const priceText = String(structured?.price ?? '').trim()
      || cardText.match(/(?:từ\s*)?\d[\d.,]*\s*(?:triệu|tr|nghìn|ngàn)(?:\s*đồng)?(?:\s*\/\s*tháng)?/i)?.[0]
      || cardText.match(/\d[\d.,]*\s*(?:đồng|đ)\s*\/\s*tháng/i)?.[0]
      || null;
    const areaText = String(structured?.area ?? '').trim()
      || description.match(/\d+(?:[.,]\d+)?\s*m(?:²|2)(?!\d)/i)?.[0]
      || cardText.match(/\d+(?:[.,]\d+)?\s*m(?:²|2)(?!\d)/i)?.[0]
      || null;
    const normalizedText = removeDiacritics(`${cardText} ${structured?.address ?? ''}`).toLowerCase();
    const district = DISTRICT_NAMES.find((name) => normalizedText.includes(removeDiacritics(name).toLowerCase()));
    if (!district) continue;
    const address = structured?.address
      ? structured.address
      : `${district}, Đà Nẵng`;
    const summary = sanitizeListingSummary(description || [priceText, areaText, address].filter(Boolean).join(' · '));
    if (!priceText && !areaText) continue;

    listings.push(normalizeListing({
      id: url,
      title,
      description: summary,
      price: structured?.price ?? priceText,
      area: areaText,
      address,
      url,
      imageUrl: structured?.imageUrl || imageNearElement($, anchor, url)
    }, source));
  }

  return deduplicateListings(listings);
}

/**
 * Fetch local file data (for auto-enabled template source)
 */
export async function fetchLocalFileData(source, fetchImpl = fetch) {
  if (source.permission !== 'local_file') {
    throw new Error('Chi cho phep nguon local_file.');
  }

  try {
    const storage = await import('@/lib/file-storage');
    if (storage.readFileSettings()[source.id] === false) return [];
    const data = storage.readTemplateListings();
    if (!Array.isArray(data)) throw new Error('File template phai la mang JSON.');
    
    return data
      .filter((item) => item && typeof item === 'object' && !isPlaceholderListingUrl(String(item.url ?? item.sourceUrl ?? '')))
      .filter((item) => isRelevantListing(item, source.keywords ?? DEFAULT_RELEVANCE_KEYWORDS))
      .map((item) => normalizeListing({
      ...item,
      id: item.id ?? item.externalId,
      description: item.description ?? item.summary,
      url: item.url ?? item.sourceUrl,
      imageUrl: item.imageUrl
      }, source));
  } catch (error) {
    console.error('Failed to load local template:', error);
    throw error;
  }
}

function parseConfiguredUrls(...values) {
  return [...new Set(
    values
      .filter(Boolean)
      .flatMap((value) => String(value).split(',').map((part) => part.trim()).filter(Boolean))
  )];
}

const configuredJsonUrls = parseConfiguredUrls(
  typeof process !== 'undefined' ? process.env.PUBLIC_FEED_URLS : '',
  typeof process !== 'undefined' ? process.env.PUBLIC_FEED_URL : '',
  '/data-template.json'
);

const configuredRssUrls = parseConfiguredUrls(
  typeof process !== 'undefined' ? process.env.PUBLIC_RSS_URLS : '',
  typeof process !== 'undefined' ? process.env.PUBLIC_RSS_URL : ''
);

const configuredJsonSources = configuredJsonUrls.map((url, index) => ({
  id: `approved-json-feed-${index + 1}`,
  name: `Nguon JSON cong khai ${index + 1}`,
  type: 'json',
  url,
  permission: 'public_api',
  enabled: isPublicFeedUrl(url),
  keywords: DEFAULT_RELEVANCE_KEYWORDS,
  note: isPublicFeedUrl(url)
    ? 'Feed HTTPS công khai đã cấu hình.'
    : 'Nguồn bị tắt: chỉ nhận HTTPS công khai, không nhận localhost hoặc domain mẫu.'
}));

const configuredRssSources = configuredRssUrls.map((url, index) => ({
  id: `approved-rss-feed-${index + 1}`,
  name: `RSS phong tro duoc cap phep ${index + 1}`,
  type: 'rss',
  url,
  permission: 'public_feed',
  enabled: isPublicFeedUrl(url),
  keywords: DEFAULT_RELEVANCE_KEYWORDS,
  note: isPublicFeedUrl(url)
    ? 'Feed HTTPS công khai đã cấu hình.'
    : 'Nguồn bị tắt: chỉ nhận HTTPS công khai, không nhận localhost hoặc domain mẫu.'
}));

export const publicSources = [
  {
    id: 'data-template',
    name: 'Dữ liệu mẫu nội bộ',
    type: 'file',
    url: '/data-template.json',
    permission: 'local_file',
    enabled: typeof process !== 'undefined'
      ? (process.env.NODE_ENV !== 'production' || process.env.COLLECTOR_INCLUDE_DEMO === 'true')
      : true,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Đọc file data-template.json nội bộ; tin vẫn cần kiểm duyệt.'
  },
  {
    id: 'phongtro123-da-nang',
    name: 'Phongtro123 · Đà Nẵng',
    type: 'html',
    url: 'https://phongtro123.com/tinh-thanh/da-nang',
    permission: 'public_html',
    enabled: true,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Chỉ lưu dữ kiện tin và đường dẫn nguồn; tin chờ duyệt.'
  },
  {
    id: 'tromoi-da-nang',
    name: 'Trọ Mới · Đà Nẵng',
    type: 'html',
    url: 'https://tromoi.com/phong-tro-tai-da-nang',
    permission: 'public_html',
    enabled: true,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Chỉ lưu dữ kiện tin và đường dẫn nguồn; tin chờ duyệt.'
  },
  {
    id: 'thuephongtro-da-nang',
    name: 'Thuephongtro · Đà Nẵng',
    type: 'html',
    url: 'https://thuephongtro.com/cho-thue-phong-tro-da-nang',
    permission: 'public_html',
    enabled: true,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Nguồn yêu cầu ghi rõ attribution; chỉ lưu dữ kiện tin và đường dẫn nguồn.'
  },
  {
    id: 'approved-public-page-feed',
    name: 'Public page/group feed duoc phep',
    type: 'json_or_rss',
    url: '',
    permission: 'public_feed',
    enabled: false,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Dien URL API/RSS cong khai cua page/group sau khi xac nhan quyen tich hop.'
  },
  {
    id: 'cafeland-manual-review',
    name: 'Nhà đất CafeLand',
    type: 'html',
    url: 'https://nhadat.cafeland.vn/cho-thue/phong-tro/',
    permission: 'manual_review',
    enabled: false,
    note: 'Có trang công khai nhưng chưa xác nhận API/RSS hoặc quyền tự động thu thập; không bật crawler HTML.'
  },
  ...configuredJsonSources,
  ...configuredRssSources,
  {
    id: 'custom-html-source',
    name: 'Nguon HTML tùy chỉnh',
    type: 'html',
    url: typeof process !== 'undefined' ? (process.env.HTML_CRAWLER_URL ?? '') : '',
    permission: 'public_html',
    enabled: typeof process !== 'undefined' ? Boolean(process.env.HTML_CRAWLER_URL) : false,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    listingSelectors: {
      itemSelector: typeof process !== 'undefined' ? (process.env.HTML_ITEM_SELECTOR || 'div.listing-item') : 'div.listing-item',
      titleSelector: typeof process !== 'undefined' ? (process.env.HTML_TITLE_SELECTOR || 'h2.title') : 'h2.title',
      descriptionSelector: typeof process !== 'undefined' ? (process.env.HTML_DESCRIPTION_SELECTOR || 'div.description') : 'div.description',
      priceSelector: typeof process !== 'undefined' ? (process.env.HTML_PRICE_SELECTOR || 'span.price') : 'span.price',
      areaSelector: typeof process !== 'undefined' ? (process.env.HTML_AREA_SELECTOR || 'span.area') : 'span.area',
      addressSelector: typeof process !== 'undefined' ? (process.env.HTML_ADDRESS_SELECTOR || 'div.address') : 'div.address'
    },
    note: 'Cấu hình HTML selectors trong .env.local cho nguồn đã cho phép truy cập.'
  },
  {
    id: 'demo-file-source',
    name: 'Demo - Import từ file',
    type: 'file',
    url: '',
    permission: 'public_api',
    enabled: false,
    keywords: DEFAULT_RELEVANCE_KEYWORDS,
    note: 'Sử dụng tính năng Import trong Admin để nhập dữ liệu từ file CSV/JSON'
  }
];
