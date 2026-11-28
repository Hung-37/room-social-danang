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
  tags:[],sourceName:'Nguồn kiểm thử giao diện',sourceUrl:'https://example.com/room',updatedAt:'2026-11-15T03:00:00Z',updated:'15/11/2026',imageUrls:['/api/images/ui-audit-photo']};
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
  for(const width of [320,375,430,768,1024,1280,1440]){
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
  let saved=false,saveCount=0,failSave=false,failComment=true,cancelled=false,read=false;
  let comments=[];
  const visit={id:'ui-visit',conversationId:'ui-chat',buyerId:1,sellerId:2,status:'confirmed',version:1,note:'',startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+88200000).toISOString(),title:room.title,otherName:'Chủ phòng kiểm thử'};
  const reference={...room,id:'ui-reference',externalId:'ui-reference',title:'[UI mẫu] Tin tham khảo thiếu giá',verificationStatus:'needs_review',status:'Cần kiểm chứng',isReference:true,price:null,imageUrl:'https://example.com/unlicensed.jpg'};
  await fixture.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname;
   let data=[],meta={count:0,total:0,hasMore:false,nextOffset:0};
   if(path==='/api/auth/me') data={id:1,name:'Người kiểm thử UI',role:'student'};
   else if(path==='/api/site/settings') data={siteName:'RoomĐàNẵng'};
   else if(path==='/api/listings'){data=[room,reference];meta.count=2;}
   else if(path==='/api/community/posts/ui-room') data={...room,price:'2.500.000đ/tháng',area:'25m²'};
   else if(path==='/api/community/posts/ui-reference') data={...reference,price:'',area:'25m²'};
   else if(path==='/api/community/posts/ui-room/comments'){
    if(r.request().method()==='POST'){
     await new Promise(resolve=>setTimeout(resolve,350));
     if(failComment) return r.fulfill({status:503,json:{error:'Chưa gửi được bình luận. Vui lòng thử lại.'}});
     const comment={id:'ui-comment',authorName:'Người kiểm thử UI',text:r.request().postDataJSON().text,createdAt:new Date().toISOString()};
     comments=[comment];return r.fulfill({json:{data:comment,count:1}});
    }
    data=comments;meta.total=comments.length;
   }
   else if(path==='/api/appointments') data=cancelled?[]:[visit];
   else if(path==='/api/appointments/ui-visit'){
    await new Promise(resolve=>setTimeout(resolve,350));cancelled=true;data={...visit,status:'cancelled'};
   }
   else if(path==='/api/notifications'){
    if(r.request().method()==='PATCH'){await new Promise(resolve=>setTimeout(resolve,350));read=true;}
    data=[{id:1,title:'[UI mẫu] Lịch hẹn mới',body:'Thông báo kiểm thử',href:'/lich-xem-phong',isRead:read,createdAt:'2026-11-15T03:00:00Z'}];
    meta.unreadCount=read?0:1;
   }
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
  for(const width of [320,375,430,768,1024,1280,1440]){
   await p.setViewportSize({width,height:900});
   for(const [name,url] of [['feed','/bang-tin'],['detail','/bai/ui-room'],['reference','/bai/ui-reference']]){
    await p.goto(url,{waitUntil:'networkidle'});
    await p.getByRole('heading',{name:name==='reference'?'[UI mẫu] Tin tham khảo thiếu giá':'[UI mẫu] Phòng gần biển Sơn Trà',exact:true}).waitFor();
    assert.equal(await p.getByText('Còn phòng',{exact:true}).count(),0);
    assert.equal(await p.getByRole('button',{name:'Nhắn chủ trọ',exact:true}).count(),0);
    assert.equal(await p.locator('img[src*="unlicensed"]').count(),0);
    if(name==='detail') assert(await p.locator('.room-photo-empty').count()>0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name} ${width} overflow`);
    if(name!=='detail'){
     assert(await p.getByText('Tin tham khảo · Chưa xác minh · Chưa xác nhận còn phòng',{exact:true}).count()>0);
     assert(await p.getByText('Chưa có thông tin giá',{exact:true}).count()>0);
    }
    if(width!==768) await p.screenshot({path:`${out}/fixture-${name}-${width}.png`,fullPage:true});
    const scan=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    report.axe.push({name:`fixture-${name}-${width}`,violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
    if(name==='detail' && width===375) {
     const cover=p.locator('.detail-cover.photo-open');
     const coverInfo=await cover.evaluate(el=>({ariaLabel:el.getAttribute('aria-label'),innerText:el.innerText,textContent:el.textContent,visibleParts:[...el.querySelectorAll('span')].map(node=>node.innerText)}));
     assert.equal(await p.getByRole('button',{name:/Xem ảnh đầy đủ.*1\s*\/\s*1/}).count(),1,JSON.stringify(coverInfo));
     assert(!scan.violations.some(v=>v.id==='label-content-name-mismatch'),JSON.stringify({coverInfo,violation:scan.violations.find(v=>v.id==='label-content-name-mismatch')?.nodes}));
     report.checks.push('room cover accessible name includes its visible label');
    }
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
  await p.goto('/bai/ui-room',{waitUntil:'networkidle'});
  await p.locator('#comment-text').fill('Mình muốn hỏi về giờ giấc.');
  await p.getByRole('button',{name:'Gửi bình luận',exact:true}).click();
  assert(await p.getByRole('button',{name:'Đang gửi...',exact:true}).isDisabled());
  await p.getByText('Chưa gửi được bình luận. Vui lòng thử lại.',{exact:true}).waitFor();
  assert.equal(await p.locator('#comment-text').inputValue(),'Mình muốn hỏi về giờ giấc.');
  failComment=false;
  await p.getByRole('button',{name:'Gửi bình luận',exact:true}).click();
  await p.getByText('Đã gửi bình luận. Cảm ơn bạn đã chia sẻ!',{exact:true}).waitFor();
  assert.equal(await p.locator('#comment-text').inputValue(),'');
  report.checks.push('comment pending, failure retains input, retry succeeds');
  await p.goto('/lich-xem-phong',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'Hủy lịch',exact:true}).click();
  const confirm=p.getByRole('region',{name:'Xác nhận cập nhật lịch',exact:true});
  assert(await confirm.getByText(room.title,{exact:true}).isVisible());
  await confirm.getByRole('button',{name:'Quay lại',exact:true}).click();
  assert.equal(cancelled,false);
  await p.getByRole('button',{name:'Hủy lịch',exact:true}).click();
  const cancel=confirm.getByRole('button',{name:'Hủy lịch xem phòng',exact:true});
  assert((await cancel.getAttribute('class')).includes('danger-btn'));
  await cancel.click();
  await p.getByText('Chưa có lịch xem phòng trong mục này.',{exact:true}).waitFor();
  report.checks.push('cancel appointment names target, back does not write, confirm updates UI');
  await p.goto('/thong-bao',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'Đánh dấu tất cả đã đọc',exact:true}).click();
  await p.getByText('Đã đánh dấu tất cả thông báo là đã đọc.',{exact:true}).waitFor();
  report.checks.push('notification read success');
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
  const roomSearch=p.getByRole('search');
  await roomSearch.getByRole('searchbox',{name:'Tìm phòng',exact:true}).fill('Sơn Trà');
  await roomSearch.getByRole('button',{name:'Tìm phòng',exact:true}).click();
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
 const fixtureLayouts=report.axe.filter(x=>x.name?.startsWith('fixture-')).length;
 console.log(`UI audit: ${report.pages.length} route/viewport visits, ${fixtureLayouts} fixture layouts, ${report.axe.length} axe scans, ${report.checks.length} interaction groups passed.`);
}
main().catch(e=>{console.error(e.stack || e);process.exitCode=1;});
