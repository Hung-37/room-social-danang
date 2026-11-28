// Header-only visual and keyboard checks. All browser API responses are in memory.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const phase = process.argv.includes('--before') ? 'before' : 'after';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out = process.env.HEADER_AUDIT_OUTPUT || `docs/screenshots/header-${phase}`;
const widths = phase === 'before' ? [360,390,768,1024,1440] : [320,375,390,430,768,1024,1440];
const pages = [['home','/'],['feed','/bang-tin'],['detail','/bai/header-preview'],['management','/quan-ly-phong'],['admin','/admin']];
async function main() {
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge'});
 const report={phase,headers:[],pages:[],axe:[],errors:[],checks:[]};
 try {
  for(const signedIn of [false,true]) {
   const state=signedIn?'member':'guest';
   const context=await browser.newContext({baseURL:base,serviceWorkers:'block',reducedMotion:'reduce'});
   let name='Nguyễn Minh Anh', unread=3;
   await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me') return route.fulfill({status:signedIn?200:401,json:signedIn?{data:{id:'header-member',name,role:'landlord'}}:{error:'Chưa đăng nhập'}});
    if(path==='/api/site/settings') return route.fulfill({json:{data:{siteName:'RoomĐàNẵng'}}});
    if(path==='/api/notifications') {
     if(route.request().method()==='PATCH') unread=0;
     return route.fulfill({json:{data:[{id:1,title:'Lịch xem phòng',body:'Thông báo mẫu chỉ trong bộ nhớ',href:'/lich-xem-phong',isRead:unread===0,createdAt:'2026-11-15T03:00:00Z'}],meta:{unreadCount:unread}}});
    }
    if(!['GET','HEAD'].includes(route.request().method())) return route.abort();
    if(path==='/api/favorites') return route.fulfill({json:{data:[]}});
    return route.fulfill({status:503,json:{error:'Chưa thể tải dữ liệu. Vui lòng thử lại.'}});
   });
   const p=await context.newPage();
   p.on('pageerror',e=>report.errors.push(e.message));
   for(const width of widths) {
    await p.setViewportSize({width,height:900});
    await p.goto('/',{waitUntil:'networkidle'});
    await p.locator('header .profile-chip').first().waitFor({state:'attached'});
    await p.screenshot({path:`${out}/${state}-${width}-closed.png`,clip:{x:0,y:0,width,height:170}});
    const toggle=p.getByRole('button',{name:'Mở menu',exact:true});
    const mobile=await toggle.isVisible();
    report.headers.push({state,width,mobile,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    if(mobile) {
     await toggle.click();
     await p.locator('#mobile-navigation').waitFor();
     await p.screenshot({path:`${out}/${state}-${width}-open.png`});
     if(phase==='after') {
      const dialog=p.getByRole('dialog',{name:'Menu điều hướng',exact:true});
      assert(await dialog.isVisible());
      assert.equal(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
      const links=await p.locator('#mobile-navigation a').all();
      let previousBottom=0;
      for(const link of links) {
       const box=await link.boundingBox();
       assert(box.height>=48 && box.x>=0 && box.x+box.width<=width);
       assert(await link.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'menu label is clipped');
       assert(box.y>=previousBottom-1); previousBottom=box.y+box.height;
      }
      const focusable=dialog.locator('a,button');
      await focusable.last().focus(); await p.keyboard.press('Tab');
      assert(await focusable.first().evaluate(e=>e===document.activeElement));
      assert(await focusable.first().evaluate(e=>{const s=getComputedStyle(e);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2;}),'keyboard focus ring is not visible');
      await p.keyboard.press('Shift+Tab');
      assert(await focusable.last().evaluate(e=>e===document.activeElement));
      const scan=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      report.axe.push({state,width,mode:'open',violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
     }
     await p.keyboard.press('Escape');
     if(phase==='after') {
      assert.equal(await p.locator('#mobile-navigation').count(),0);
      assert(await toggle.evaluate(e=>e===document.activeElement));
      assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
     }
    } else if(signedIn) {
     await p.getByRole('button',{name:'Tài khoản của '+name,exact:true}).click();
     await p.screenshot({path:`${out}/${state}-${width}-open.png`,clip:{x:0,y:0,width,height:600}});
     await p.keyboard.press('Escape');
    } else if(phase==='after') {
     await p.getByRole('button',{name:'Thêm',exact:true}).click();
     await p.screenshot({path:`${out}/${state}-${width}-open.png`,clip:{x:0,y:0,width,height:400}});
     await p.keyboard.press('Escape');
    }
    if(phase==='after') {
     const scan=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
     report.axe.push({state,width,mode:'closed',violations:scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
     assert.equal(mobile,width<1024);
    }
   }
   if(!signedIn) for(const width of [390,1440]) {
    await p.setViewportSize({width,height:900});
    for(const [name,url] of pages) {
     await p.goto(url,{waitUntil:'networkidle'});
     // /admin redirects to the login modal without a real admin session.
     if(name==='admin' && await p.getByRole('button',{name:'Đóng',exact:true}).count()) await p.getByRole('button',{name:'Đóng',exact:true}).click();
     await p.screenshot({path:`${out}/page-${name}-${width}.png`,fullPage:true});
     const layout=await p.locator('main').evaluate(el=>{
      const b=el.getBoundingClientRect();
      return {x:b.x,y:b.y,width:b.width,height:b.height,text:el.innerText};
     });
     report.pages.push({name,width,url:p.url(),layout});
    }
   }
   if(phase==='after') {
    name='Nguyễn Thị Minh Anh tên tài khoản rất dài để kiểm tra không tràn';
    await p.goto('/bang-tin',{waitUntil:'networkidle'});
    for(let width=320;width<=1920;width++) {
     await p.setViewportSize({width,height:900});
     const fits=await p.locator('header.topbar').evaluate(h=>{
      const root=h.getBoundingClientRect();
      const boxes=[...h.querySelectorAll('.site-header-row > *, .site-header-actions > *')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
      return document.documentElement.scrollWidth<=innerWidth && boxes.every(b=>b.left>=root.left && b.right<=root.right+1);
     });
     assert(fits,`${state} overflow at ${width}px`);
    }
    report.checks.push(`${state}: every integer width 320–1920 fits`);
    await p.setViewportSize({width:390,height:900});
    await p.getByRole('button',{name:'Mở menu',exact:true}).click();
    await p.getByRole('dialog',{name:'Menu điều hướng'}).getByRole('button',{name:'Đóng menu',exact:true}).click();
    assert.equal(await p.locator('#mobile-navigation').count(),0);
    await p.getByRole('button',{name:'Mở menu',exact:true}).click();
    await p.mouse.click(3,300);
    assert.equal(await p.locator('#mobile-navigation').count(),0);
    await p.getByRole('button',{name:'Mở menu',exact:true}).click();
    await p.locator('#mobile-navigation').getByRole('link',{name:'Thảo luận',exact:true}).click();
    await p.waitForURL('**/thao-luan');
    assert.equal(await p.locator('#mobile-navigation').count(),0);
    await p.getByRole('button',{name:'Mở menu',exact:true}).click();
    assert.equal(await p.locator('#mobile-navigation a[aria-current="page"]').innerText(),'Thảo luận');
    await p.setViewportSize({width:1024,height:900});
    await p.locator('#mobile-navigation').waitFor({state:'detached'});
    report.checks.push(`${state}: X, backdrop, Escape, focus trap/restore, route and desktop resize close menu`);
   }
   await context.close();
  }
  if(phase==='after') {
   const before=JSON.parse(fs.readFileSync('tests/fixtures/header-before-report.json'));
   for(const page of report.pages) {
    const expected=before.pages.find(b=>b.name===page.name && b.width===page.width).layout;
    const stableLayout=value=>({x:value.x,y:value.y,width:value.width,textHash:value.textHash || crypto.createHash('sha256').update(value.text).digest('hex')});
    assert.deepEqual(stableLayout(page.layout),stableLayout(expected),`non-header content or horizontal bounds changed: ${page.name}/${page.width}`);
   }
   assert(report.headers.every(h=>!h.overflow));
   assert(report.axe.every(a=>!a.violations.length),'axe violations: see report');
   assert.deepEqual(report.errors,[]);
   report.checks.push('main content position, width and text hash unchanged on 5 routes at 390/1440');
  }
 } finally { fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close(); }
 console.log(`${phase}: ${report.headers.length} header layouts, ${report.axe.length} axe scans; ${report.checks.length} checks passed`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
