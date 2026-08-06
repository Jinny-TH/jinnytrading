import { NextResponse } from 'next/server';

function toYield(v: unknown) {
  if (v == null) return null;
  const raw = String(v).replace(/%/g, '').replace(/,/g, '').trim();
  const n = Number(raw.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1 ? n / 100 : n;
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

const fallbackYields: Record<string, number> = {
  '441640': 0.0896,
  '494300': 0.1768,
  '498400': 0.1133,
  '472150': 0.1477,
  '438080': 0.0219,
  '284430': 0.0115,
  '472170': 0.0034,
  '440340': 0.0347,
};

async function getDividendYield(code: string) {
  const clean = code.trim().toUpperCase();

  // 1) Naver Stock basic JSON. 필드명이 종목/페이지 개편에 따라 달라질 수 있어 여러 후보를 확인합니다.
  try {
    const txt = await fetchText(`https://api.stock.naver.com/stock/${encodeURIComponent(clean)}/basic`);
    const json = JSON.parse(txt);
    const candidates = [
      json.dividendYield,
      json.dividendYieldRatio,
      json.dividendRate,
      json.estimatedDividendYield,
      json.etfInfo?.dividendYield,
      json.stockItemTotalInfos?.find?.((x: any) => String(x?.key || x?.title || '').includes('배당'))?.value,
    ];
    for (const c of candidates) {
      const y = toYield(c);
      if (y) return y;
    }
  } catch {}

  // 2) Legacy finance HTML fallback. 배당수익률/분배금 관련 숫자를 최대한 추출합니다.
  try {
    const html = await fetchText(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(clean)}`);
    const patterns = [
      /배당수익률[\s\S]{0,300}?<em[^>]*>([0-9.,]+)%?<\/em>/,
      /배당수익률[\s\S]{0,300}?<span class="blind">([0-9.,]+)%?<\/span>/,
      /분배금수익률[\s\S]{0,300}?([0-9.,]+)%/,
      /시가배당률[\s\S]{0,300}?([0-9.,]+)%/,
      /dividendYield[^0-9]{0,30}([0-9.,]+)/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      const y = toYield(m?.[1]);
      if (y) return y;
    }
  } catch {}

  // 3) 기존 검증 데이터 fallback. 조회 실패 시 기존 데이터가 있던 종목만 보정합니다.
  return fallbackYields[clean] ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codes = (searchParams.get('codes') || '')
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  const yields: Record<string, number> = {};
  const missed: string[] = [];

  await Promise.all(codes.map(async (c) => {
    const y = await getDividendYield(c);
    if (y != null && y > 0) yields[c] = y;
    else missed.push(c);
  }));

  return NextResponse.json({ yields, missed, updatedAt: new Date().toISOString() });
}
