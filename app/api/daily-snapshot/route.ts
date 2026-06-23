import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Account = { id: string; account_name: string };
type Holding = {
  ticker: string;
  account_id?: string | null;
  account_name?: string | null;
  quantity: number | string;
  avg_price: number | string;
  current_price: number | string;
  dividend_yield: number | string | null;
};

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
  try {
    const txt = await fetchText(`https://api.stock.naver.com/stock/${encodeURIComponent(clean)}/basic`);
    const json = JSON.parse(txt);
    const p = toNumber(json.closePrice || json.now || json.compareToPreviousClosePrice);
    if (p) return p;
  } catch {}
  try {
    const txt = await fetchText(`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(clean)}`);
    const json = JSON.parse(txt);
    const item = json?.result?.areas?.[0]?.datas?.[0];
    const p = toNumber(item?.nv || item?.closePrice || item?.now);
    if (p) return p;
  } catch {}
  try {
    const html = await fetchText(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(clean)}`);
    const m = html.match(/<p class="no_today">[\s\S]*?<span class="blind">([0-9,]+)<\/span>/) || html.match(/"closePrice"\s*:\s*"?([0-9,]+)"?/);
    const p = toNumber(m?.[1]);
    if (p) return p;
  } catch {}
  return null;
}

function getKoreaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function calcSnapshot(holdings: Holding[], accountName: string, accountId: string | null) {
  const totalInvestment = holdings.reduce((sum, h) => sum + Number(h.quantity || 0) * Number(h.avg_price || 0), 0);
  const totalValue = holdings.reduce((sum, h) => sum + Number(h.quantity || 0) * Number(h.current_price || 0), 0);
  const totalProfit = totalValue - totalInvestment;
  const totalProfitRate = totalInvestment ? totalProfit / totalInvestment : 0;
  const annualDividend = holdings.reduce((sum, h) => sum + Number(h.quantity || 0) * Number(h.current_price || 0) * Number(h.dividend_yield || 0), 0);
  return { snapshot_date: getKoreaDate(), account_id: accountId, account_name: accountName, total_investment: totalInvestment, total_value: totalValue, total_profit: totalProfit, total_profit_rate: totalProfitRate, annual_dividend: annualDividend };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'Supabase environment variables are missing.' }, { status: 500 });

  const supabase = createClient(url, key);
  const [{ data: accountData }, { data, error }] = await Promise.all([
    supabase.from('accounts').select('id, account_name').eq('is_active', true).order('display_order'),
    supabase.from('holdings').select('*'),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const accounts = (accountData || []) as Account[];
  const accountNameById = new Map(accounts.map((a) => [a.id, a.account_name]));
  const holdings = (data || []) as Holding[];
  const missed: string[] = [];
  let updatedCount = 0;

  for (const h of holdings) {
    const price = await getPrice(h.ticker);
    if (price) {
      updatedCount += 1;
      h.current_price = price;
      await supabase.from('holdings').update({ current_price: price }).eq('ticker', h.ticker);
    } else {
      missed.push(h.ticker);
    }
  }

  const snapshots = [calcSnapshot(holdings, '전체 계좌', null)];
  const usedKeys = new Set<string>();

  for (const a of accounts) {
    const accountHoldings = holdings.filter((h) => h.account_id === a.id || h.account_name === a.account_name);
    snapshots.push(calcSnapshot(accountHoldings, a.account_name, a.id));
    usedKeys.add(a.id);
  }

  // 계좌 테이블에 아직 매핑되지 않은 과거 데이터도 누락 없이 저장합니다.
  const legacyNames = Array.from(new Set(holdings.filter((h) => !h.account_id && h.account_name).map((h) => h.account_name as string)));
  for (const name of legacyNames) {
    if ([...accountNameById.values()].includes(name)) continue;
    const accountHoldings = holdings.filter((h) => !h.account_id && h.account_name === name);
    snapshots.push(calcSnapshot(accountHoldings, name, null));
  }

  const { error: snapshotError } = await supabase.from('daily_snapshots').upsert(snapshots, { onConflict: 'snapshot_date,account_name' });
  if (snapshotError) return NextResponse.json({ ok: false, error: snapshotError.message, updatedCount, missed }, { status: 500 });

  return NextResponse.json({ ok: true, snapshotDate: getKoreaDate(), updatedCount, missed, savedSnapshots: snapshots.length });
}
