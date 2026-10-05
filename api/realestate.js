const REGIONS={"41310":"구리시","41360":"남양주시","41150":"의정부시","11260":"서울 중랑구","11350":"서울 노원구","11320":"서울 도봉구","11305":"서울 강북구","11215":"서울 광진구","11230":"서울 동대문구","11200":"서울 성동구","11290":"서울 성북구","11740":"서울 강동구"};
const TRADE=["https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade","https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"];
const RENT="https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

const MONTH_CACHE=new Map();
const MONTH_INFLIGHT=new Map();
const CACHE_TTL=60*60*1000;
const CACHE_MAX=40;
const cachePut=(key,data)=>{
  MONTH_CACHE.delete(key);
  MONTH_CACHE.set(key,{at:Date.now(),data});
  while(MONTH_CACHE.size>CACHE_MAX){
    const oldest=MONTH_CACHE.keys().next().value;
    MONTH_CACHE.delete(oldest);
  }
};
const isAuthOrQuotaError=e=>{
  const m=String(e?.message||"").toLowerCase();
  return [401,403,429].includes(e?.status)||/quota|rate.?limit|servicekey|auth|인증|트래픽|한도/.test(m);
};
const noStore=res=>res.setHeader("Cache-Control","private, no-store, max-age=0");

const RATE_BUCKETS=new Map();
const RATE_WINDOW=10*60*1000;
const RATE_MAX=120;
const clientIp=req=>String(req.headers["x-forwarded-for"]||req.headers["x-real-ip"]||"unknown").split(",")[0].trim();
const sameOrigin=req=>{
  const host=String(req.headers.host||"").toLowerCase();
  const origin=String(req.headers.origin||"").toLowerCase();
  const referer=String(req.headers.referer||"").toLowerCase();
  if(!host)return false;
  if(origin){
    try{return new URL(origin).host.toLowerCase()===host}catch(e){return false}
  }
  if(referer){
    try{return new URL(referer).host.toLowerCase()===host}catch(e){return false}
  }
  return false;
};
const withinRate=req=>{
  const now=Date.now(),ip=clientIp(req),b=RATE_BUCKETS.get(ip);
  if(!b||now-b.start>RATE_WINDOW){RATE_BUCKETS.set(ip,{start:now,count:1});return true}
  b.count++;
  if(RATE_BUCKETS.size>500){
    for(const [k,v] of RATE_BUCKETS){if(now-v.start>RATE_WINDOW)RATE_BUCKETS.delete(k)}
  }
  return b.count<=RATE_MAX;
};



const monthsBack=n=>{const k=new Date(Date.now()+9*3600e3);return Array.from({length:n},(_,i)=>{const d=new Date(Date.UTC(k.getUTCFullYear(),k.getUTCMonth()-i,1));return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}`})};
const dec=s=>String(s||"").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&amp;/g,"&").trim();
const tag=(x,names)=>{for(const n of names){const m=x.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`,"i"));if(m)return dec(m[1])}return""};
const items=x=>[...x.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
const num=s=>+(String(s||"").replace(/,/g,"")||0);
const cp=s=>String(s||"").replace(/\s/g,"").toLowerCase();
const dateOf=x=>{const y=tag(x,["dealYear"]),m=tag(x,["dealMonth"]),d=tag(x,["dealDay"]);return y?`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`:""};

async function page(url,key,lawd,ym,p){
  const clean=String(key||"").trim().replace(/^["']|["']$/g,"");
  let decoded=clean;
  try{if(clean.includes("%"))decoded=decodeURIComponent(clean)}catch(e){}
  const tails=`&LAWD_CD=${encodeURIComponent(lawd)}&DEAL_YMD=${encodeURIComponent(ym)}&numOfRows=1000&pageNo=${encodeURIComponent(String(p))}`;
  const urls=[
    `${url}?serviceKey=${encodeURIComponent(decoded)}${tails}`,
    ...(clean!==decoded ? [`${url}?serviceKey=${clean}${tails}`] : [])
  ];
  let last;
  for(const u of urls){
    const r=await fetch(u);const t=await r.text();
    if(r.ok){
      const code=tag(t,["returnReasonCode","resultCode"]);
      if(code&&!/^0+$/.test(code)){
        const err=new Error((tag(t,["returnAuthMsg","resultMsg"])||"API 오류")+" ("+code+")");
        if(isAuthOrQuotaError(err))err.noFallback=true;
        throw err;
      }
      return t;
    }
    const msg=(tag(t,["returnAuthMsg","resultMsg","message"])||t.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).slice(0,180);
    last=new Error("공공데이터 HTTP "+r.status+(msg?": "+msg:""));
    last.status=r.status;
    if(isAuthOrQuotaError(last))last.noFallback=true;
    if(r.status!==401&&r.status!==403)break;
  }
  throw last||new Error("공공데이터 호출 실패");
}
async function all(url,key,lawd,ym){
  const first=await page(url,key,lawd,ym,1);let xs=items(first);const total=+tag(first,["totalCount"])||xs.length;
  for(let p=2;(p-1)*1000<total&&p<=10;p++)xs=xs.concat(items(await page(url,key,lawd,ym,p)));
  return xs;
}
async function tradeMonth(key,lawd,ym){
  let last;
  for(let i=0;i<TRADE.length;i++){
    try{return await all(TRADE[i],key,lawd,ym)}
    catch(e){
      last=e;
      if(e?.noFallback||isAuthOrQuotaError(e))throw e;
    }
  }
  throw last;
}
async function cachedMonth(type,key,lawd,ym){
  const ck=type+"|"+lawd+"|"+ym,hit=MONTH_CACHE.get(ck);
  if(hit&&Date.now()-hit.at<CACHE_TTL){
    MONTH_CACHE.delete(ck);MONTH_CACHE.set(ck,hit);
    return hit.data;
  }
  if(hit)MONTH_CACHE.delete(ck);
  if(MONTH_INFLIGHT.has(ck))return MONTH_INFLIGHT.get(ck);
  const p=(async()=>{
    const raw=type==="trade"?await tradeMonth(key,lawd,ym):await all(RENT,key,lawd,ym);
    const data=type==="trade"?parseTrade(raw):parseRent(raw);
    cachePut(ck,data);
    return data;
  })().finally(()=>MONTH_INFLIGHT.delete(ck));
  MONTH_INFLIGHT.set(ck,p);
  return p;
}
async function pool(tasks,n=8){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<tasks.length){const k=i++;out[k]=await tasks[k]().then(v=>({v}),e=>({e}))}}));return out}

const parseTrade=xs=>{
  if(xs?.length&&typeof xs[0]==="object")return xs;
  return xs.filter(x=>tag(x,["cdealType"])!=="O").map(x=>({name:tag(x,["aptNm"]),dong:tag(x,["umdNm","sggNm"]),date:dateOf(x),area:+tag(x,["excluUseAr"]),price:num(tag(x,["dealAmount"])),floor:+tag(x,["floor"])||0,direct:tag(x,["dealingGbn"])==="직거래"}));
};
const parseRent=xs=>{
  if(xs?.length&&typeof xs[0]==="object")return xs;
  return xs.map(x=>({name:tag(x,["aptNm"]),dong:tag(x,["umdNm","sggNm"]),date:dateOf(x),area:+tag(x,["excluUseAr"]),deposit:num(tag(x,["deposit"])),monthly:num(tag(x,["monthlyRent"])),floor:+tag(x,["floor"])||0,renewal:tag(x,["contractType"])==="갱신"||tag(x,["useRRRight"])==="사용"}));
};

const estimatedBuyCosts=(price,area)=>{
  let taxRate=price<=6?0.01:price<=9?((price*2/3)-3)/100:0.03;
  taxRate=Math.max(0.01,Math.min(0.03,taxRate));
  const acquisition=price*taxRate;
  const education=acquisition*0.10;
  const rural=area>85?price*0.002:0;
  let broker=0;
  if(price<0.5)broker=Math.min(price*0.006,0.0025);
  else if(price<2)broker=Math.min(price*0.005,0.008);
  else if(price<9)broker=price*0.004;
  else if(price<12)broker=price*0.005;
  else if(price<15)broker=price*0.006;
  else broker=price*0.007;
  return acquisition+education+rural+broker;
};

export default async function handler(req,res){
  noStore(res);
  if(!sameOrigin(req))return res.status(403).json({error:"앱 화면에서만 조회할 수 있습니다."});
  if(!withinRate(req))return res.status(429).json({error:"조회 요청이 너무 많습니다. 잠시 후 다시 시도하세요."});
  const need=process.env.APP_TOKEN;
  if(need&&req.headers["x-app-token"]!==need)return res.status(401).json({error:"접근 토큰이 필요합니다."});
  let key=process.env.DATA_GO_KR_SERVICE_KEY;
  if(!key)return res.status(500).json({error:"서버 환경변수 DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다."});
  try{if(key.includes("%"))key=decodeURIComponent(key)}catch(e){noStore(res);return res.status(500).json({error:"공공데이터 키 형식을 확인하세요."})}
  const q=String(req.query.complex||"").trim();
  const months=Math.min(Math.max(+req.query.months||12,1),24);
  const ok=(body,cacheable=true)=>{res.setHeader("Cache-Control",cacheable?"private, max-age=300":"private, no-store, max-age=0");res.setHeader("Vary","x-app-token");return res.status(200).json(body)};
  const fail=(status,message)=>{noStore(res);return res.status(status).json({error:message})};
  try{
    if(String(req.query.mode||"")==="jeonseRecommend"){
      const cash=Math.max(+req.query.cash||0,0);
      const deposit=Math.max(+req.query.deposit||0,0);
      const loanLimit=Math.max(+req.query.loanLimit||0,0);
      const amin=Math.max(+req.query.areaMin||74,1);
      const amax=Math.max(+req.query.areaMax||85,amin);
      const scope=String(req.query.scope||"");
      const regionCodes=REGIONS[scope]?[scope]:Object.keys(REGIONS);
      const maxBudget=cash+deposit+loanLimit;
      if(!(maxBudget>0))return res.status(400).json({error:"보증금·추가 현금·전세대출 한도를 입력하세요."});
      const pm=monthsBack(3),tasks=[];
      for(const c of regionCodes)for(const m of pm)tasks.push(()=>cachedMonth("rent",key,c,m).then(xs=>({c,xs})));
      const rs=await pool(tasks),errs=rs.filter(r=>r.e),groups=new Map();
      if(errs.length===rs.length)return fail(502,"전세 실거래 조회가 모두 실패했습니다. 잠시 후 다시 시도하세요.");
      rs.forEach(r=>{
        if(!r.v)return;
        parseRent(r.v.xs).filter(x=>x.monthly===0&&x.deposit>0&&!x.renewal&&x.area>=amin&&x.area<=amax&&x.name).forEach(x=>{
          const ag=Math.floor(x.area),k=r.v.c+"|"+x.name+"|"+(x.dong||"")+"|"+ag;
          if(!groups.has(k))groups.set(k,[]);
          groups.get(k).push(x);
        });
      });
      const out=[];
      for(const [k,xs] of groups){
        xs.sort((a,b)=>b.date.localeCompare(a.date));
        const [c,name,dong,ag]=k.split("|");
        const ds=xs.slice(0,3).map(x=>x.deposit).sort((a,b)=>a-b);
        const mid=ds.length%2?ds[ds.length>>1]:(ds[ds.length/2-1]+ds[ds.length/2])/2;
        const price=mid/10000;
        if(price<=maxBudget){
          const gap=Math.max(0,price-deposit);
          const loan=Math.min(loanLimit,gap);
          const own=Math.max(0,gap-loan);
          out.push({
            region:c,regionName:REGIONS[c],name,dong,area:+ag,
            price:+price.toFixed(2),latest:+(xs[0].deposit/10000).toFixed(2),
            count:xs.length,loan:+loan.toFixed(2),own:+own.toFixed(2),
            headroom:+Math.max(0,cash-own).toFixed(2),lastDate:xs[0].date
          });
        }
      }
      out.sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)||a.price-b.price);
      return ok({mode:"jeonseRecommend",months:3,maxBudget:+maxBudget.toFixed(2),recommendations:out.slice(0,12),partialErrors:errs.length},errs.length===0);
    }
    if(String(req.query.mode||"")==="recommend"){
      const cash=Math.max(+req.query.cash||0,0);
      const ltv=Math.min(Math.max(+req.query.ltv||0,0),100);
      const amin=Math.max(+req.query.areaMin||74,1);
      const amax=Math.max(+req.query.areaMax||85,amin);
      const scope=String(req.query.scope||"");
      const strategy=String(req.query.strategy||"budget");
      const target=Math.max(+req.query.target||0,0);
      const regionCodes=REGIONS[scope]?[scope]:Object.keys(REGIONS);
      if(!(cash>0))return res.status(400).json({error:"가용 현금을 입력하세요."});
      if(!(ltv>=0&&ltv<=100))return res.status(400).json({error:"LTV를 확인하세요."});
      const pm=monthsBack(3),tasks=[];
      for(const c of regionCodes)for(const m of pm)tasks.push(()=>cachedMonth("trade",key,c,m).then(xs=>({c,xs})));
      const rs=await pool(tasks),errs=rs.filter(r=>r.e),groups=new Map();
      if(errs.length===rs.length)return fail(502,"매매 실거래 조회가 모두 실패했습니다. 잠시 후 다시 시도하세요.");
      rs.forEach(r=>{
        if(!r.v)return;
        parseTrade(r.v.xs).filter(x=>!x.direct&&x.area>=amin&&x.area<=amax&&x.name).forEach(x=>{
          const ag=Math.floor(x.area),k=r.v.c+"|"+x.name+"|"+(x.dong||"")+"|"+ag;
          if(!groups.has(k))groups.set(k,[]);
          groups.get(k).push(x);
        });
      });
      const out=[];
      for(const [k,xs] of groups){
        xs.sort((a,b)=>b.date.localeCompare(a.date));
        const [c,name,dong,ag]=k.split("|");
        const prices=xs.slice(0,3).map(x=>x.price).sort((a,b)=>a-b);
        const mid=prices.length%2?prices[prices.length>>1]:(prices[prices.length/2-1]+prices[prices.length/2])/2;
        const priceEok=mid/10000;
        const loan=priceEok*ltv/100;
        const costs=estimatedBuyCosts(priceEok,+ag);
        const need=priceEok-loan+costs;
        const headroom=Math.max(0,cash-need),shortfall=Math.max(0,need-cash);
        const row={
          region:c,regionName:REGIONS[c],name,dong,area:+ag,
          price:+priceEok.toFixed(2),loan:+loan.toFixed(2),costs:+costs.toFixed(2),need:+need.toFixed(2),
          count:xs.length,lastDate:xs[0].date,lastPrice:+(xs[0].price/10000).toFixed(2),
          headroom:+headroom.toFixed(2),shortfall:+shortfall.toFixed(2)
        };
        if(strategy==="target"){
          if(target>0 && priceEok>=target*0.9 && priceEok<=target*1.1)out.push(row);
        }else if(need<=cash){
          out.push(row);
        }
      }
      if(strategy==="target"&&target>0)out.sort((a,b)=>Math.abs(a.price-target)-Math.abs(b.price-target)||b.count-a.count||b.lastDate.localeCompare(a.lastDate));
      else out.sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)||a.need-b.need);
      return ok({mode:"recommend",months:3,criteria:{cash,ltv,areaMin:amin,areaMax:amax,scope,strategy,target},recommendations:out.slice(0,12),partialErrors:errs.length},errs.length===0);
    }
    if(!q)return res.status(400).json({error:"단지명을 입력하세요."});
    let code=req.query.region,apt=req.query.apt,dong=String(req.query.dong||"").trim();
    if(!code){
      const pm=monthsBack(3),tasks=[];
      for(const c of (REGIONS[req.query.scope]?[req.query.scope]:Object.keys(REGIONS)))for(const m of pm)tasks.push(()=>cachedMonth("trade",key,c,m).then(xs=>({c,xs})));
      const rs=await pool(tasks),errs=rs.filter(r=>r.e),found=new Map(),sub=cp(req.query.sub||"");
      rs.forEach(r=>{if(r.v)parseTrade(r.v.xs).filter(x=>x.name&&cp(x.name).includes(cp(q))&&(!sub||cp(x.dong).includes(sub))).forEach(x=>{const k=r.v.c+"|"+x.name+"|"+(x.dong||"");found.set(k,(found.get(k)||0)+1)})});
      if(!found.size){
        if(errs.length)return res.status(502).json({error:"조회 중 오류: "+errs[0].e.message+(errs.length<rs.length?" (일부 지역 실패)":"")});
        return res.status(404).json({error:"최근 3개월 매매 거래에서 단지를 찾지 못했습니다. 표기를 바꿔 다시 검색해보세요."});
      }
      const cands=[...found].map(([k,n])=>{const [c,nm,dong]=k.split("|");return{region:c,regionName:REGIONS[c],name:nm,dong,count:n}}).sort((a,b)=>b.count-a.count);
      if(cands.length>1)return ok({candidates:cands});
      code=cands[0].region;apt=cands[0].name;dong=cands[0].dong||"";
    }
    if(!REGIONS[code])return res.status(400).json({error:"지원하지 않는 지역입니다."});
    const ml=monthsBack(months),tt=[],rt=[];
    ml.forEach(ym=>{tt.push(()=>cachedMonth("trade",key,code,ym));rt.push(()=>cachedMonth("rent",key,code,ym))});
    const [tr,rr]=await Promise.all([pool(tt),pool(rt)]);
    if(tr.some(r=>r.e))throw tr.find(r=>r.e).e;
    const rentErr=rr.find(r=>r.e);
    const sameTrade=x=>cp(x.name)===cp(apt)&&(!dong||cp(x.dong)===cp(dong));
    const sameRent=x=>cp(x.name)===cp(apt)&&(!dong||!x.dong||cp(x.dong)===cp(dong));
    const byDate=(a,b)=>b.date.localeCompare(a.date);
    const trades=tr.flatMap(r=>parseTrade(r.v)).filter(sameTrade).sort(byDate);
    const rents=rentErr?[]:rr.flatMap(r=>parseRent(r.v)).filter(sameRent).sort(byDate);
    return ok({complexName:apt,regionCode:code,regionName:REGIONS[code],dong,months,trades,rents,rentError:rentErr?rentErr.e.message+" — 전월세 API 활용신청/승인을 확인하세요.":""});
  }catch(e){noStore(res);return res.status(isAuthOrQuotaError(e)?502:500).json({error:e.message||"공공데이터 조회 중 오류가 발생했습니다."})}
}
