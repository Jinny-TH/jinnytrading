import { NextResponse } from 'next/server';
async function getPrice(code:string){
  const urls=[`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`,`https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/total`];
  for(const url of urls){try{const html=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept-language':'ko-KR,ko;q=0.9'},cache:'no-store'}).then(r=>r.text());
    let m=html.match(/<p class="no_today">[\s\S]*?<span class="blind">([0-9,]+)<\/span>/) || html.match(/"closePrice"\s*:\s*"?([0-9,]+)"?/);
    if(m?.[1]) return Number(m[1].replace(/,/g,''));
  }catch(e){}}
  return null;
}
export async function GET(req:Request){const {searchParams}=new URL(req.url);const codes=(searchParams.get('codes')||'').split(',').map(x=>x.trim()).filter(Boolean);const prices:any={};await Promise.all(codes.map(async c=>{const p=await getPrice(c); if(p) prices[c]=p;}));return NextResponse.json({prices,updatedAt:new Date().toISOString()});}
