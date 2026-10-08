import test from 'node:test';
import assert from 'node:assert/strict';

const xml = items => `<response><header><resultCode>000</resultCode></header><body><totalCount>${items.length}</totalCount><items>${items.join('')}</items></body></response>`;
const trade = name => `<item><aptNm>${name}</aptNm><umdNm>갈매동</umdNm><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>1</dealDay><excluUseAr>84.9</excluUseAr><dealAmount>60,000</dealAmount></item>`;
async function invoke(handler, query, headers = {}) {
  const res = {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
  await handler({headers:{host:'localhost',referer:'http://localhost/',...headers},query},res);
  return res;
}
test('API auth, incomplete responses, and rent retry', async () => {
  const originalFetch=globalThis.fetch;
  const originalKey=process.env.DATA_GO_KR_SERVICE_KEY;
  const originalToken=process.env.APP_TOKEN;
  try {
    process.env.DATA_GO_KR_SERVICE_KEY='test-fixture';
    delete process.env.APP_TOKEN;
    const {default:handler}=await import('../api/realestate.js?readiness-test');
    const denied=await invoke(handler,{}, {referer:'https://other.example/'});
    assert.equal(denied.statusCode,403);
    process.env.APP_TOKEN='fixture-token';
    assert.equal((await invoke(handler,{})).statusCode,401);
    delete process.env.APP_TOKEN;
    let rentFails=true,rentRequests=0;
    globalThis.fetch=async(url,options)=>{
      assert.ok(options.signal instanceof AbortSignal);
      if(url.includes('AptRent')){
        rentRequests++;
        if(rentFails)return new Response('Temporary upstream error',{status:503});
        return new Response(xml([]));
      }
      return new Response(xml([trade('단지A')]));
    };
    const query={complex:'단지A',region:'41310',apt:'단지A',months:'1'};
    const partial=await invoke(handler,query);
    assert.equal(partial.statusCode,200);
    assert.equal(partial.body.trades.length,1);
    assert.ok(partial.body.rentError);
    assert.equal(partial.headers['Cache-Control'],'private, no-store, max-age=0');
    rentFails=false;
    const success=await invoke(handler,query);
    assert.equal(success.body.rentError,'');
    assert.equal(rentRequests,2);
    assert.equal(success.headers['Cache-Control'],'private, max-age=300');
    const {default:searchHandler}=await import('../api/realestate.js?candidate-test');
    globalThis.fetch=async url=>new URL(url).searchParams.get('LAWD_CD')==='41310'
      ?new Response(xml([trade('단지A'),trade('단지B')]))
      :new Response('Temporary upstream error',{status:503});
    const candidates=await invoke(searchHandler,{complex:'단지'});
    assert.equal(candidates.body.candidates.length,2);
    assert.ok(candidates.body.partialErrors>0);
    assert.equal(candidates.headers['Cache-Control'],'private, no-store, max-age=0');
  } finally {
    globalThis.fetch=originalFetch;
    for(const [name,value] of [['DATA_GO_KR_SERVICE_KEY',originalKey],['APP_TOKEN',originalToken]]){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
