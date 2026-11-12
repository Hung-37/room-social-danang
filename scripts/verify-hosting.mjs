import assert from 'node:assert/strict';
const raw=process.env.HOSTING_URL;
if (!raw) throw new Error('Set HOSTING_URL to the HTTPS deployment URL.');
const base=new URL(raw);
if (base.protocol!=='https:' && !(process.env.ALLOW_LOCAL_HTTP==='1' && ['localhost','127.0.0.1'].includes(base.hostname))) throw new Error('Hosting verification requires HTTPS. ALLOW_LOCAL_HTTP=1 is for loopback development only.');
let checks=0;
async function check(path,status=200,options={}) {
  const response=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
  assert.equal(response.status,status,`${path}: HTTP ${response.status}`);checks++;return response;
}
for(const path of ['/','/bang-tin','/thao-luan','/dang-nhap','/dang-ky']) {
  const response=await check(path);const html=await response.text();assert(html.includes('<html') && html.includes('lang="vi"'),`${path}: Vietnamese HTML missing`);checks++;
  if(path==='/bang-tin') {const src=html.match(/<script[^>]+src="([^\"]*\/_next\/static\/[^\"]+)"/);assert(src,'Build asset URL missing');await check(src[1].replaceAll('&amp;','&'));}
}
const health=await check('/api/health');assert.equal((await health.json()).status,'ok');assert.match(health.headers.get('cache-control')??'',/no-store/);checks+=2;
for(const path of ['/api/listings','/api/community/posts']) {const response=await check(path);assert(Array.isArray((await response.json()).data),`${path}: data must be an array`);checks++;}
for(const path of ['/api/admin/landlords','/api/listings?includePending=true','/api/auth/me']) await check(path,401);
await check('/api/listings/create',403,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
console.log(`PASS: ${checks} read-only hosting checks for ${base.origin}: pages, static asset, DB health, public feeds and anonymous permission checks.`);
