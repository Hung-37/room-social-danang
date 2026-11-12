import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
if(process.env.TEST_ISOLATED_DB!=='1'||!new URL(process.env.MYSQL_URL).pathname.startsWith('/room_qa_'))throw Error('QA only');
const base=process.env.TEST_BASE_URL;
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.TEST_ADMIN_EMAIL,password:process.env.TEST_ADMIN_PASSWORD})});assert.equal(login.status,200);
const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
const stamp=Date.now();
const items=Array.from({length:120},(_,i)=>({id:'bulk-'+stamp+'-'+i,title:'Phòng trọ Hải Châu QA '+stamp+' số '+i,description:'Phòng trọ tại Hải Châu Đà Nẵng, có cửa sổ và nhà vệ sinh riêng.',price:2000000+i*1000,area:20+i/10,address:i+' đường QA Hải Châu Đà Nẵng',url:'https://feed.example.vn/rooms/'+stamp+'/'+i}));
const r=await fetch(base+'/api/import/listings',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({format:'json',content:JSON.stringify(items),useAi:false})});const p=await r.json();assert.equal(r.status,200,JSON.stringify(p));assert.equal(p.saved,120);assert.equal(p.persistence.status,'saved');
const db=await mysql.createConnection(process.env.MYSQL_URL);try{const [rows]=await db.query('SELECT COUNT(*) AS n FROM listings WHERE title LIKE ? AND verification_status=?',['%QA '+stamp+' số %','needs_review']);assert.equal(Number(rows[0].n),120);console.log('PASS: 120 imported listings confirmed in MySQL pending review, no truncation at 100.');}finally{await db.end();}
