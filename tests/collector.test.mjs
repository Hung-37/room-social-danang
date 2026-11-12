import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateListings, fetchGenericUrlListings, fetchHtmlListings, isPlaceholderListingUrl, isPublicFeedUrl, normalizeListing, parseGenericHtmlListings, publicSources, sanitizeListingSummary } from '../js/collector.js';

const tromoiSource = publicSources.find((source) => source.id === 'tromoi-da-nang');
const thuephongtroSource = publicSources.find((source) => source.id === 'thuephongtro-da-nang');

function responseWith(html) {
  return async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

test('normalizes public listing metadata and leaves it pending review', async () => {
  const html = `
    <article>
      <a href="/phong-tro/phong-tro-hai-chau-123"><h3>Phòng trọ cho thuê Hải Châu</h3></a>
      <img data-src="/images/hai-chau-room.jpg" alt="Phòng trọ">
      <div>2.9tr/tháng · 18m² · Hải Châu, Đà Nẵng</div>
      <a href="/phong-tro/phong-tro-hai-chau-123">Xem tin</a>
      <span>0900000000</span>
    </article>`;
  const listings = await fetchHtmlListings(tromoiSource, responseWith(html));

  assert.equal(listings.length, 1);
  assert.equal(listings[0].price, 2900000);
  assert.equal(listings[0].area, 18);
  assert.equal(listings[0].address, 'Hải Châu, Đà Nẵng');
  assert.equal(listings[0].verificationStatus, 'needs_review');
  assert.equal(listings[0].source.url, 'https://tromoi.com/phong-tro/phong-tro-hai-chau-123');
  assert.equal(listings[0].phone, undefined);
  assert.equal(listings[0].imageUrl, 'https://tromoi.com/images/hai-chau-room.jpg');
});

test('accepts Tromoi slug-only detail URLs', async () => {
  const html = `
    <article>
      <a href="/phong-tro/alpha-apartment">Căn hộ trọ full nội thất tại Mỹ An</a>
      <div>3 triệu/tháng · 25m² · Ngũ Hành Sơn, Đà Nẵng</div>
    </article>`;
  const listings = await fetchHtmlListings(tromoiSource, responseWith(html));

  assert.equal(listings.length, 1);
  assert.equal(listings[0].price, 3000000);
  assert.equal(listings[0].area, 25);
  assert.equal(listings[0].source.url, 'https://tromoi.com/phong-tro/alpha-apartment');
});

test('filters stale dated listings', async () => {
  const html = `
    <article>
      <a href="/phong-tro-cu-123.html"><h3>Phòng trọ Hải Châu giá rẻ</h3></a>
      <div>2 triệu/tháng · 20 m² · Hải Châu, Đà Nẵng · 11/03/2025</div>
    </article>`;
  const listings = await fetchHtmlListings(thuephongtroSource, responseWith(html));

  assert.equal(listings.length, 0);
});

test('rejects listings without a recognized Da Nang district', async () => {
  const html = `
    <article>
      <a href="/phong-tro/phong-tro-quan-1-456"><h3>Phòng trọ cho thuê Quận 1</h3></a>
      <div>2 triệu/tháng</div>
      <div>20 m²</div>
    </article>`;
  const listings = await fetchHtmlListings(tromoiSource, responseWith(html));

  assert.equal(listings.length, 0);
});

test('namespaces identical upstream IDs by source', () => {
  const first = normalizeListing({ id: 'shared-123', title: 'Phòng trọ Hải Châu', price: '2 triệu' }, tromoiSource);
  const second = normalizeListing({ id: 'shared-123', title: 'Phòng trọ Hải Châu', price: '2 triệu' }, {
    ...tromoiSource,
    id: 'another-source'
  });

  assert.notEqual(first.externalId, second.externalId);
});

test('assigns the cluster from the address before conflicting title or description text', () => {
  const listing = normalizeListing({
    id: 'address-cluster',
    title: 'Phòng trọ khu Hòa Cường',
    description: 'Gần các trường ở Hải Châu',
    address: '12 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng',
    price: '2 triệu'
  }, tromoiSource);

  assert.equal(listing.clusterId, 'bach-khoa-su-pham');
});

test('prefers a specific neighborhood over its broader district', () => {
  const listing = normalizeListing({
    id: 'specific-neighborhood',
    title: 'Phòng trọ sinh viên',
    address: 'Hòa Quý, Ngũ Hành Sơn, Đà Nẵng',
    price: '2 triệu'
  }, tromoiSource);

  assert.equal(listing.clusterId, 'nam-da-nang');
});

test('uses public JSON-LD description and address without collecting contact details', async () => {
  const url = 'https://tromoi.com/phong-tro/hai-chau-124';
  const html = `
    <script type="application/ld+json">${JSON.stringify({
      '@type': 'Hostel',
      url,
      name: 'Phòng trọ Hải Châu',
      description: 'Phòng rộng 20m², có máy lạnh, gần trung tâm.',
      priceRange: '2.9 triệu/tháng',
      telephone: '0900000000',
      address: { streetAddress: '12 Lê Duẩn, Hải Châu, Đà Nẵng' }
    })}</script>
    <article>
      <a href="/phong-tro/hai-chau-124"><h3>Phòng trọ Hải Châu</h3></a>
      <div>2.9 triệu/tháng · 20m² · Hải Châu, Đà Nẵng</div>
      <a href="/phong-tro/hai-chau-124">Xem tin</a>
    </article>`;
  const listings = await fetchHtmlListings(tromoiSource, responseWith(html));

  assert.equal(listings.length, 1);
  assert.match(listings[0].summary, /máy lạnh/);
  assert.equal(listings[0].area, 20);
  assert.equal(listings[0].address, '12 Lê Duẩn, Hải Châu, Đà Nẵng');
  assert.equal(listings[0].phone, undefined);
});

test('deduplicates cross-source copies and preserves verified status', () => {
  const first = normalizeListing({
    id: 'room-one', title: 'Phòng trọ Hải Châu', price: '2.9 triệu', area: '20m²', address: 'Hải Châu, Đà Nẵng', description: 'Bản mô tả ngắn.'
  }, tromoiSource);
  const second = normalizeListing({
    id: 'room-copy', title: 'Phòng trọ Hải Châu', price: '2.9 triệu', area: '20m²', address: 'Hải Châu, Đà Nẵng', description: 'Bản mô tả đầy đủ và dài hơn.'
  }, { ...tromoiSource, id: 'phongtro123-da-nang', name: 'Phongtro123' });
  second.verificationStatus = 'verified';

  const deduplicated = deduplicateListings([first, second]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].verificationStatus, 'verified');
  assert.equal(deduplicated[0].summary, second.summary);
});

test('only enables secure public feeds and rejects local/example hosts', () => {
  assert.equal(isPublicFeedUrl('https://feed.example.org/listings.json'), false);
  assert.equal(isPublicFeedUrl('http://localhost:3000/data-template.json'), false);
  assert.equal(isPublicFeedUrl('https://localhost/feed.json'), false);
  assert.equal(isPublicFeedUrl('https://[::1]/feed.json'), false);
  assert.equal(isPublicFeedUrl('https://127.0.0.1/feed.json'), false);
  assert.equal(isPublicFeedUrl('https://feeds.example.vn/rooms.json'), true);
  assert.equal(isPlaceholderListingUrl('https://example.com/room/1'), true);
  assert.equal(isPlaceholderListingUrl('https://feeds.example.vn/room/1'), false);
});

test('removes masked contact numbers and contact controls from summaries', () => {
  const summary = sanitizeListingSummary('Phòng 15m² giá tốt 076854**** Hiện số Nhắn Zalo');

  assert.equal(summary, 'Phòng 15m² giá tốt');
});

test('extracts generic JSON-LD and Open Graph data from an arbitrary public HTML page', () => {
  const source = { id: 'generic', name: 'generic.example.vn', url: 'https://generic.example.vn/rooms', permission: 'public_html', keywords: ['phòng trọ'] };
  const html = `<html><head><meta property="og:title" content="Phòng trọ cho thuê Mỹ An"><meta property="og:description" content="Phòng 20m², giá 3 triệu/tháng"><meta property="og:image" content="/room.jpg"></head><body><main><article><h2>Phòng trọ cho thuê Mỹ An</h2><p>Phòng 20m², giá 3 triệu/tháng, Ngũ Hành Sơn</p></article></main></body></html>`;
  const listings = parseGenericHtmlListings(html, source);

  assert.equal(listings.length, 1);
  assert.equal(listings[0].price, 3000000);
  assert.equal(listings[0].area, 20);
  assert.equal(listings[0].imageUrl, 'https://generic.example.vn/room.jpg');
  assert.equal(listings[0].verificationStatus, 'needs_review');
});

test('reads generic JSON payloads and checks robots before collection', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /private', { status: 200 });
    return new Response(JSON.stringify([{ title: 'Phòng trọ Hải Châu', description: '20m², 2.5 triệu/tháng, Hải Châu', price: '2.5 triệu', area: '20m²', url: 'https://feed.example.vn/rooms/1' }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await fetchGenericUrlListings('https://feed.example.vn/rooms.json', fetchImpl);

  assert.equal(result.format, 'json');
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].price, 2500000);
  assert.equal(calls[0], 'https://feed.example.vn/robots.txt');
});

test('blocks HTML collection when robots.txt disallows the source path', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /rooms', { status: 200 });
    return new Response('<article><h3>Phòng trọ Hải Châu</h3></article>', { status: 200, headers: { 'content-type': 'text/html' } });
  };

  await assert.rejects(
    fetchHtmlListings({ ...tromoiSource, url: 'https://tromoi.com/rooms' }, fetchImpl),
    /robots\.txt/
  );
});

test('follows same-origin pagination and merges pages up to the configured limit', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /', { status: 200 });
    const page = new URL(url).searchParams.get('page');
    const item = { title: `Phòng trọ Hải Châu trang ${page ?? '1'}`, description: '20m², Hải Châu, Đà Nẵng', price: '2 triệu', area: '20m²', url };
    const next = page === '1' ? 'https://feed.example.vn/rooms.json?page=2' : null;
    return new Response(JSON.stringify({ items: [item], next }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await fetchGenericUrlListings('https://feed.example.vn/rooms.json?page=1', fetchImpl, { maxPages: 3 });

  assert.equal(result.pages, 2);
  assert.equal(result.listings.length, 2);
});
