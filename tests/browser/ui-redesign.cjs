// UI-only checks. All fixture requests are fulfilled in memory; never seed a DB.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3033';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const out = process.env.TEST_SCREENSHOT_DIR || 'docs/screenshots/after';
const routes = [['home','/'],['feed','/bang-tin'],['search','/bang-tin?q=Hai%20Chau'],
  ['detail','/bai/ui-audit-missing'],['management','/quan-ly-phong'],
  ['appointments','/lich-xem-phong'],['notifications','/thong-bao'],['profile','/profile'],['admin','/admin']];
const room = {id:'ui-room',externalId:'ui-room',contentKind:'listing',title:'[UI mẫu] Phòng gần biển Sơn Trà',summary:'Dữ liệu chỉ trong bộ nhớ trình duyệt để kiểm tra giao diện.',
  clusterId:'son-tra',clusterName:'Sơn Trà',address:'Sơn Trà, Đà Nẵng',price:2500000,area:25,verificationStatus:'verified',status:'Đã duyệt',comments:0,
  tags:[],sourceName:'Nguồn kiểm thử giao diện',sourceUrl:'https://example.com/room',updatedAt:'2026-11-15T03:00:00Z',updated:'15/11/2026',imageUrls:[]};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {channel:'msedge'});
 const report={pages:[],axe:[],errors:[],checks:[]};
 try{
  const context=await browser.newContext({baseURL:base,serviceWorkers:'block'});
  // Real pages are read-only. Unexpected writes never leave the browser.
  await context.route('**/api/**',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  for(const width of [375,768,1280]){
   await page.setViewportSize({width,height:900});
   for(const [name,url] of routes){
    await page.goto(url,{waitUntil:'networkidle'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    report.pages.push({name,width,url:page.url(),overflow});
    if(width!==768) await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
    if(width===375 && name!=='admin'){
     const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
     report.axe.push({name,violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
    }
   }
  }
  await context.close();
  const fixture=await browser.newContext({baseURL:base,serviceWorkers:'block'});
  let saved=false,saveCount=0,failSave=false;
  const reference={...room,id:'ui-reference',externalId:'ui-reference',title:'[UI mẫu] Tin tham khảo thiếu giá',verificationStatus:'needs_review',status:'Cần kiểm chứng',isReference:true,price:null,imageUrl:'https://example.com/unlicensed.jpg'};
  await fixture.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname;
   let data=[],meta={count:0,total:0,hasMore:false,nextOffset:0};
   if(path==='/api/auth/me') data={id:1,name:'Người kiểm thử UI',role:'student'};
   else if(path==='/api/site/settings') data={siteName:'RoomĐàNẵng'};
   else if(path==='/api/listings'){data=[room,reference];meta.count=2;}
   else if(path==='/api/community/posts/ui-room') data={...room,price:'2.500.000đ/tháng',area:'25m²'};
   else if(path==='/api/community/posts/ui-reference') data={...reference,price:'',area:'25m²'};
   else if(path==='/api/favorites'){
    if(r.request().method()==='PUT'){
     saveCount++;
     await new Promise(resolve=>setTimeout(resolve,350));
     if(failSave) return r.fulfill({status:503,json:{error:'Chưa thể lưu phòng. Vui lòng thử lại.'}});
     saved=r.request().postDataJSON().saved;
    }
    data=saved?[{id:'ui-room'}]:[];
   }else if(!['GET','HEAD'].includes(r.request().method())) return r.abort();
   await r.fulfill({json:{data,meta}});
  });
  const p=await fixture.newPage();
  p.on('pageerror',e=>report.errors.push(e.message));
  for(const width of [375,768,1280]){
   await p.setViewportSize({width,height:900});
   for(const [name,url] of [['feed','/bang-tin'],['detail','/bai/ui-room'],['reference','/bai/ui-reference']]){
    await p.goto(url,{waitUntil:'networkidle'});
    await p.getByText(name==='reference'?'[UI mẫu] Tin tham khảo thiếu giá':'[UI mẫu] Phòng gần biển Sơn Trà',{exact:true}).first().waitFor();
    assert.equal(await p.getByText('Còn phòng',{exact:true}).count(),0);
    assert.equal(await p.getByRole('button',{name:'Nhắn chủ trọ',exact:true}).count(),0);
    assert.equal(await p.locator('img[src*="unlicensed"]').count(),0);
    assert(await p.locator('.room-photo-empty').count()>0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name} ${width} overflow`);
    if(name!=='detail'){
     assert(await p.getByText('Tin tham khảo · Chưa xác minh · Chưa xác nhận còn phòng',{exact:true}).count()>0);
     assert(await p.getByText('Chưa có thông tin giá',{exact:true}).count()>0);
    }
    if(width!==768) await p.screenshot({path:`${out}/fixture-${name}-${width}.png`,fullPage:true});
    const scan=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    report.axe.push({name:`fixture-${name}-${width}`,violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
   }
  }
  await p.goto('/bang-tin',{waitUntil:'networkidle'});
  const save=p.getByRole('button',{name:'Lưu: '+room.title,exact:true});
  await save.click();
  assert.equal(await save.getAttribute('aria-busy'),'true');
  assert(await save.isDisabled());
  await p.getByRole('button',{name:'Bỏ lưu: '+room.title,exact:true}).waitFor();
  assert.equal(saveCount,1);
  assert(await p.getByText('Đã lưu',{exact:true}).count()>0);
  failSave=true;
  await p.getByRole('button',{name:'Bỏ lưu: '+room.title,exact:true}).click();
  await p.getByText('Chưa thể lưu phòng. Vui lòng thử lại.',{exact:true}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Bỏ lưu: '+room.title,exact:true}).getAttribute('aria-pressed'),'true');
  report.checks.push('reference safeguards at 3 widths','save pending/disabled/success/error preserves confirmed state');
  await p.goto('/',{waitUntil:'networkidle'});
  await p.setViewportSize({width:375,height:900});
  const menu=p.getByRole('button',{name:'Mở menu',exact:true});
  await menu.click();
  await p.getByRole('navigation',{name:'Điều hướng trên điện thoại',exact:true}).waitFor();
  await p.keyboard.press('Escape');
  assert(await menu.evaluate(el=>el===document.activeElement));
  const menuBox=await menu.boundingBox();
  assert(menuBox.width>=44 && menuBox.height>=44);
  assert(await p.locator('link[rel="icon"]').count()>0);
  report.checks.push('mobile menu keyboard/focus/44px target and favicon');
  await p.getByLabel('Bạn muốn ở đâu?',{exact:true}).fill('Sơn Trà');
  await p.getByRole('search',{name:'Tìm phòng trọ'}).getByRole('button',{name:'Tìm phòng',exact:true}).click();
  await p.waitForURL('**/bang-tin?**');
  assert.equal(new URL(p.url()).searchParams.get('q'),'Sơn Trà');
  report.checks.push('home search preserves Vietnamese query');
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await p.locator('button').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  report.checks.push('reduced motion');
  assert(report.pages.every(v=>!v.overflow));
  assert.deepEqual(report.errors,[]);
  assert(report.axe.every(v=>!v.violations.length),'See ui-report.json for accessibility failures');
 }finally{
  fs.writeFileSync(`${out}/ui-report.json`,JSON.stringify(report,null,2));
  await browser.close();
 }
 console.log('UI redesign: 27 real page visits, 9 fixture layouts, 17 axe scans and interaction checks passed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
