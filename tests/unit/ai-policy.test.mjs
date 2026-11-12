import assert from 'node:assert/strict';import test from 'node:test';import {parseAiResponse} from '../../lib/policies/ai-policy.js';
const valid={summary:'Phòng tại Hải Châu, cần kiểm tra chi phí.',riskLevel:'medium',missingInformation:['giá điện'],suggestedPrice:2500000,suggestedArea:25.5,location:'Hải Châu'};
test('AI accepts bounded structured observations',()=>assert.deepEqual(parseAiResponse(JSON.stringify(valid)),valid));
test('AI refuses malformed JSON and non-object responses instead of inventing medium risk',()=>{for(const raw of ['null','{}','[]','not json','true'])assert.throws(()=>parseAiResponse(raw));});
test('AI refuses unsupported risk, negative or coerced amounts and oversized descriptions',()=>{for(const extra of [{riskLevel:'invented'},{suggestedPrice:-1},{suggestedArea:'25'},{summary:'a'.repeat(1201)},{missingInformation:[123]}])assert.throws(()=>parseAiResponse(JSON.stringify({...valid,...extra})));});
