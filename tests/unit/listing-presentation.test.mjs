import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadBindings } from 'next/dist/build/swc/index.js';
const swc = await loadBindings();
import { decodeHTML } from 'entities';
import * as presentation from '../../lib/policies/listing-presentation.js';
import * as clusters from '../../lib/policies/address-cluster.js';
const require = createRequire(import.meta.url);
function compile(relative, mocks) {
 const filename=fileURLToPath(new URL(relative, import.meta.url));
 const compiled=swc.transformSync(readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
 const module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(fileURLToPath(new URL('../../',import.meta.url)));
 module.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
 module._compile(compiled,filename);return module.exports;
}
const {normalizeToRoomPost}=compile('../../lib/data/index.ts',{
 '@/lib/policies/listing-presentation.js':presentation,
 '@/lib/policies/address-cluster.js':clusters,
 '@/lib/shared/html-text':{decodeHtmlText:decodeHTML},
});
const fixture={externalId:'reference-fixture',title:'Phòng tham khảo',price:null,area:22,verificationStatus:'needs_review',sourceName:'Nguồn đầy đủ',sourceUrl:'https://example.org/rooms/1',imageUrl:'https://example.org/photo.jpg'};
test('reference normalization does not change input or mark it available',()=>{
 const original=structuredClone(fixture);const post=normalizeToRoomPost(fixture);
 assert.deepEqual(fixture,original);assert.equal(post.contentKind,'listing');assert.equal(post.isReference,true);assert.equal(post.status,'Cần kiểm chứng');assert.equal(post.imageUrl,undefined);assert.equal(post.updated,'Chưa có thời gian cập nhật');assert.equal(post.sourceName,fixture.sourceName);assert.equal(post.sourceUrl,fixture.sourceUrl);
});
test('verified is reviewed, never proof of availability; linked owner keeps chat and photo',()=>{
 const post=normalizeToRoomPost({...fixture,verificationStatus:'verified',ownerExternalId:'owner-1',updatedAt:'2026-11-15T03:00:00Z'});
 assert.equal(post.status,'Đã duyệt');assert.equal(post.isReference,false);assert.equal(post.imageUrl,fixture.imageUrl);assert.equal(presentation.listingPresentation(post).canChat,true);assert.notEqual(post.updated,'Chưa có thời gian cập nhật');
 assert.equal(presentation.listingPresentation({...post,ownerExternalId:undefined}).canChat,false);
});
test('reference image permission requires explicit true, not a source URL or a string',()=>{
 for(const permission of [undefined,false,'true'])assert.equal(presentation.listingPresentation({...fixture,imageRightsConfirmed:permission}).showImages,false);
 assert.equal(normalizeToRoomPost({...fixture,imageRightsConfirmed:true}).imageUrl,fixture.imageUrl);
});
test('safe source links reject credentials, non-HTTPS schemes and malformed URLs',()=>{
 for(const url of ['javascript:alert(1)','http://example.org','https://user:password@example.org','//example.org','invalid'])assert.equal(presentation.safeSourceUrl(url),undefined);
 assert.equal(presentation.safeSourceUrl(fixture.sourceUrl),fixture.sourceUrl);
});
test('content type does not depend on price and invalid timestamps do not claim freshness',()=>{
 assert.equal(normalizeToRoomPost({...fixture,price:null}).contentKind,'listing');
 assert.equal(normalizeToRoomPost({...fixture,contentKind:'discussion',postKind:'question',price:100}).contentKind,'discussion');
 assert.equal(normalizeToRoomPost({...fixture,updatedAt:'invalid'}).updated,'Chưa có thời gian cập nhật');
});
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const photo=({src})=>React.createElement('div',{'data-photo':src||'placeholder'});
const {default:PostCard}=compile('../../components/PostCard.tsx',{
 './FavoritesProvider':{useFavorites:()=>({ids:new Set(),loading:false})},
 './Toast':{useToast:()=>({showToast(){}})},
 './LoginModalProvider':{useLoginModal:()=>({openLoginModal(){}})},
 'next/link':({children,...props})=>React.createElement('a',props,children),
 './Icons':()=>null,'./RoomPhoto':photo,
 '@/lib/policies/room-photos.js':await import('../../lib/policies/room-photos.js'),
 '@/lib/policies/listing-presentation.js':presentation,
});
test('list card renders reference warning, missing price and source but no unlicensed photo',()=>{
 const html=renderToStaticMarkup(React.createElement(PostCard,{post:normalizeToRoomPost(fixture)}));
 assert(html.includes(presentation.REFERENCE_LABEL));assert(html.includes('Chưa có thông tin giá'));assert(html.includes('Nguồn đầy đủ'));assert(html.includes(fixture.sourceUrl));assert(!html.includes(fixture.imageUrl));assert(!html.includes('Tin đã duyệt'));
});
test('reviewed card retains approved badge and image',()=>{
 const html=renderToStaticMarkup(React.createElement(PostCard,{post:normalizeToRoomPost({...fixture,verificationStatus:'verified',price:2000000})}));
 assert(html.includes('Tin đã duyệt'));assert(html.includes(fixture.imageUrl));assert(!html.includes(presentation.REFERENCE_LABEL));
});
function renderDetail(post) {
 let stateIndex=0;
 const {default:Detail}=compile('../../app/bai/[id]/PostDetailClient.tsx',{
  react:{...React,useState:initial=>{const i=stateIndex++;return [i===0?post:i===1?false:typeof initial==='function'?initial():initial,()=>{}];}},
  '@/components/useAccountStatus':{useAccountStatus:()=>({authenticated:false,revision:0})},
  'next/link':({children,...props})=>React.createElement('a',props,children),
  '@/components/StartChat':()=>React.createElement('button',null,'Nhắn chủ trọ'),
  '@/components/CommentThread':()=>null,'@/components/ReportPost':()=>null,'@/components/Icons':()=>null,
  '@/components/RoomPhotoGallery':({cover,images})=>React.createElement('div',{'data-cover':cover||'placeholder','data-images':JSON.stringify(images||[])}),
  '@/lib/policies/listing-presentation.js':presentation,
 });
 return renderToStaticMarkup(React.createElement(Detail,{id:post.id}));
}
test('detail reference hides gallery and unavailable chat, shows safe original source',()=>{
 const post=normalizeToRoomPost(fixture);post.imageUrls=['https://example.org/extra.jpg'];
 const html=renderDetail(post);assert(html.includes(presentation.REFERENCE_LABEL));assert(html.includes('Chưa có thông tin giá'));assert(html.includes('Nguồn đầy đủ'));assert(html.includes(fixture.sourceUrl));assert(!html.includes('Nhắn chủ trọ'));assert(!html.includes('extra.jpg'));assert(!html.includes(fixture.imageUrl));
});
test('detail reviewed owner keeps chat; absent owner or unsafe URL does not create a broken action',()=>{
 const post=normalizeToRoomPost({...fixture,verificationStatus:'verified',ownerExternalId:'owner',price:2000000});
 assert(renderDetail(post).includes('Nhắn chủ trọ'));
 const html=renderDetail({...post,ownerExternalId:undefined,sourceUrl:'javascript:alert(1)'});
 assert(!html.includes('Nhắn chủ trọ'));assert(!html.includes('javascript:'));assert(html.includes('Chưa có liên hệ'));
});
