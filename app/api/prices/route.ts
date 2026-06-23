import { NextResponse } from 'next/server';

function toNumber(v: unknown) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      referer: 'https://finance.naver.com/',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
}

async function getPrice(code: string) {
  const clean = code.trim().toUpperCase();

  // 1) Naver Stock JSON API. ETF도 상당수 조회됩니다.
  try {
    const txt = await fetchText(`https://api.stock.naver.com/stock/${encodeURIComponent(clean)}/basic`);
    const json = JSON.parse(txt);
    const p = toNumber(json.closePrice || json.now || json.compareToPreviousClosePrice);
    if (p) return p;
  } catch {}

  // 2) Naver realtime polling API fallback.
  try {
    const txt = await fetchText(`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(clean)}`);
    const json = JSON.parse(txt);
    const item = json?.result?.areas?.[0]?.datas?.[0];
    const p = toNumber(item?.nv || item?.closePrice || item?.now);
    if (p) return p;
  } catch {}

  // 3) Legacy finance HTML fallback.
  try {
    const html = await fetchText(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(clean)}`);
    const m = html.match(/<p class="no_today">[\s\S]*?<span class="blind">([0-9,]+)<\/span>/)
      || html.match(/"closePrice"\s*:\s*"?([0-9,]+)"?/);
    const p = toNumber(m?.[1]);
    if (p) return p;
  } catch {}

  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codes = (searchParams.get('codes') || '')
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  const prices: Record<string, number> = {};
  const missed: string[] = [];

  await Promise.all(codes.map(async (c) => {
    const p = await getPrice(c);
    if (p) prices[c] = p;
    else missed.push(c);
  }));

  return NextResponse.json({ prices, missed, updatedAt: new Date().toISOString() });
}
