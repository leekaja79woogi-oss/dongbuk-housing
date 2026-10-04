const REGIONS={"41310":"구리시","41360":"남양주시","41150":"의정부시","11260":"서울 중랑구","11350":"서울 노원구","11320":"서울 도봉구","11305":"서울 강북구","11215":"서울 광진구","11230":"서울 동대문구","11200":"서울 성동구","11290":"서울 성북구","11740":"서울 강동구"};
const TRADE=["https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade","https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"];
const RENT="https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

const monthsBack=n=>{const k=new Date(Date.now()+9*3600e3);return Array.from({length:n},(_,i)=>{const d=new Date(Date.UTC(k.getUTCFullYear(),k.getUTCMonth()-i,1));return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}`})};
const dec=s=>String(s||"").replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&amp;/g,"&").trim();
const tag=(x,names)=>{for(const n of names){const m=x.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`,"i"));if(m)return dec(m[1])}return""};
const items=x=>[...x.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
const num=s=>+(String(s||"").replace(/,/g,"")||0);
const cp=s=>String(s||"").replace(/\s/g,"").toLowerCase();
const dateOf=x=>{const y=tag(x,["dealYear"]),m=tag(x,["dealMonth"]),d=tag(x,["dealDay"]);return y?`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`:""};

async function page(url,key,lawd,ym,p){
  const qs=new URLSearchParams({serviceKey:key,LAWD_CD:lawd,DEAL_YMD:ym,numOfRows:"1000",pageNo:String(p)});
  const r=await fetch(`${url}?${qs}`);const t=await r.text();
  if(!r.ok)throw new Error("공공데이터 HTTP "+r.status);
  const code=tag(t,["returnReasonCode","resultCode"]);
  if(code&&!/^0+$/.test(code))throw new Error((tag(t,["returnAuthMsg","resultMsg"])||"API 오류")+" ("+code+")");
  return t;
}
async function all(url,key,lawd,ym){
  const first=await page(url,key,lawd,ym,1);let xs=items(first);const total=+tag(first,["totalCount"])||xs.length;
  for(let p=2;(p-1)*1000<total&&p<=10;p++)xs=xs.concat(items(await page(url,key,lawd,ym,p)));
  return xs;
}
async function tradeMonth(key,lawd,ym){let last;for(const u of TRADE){try{return await all(u,key,lawd,ym)}catch(e){last=e}}throw last}
async function pool(tasks,n=8){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<tasks.length){const k=i++;out[k]=await tasks[k]().then(v=>({v}),e=>({e}))}}));return out}

const parseTrade=xs=>xs.filter(x=>tag(x,["cdealType"])!=="O").map(x=>({name:tag(x,["aptNm"]),date:dateOf(x),area:+tag(x,["excluUseAr"]),price:num(tag(x,["dealAmount"])),floor:+tag(x,["floor"])||0,direct:tag(x,["dealingGbn"])==="직거래"}));
const parseRent=xs=>xs.map(x=>({name:tag(x,["aptNm"]),date:dateOf(x),area:+tag(x,["excluUseAr"]),deposit:num(tag(x,["deposit"])),monthly:num(tag(x,["monthlyRent"])),floor:+tag(x,["floor"])||0,renewal:tag(x,["contractType"])==="갱신"||tag(x,["useRRRight"])==="사용"}));

export default async function handler(req,res){
  const need=process.env.APP_TOKEN;
  if(need&&(req.headers["x-app-token"]||req.query.token)!==need)return res.status(401).json({error:"접근 토큰이 필요합니다."});
  let key=process.env.DATA_GO_KR_SERVICE_KEY;
  if(!key)return res.status(500).json({error:"서버 환경변수 DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다."});
  if(key.includes("%"))key=decodeURIComponent(key);
  const q=String(req.query.complex||"").trim();
  if(!q)return res.status(400).json({error:"단지명을 입력하세요."});
  const months=Math.min(Math.max(+req.query.months||12,1),24);
  const ok=body=>{res.setHeader("Cache-Control","s-maxage=21600, stale-while-revalidate=43200");return res.status(200).json(body)};
  try{
    let code=req.query.region,apt=req.query.apt;
    if(!code){
      const pm=monthsBack(3),tasks=[];
      for(const c of Object.keys(REGIONS))for(const m of pm)tasks.push(()=>tradeMonth(key,c,m).then(xs=>({c,xs})));
      const rs=await pool(tasks),errs=rs.filter(r=>r.e),found=new Map();
      rs.forEach(r=>{if(r.v)parseTrade(r.v.xs).filter(x=>x.name&&cp(x.name).includes(cp(q))).forEach(x=>{const k=r.v.c+"|"+x.name;found.set(k,(found.get(k)||0)+1)})});
      if(!found.size){
        if(errs.length)return res.status(502).json({error:"조회 중 오류: "+errs[0].e.message+(errs.length<rs.length?" (일부 지역 실패)":"")});
        return res.status(404).json({error:"최근 3개월 매매 거래에서 단지를 찾지 못했습니다. 표기를 바꿔 다시 검색해보세요."});
      }
      const cands=[...found].map(([k,n])=>{const [c,nm]=k.split("|");return{region:c,regionName:REGIONS[c],name:nm,count:n}}).sort((a,b)=>b.count-a.count);
      if(cands.length>1)return ok({candidates:cands});
      code=cands[0].region;apt=cands[0].name;
    }
    if(!REGIONS[code])return res.status(400).json({error:"지원하지 않는 지역입니다."});
    const ml=monthsBack(months),tt=[],rt=[];
    ml.forEach(ym=>{tt.push(()=>tradeMonth(key,code,ym));rt.push(()=>all(RENT,key,code,ym))});
    const [tr,rr]=await Promise.all([pool(tt),pool(rt)]);
    if(tr.some(r=>r.e))throw tr.find(r=>r.e).e;
    const rentErr=rr.find(r=>r.e);
    const same=x=>cp(x.name)===cp(apt),byDate=(a,b)=>b.date.localeCompare(a.date);
    const trades=tr.flatMap(r=>parseTrade(r.v)).filter(same).sort(byDate);
    const rents=rentErr?[]:rr.flatMap(r=>parseRent(r.v)).filter(same).sort(byDate);
    return ok({complexName:apt,regionCode:code,regionName:REGIONS[code],months,trades,rents,rentError:rentErr?rentErr.e.message+" — 전월세 API 활용신청/승인을 확인하세요.":""});
  }catch(e){return res.status(500).json({error:e.message||"공공데이터 조회 중 오류가 발생했습니다."})}
}
