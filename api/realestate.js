const REGIONS={"41310":"구리시","41360":"남양주시","41150":"의정부시","11260":"서울 중랑구","11350":"서울 노원구","11320":"서울 도봉구","11305":"서울 강북구","11215":"서울 광진구","11230":"서울 동대문구","11200":"서울 성동구","11290":"서울 성북구","11740":"서울 강동구"};
컨스펙트 거래=["https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade ","https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev "];
지난="https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent "를 구성합니다;

컨스펙트 몇 달 전=n=>{컨스펙트 k=신규 Date(Date.지금이다()+9*3600e3);Array.from({length:n},(_,i)=>{컨스펙트 d=신규 날짜(Date).UTC(k.get)UTCFullYear(),k.getUTCMonth()-i,1));돌아가다 `${d.getUTCFullYear()${String(d.get)UTCMonth()+1).padStart(2,"0")}`})};
컨스펙트 12 월=s=>끈(s||).replace(/<!\\\[CDATA\\[|\\]\\\]>/g", "replace(/<g)", <"replace(/>/g)", >'replace(/"/"/"/"g","replace(/&/g")", &"tim();
컨스펙트 태그=(x, 이름)=>{(이름의 상수 n){컨스펙트 m=x.match(새로운 RegExp('<${n}>([\\s\\S]*?)<${n}>',i");한다면(m)돌아가다 dec(m[1]})돌아가다"};
컨스펙트 항목들=x=>[...x.matchAll(/<item>([\\s\\S]*)<\/item>/gi)].map(m=>m[1]);
컨스펙트 숫자=s=>+("string(s||")", "replace(/,/g")||0);
컨스펙트 CP=s=>String(s||".replace(/\\s/g")", .toLowerCase();
컨스펙트 날짜=>{컨스펙트 y=tag(x, ["거래 연도"]), m=tag(x, ["거래 월"]), d=tag(x, ["거래의 날"]); 반환 y?`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`:""};

비동기 함수 페이지(url, 키, 로드, ym, p){
 컨스펙트 qs=신규 URLesearchParams({serviceKey:key,LAWD_CD:lawd,DEAL_YMD:ym,numOfRows:"1000",pageNo:String(p));
 컨스펙트 r=기다리다 fetch('${url}?${qs}′;const t = await r.text ();
 한다면(!r.ok)새 오류("공공데이터 HTTP "+r.status")를 던집니다;
 컨스펙트 코드=tag(t,["retturnReasonCode","resultCode"]);
 한다면(code&&!/^0+$/.test(code))는 새로운 오류((tag(t))["return")를 던집니다AuthMsg","resultMsg"]||"API 오류)+"("+코드+");
 반환 t;
}
비동기 함수 all(url, 키, lawd, ym){
 컨스펙트 첫번째=기다리다 페이지(url, 키, 로드, ym, 1);허락하다 xs=items(first);컨스펙트 총=+tag(첫 번째, ["총 개수"]|xs.length;
 위해서(허락하다 p=2;(p-1)*1000<total&&p<=10;p++)xs=xs.concat(items(기다리다 page(url,key,lawd,ym,p)));
 xs 반환;
}
비동기 함수 무역의 달(키, 로드, YM){마지막으로;위해서(무역 의 컨스펙트 u){trywait all(u, 키, 로드, YM)}또 만나(e){마지막=e}던지다 마지막}
비동기 기능. 수영장(임무들,n=8){컨스펙트 나가.=[];허락하다 i=0;기다리다 약속..모든.(배열.부터({길이:n},비동기()=>{하는 동안에(i<임무들.길이){컨스펙트 k=i++;나가.[k]=기다리다 임무들[k]().그리고나서(v=>({v}),e=>({e}))}}));돌아가다 나가.}

컨스펙트 파섹트레이드=xs=>xs.필터(x=>태그(x,["cdealType"])!=="O").지도(x=>({이름.:태그(x, ["aptNm"]), 날짜.:날짜(x),지역:+태그(x,["excluUseAr"]),가격.:숫자(태그(x,["거래 금액"])),바닥.:+태그(x,["바닥"])||0,직접적인:태그(x,["Gbn 거래"])==="직거래"}));
컨스펙트 구문 분석=xs=>xs.지도(x=>({이름.:태그(x, ["aptNm"]), 날짜.:날짜(x),지역:+태그(x,["excluUseAr"]),보증금:숫자(태그(x,["deposit"])),매월의:숫자(태그(x,["월세"])),바닥.:+태그(x,["바닥"])||0,갱신:태그(x,["계약 유형"])==="갱신"||태그(x,["useRRRight"])==="사용"}));

수출 체납 비동기 기능. 핸들러(필요,해상도){
 컨스펙트 필요하다.=과정.부러움.APP_TOKEN;
 한다면(필요하다.&&(필요.헤더["x-app-token"]|필요.쿼리.상품권)!==필요하다.)돌아가다 해상도.상황(401).제이슨({오류:"접근 토큰이 필요합니다."});
 허락하다 열쇠=과정.부러움.데이터_GO_KR_Service_KEY;
 한다면(!열쇠)돌아가다 해상도.상황(500).제이슨({오류:"서버 환경변수 DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다."});
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
