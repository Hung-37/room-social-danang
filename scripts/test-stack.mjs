import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=Object.fromEntries(readFileSync(new URL('../.env.docker',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const base=process.env.STACK_TEST_URL || `http://127.0.0.1:${config.WEB_PORT || 3000}`;
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Only local stack allowed');
let checks=0;
async function request(path,{body,cookie='',status=200,timeout=150000}={}){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});
 const p=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(p));checks++;
 return {data:p.data,cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
await request('/api/health');await request('/api/listings?limit=10');
await request('/api/admin/settings',{status:401});
const admin=await request('/api/auth/login',{body:{email:config.ADMIN_EMAIL,password:config.ADMIN_PASSWORD}});
const settings=await request('/api/admin/settings',{cookie:admin.cookie});
assert.equal('ai' in settings.data,false);assert.equal('aiEnabled' in settings.data.settings,false);checks+=2;
console.log(`PASS: ${checks} stack checks; web, MySQL health, Admin authentication and access control without an AI service.`);
