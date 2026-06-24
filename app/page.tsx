'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Settings, Plus, Save, Trash2, Percent, Pencil } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Account = {
  id: string;
  account_name: string;
  broker?: string | null;
  account_type?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

type Holding = {
  id?: string;
  ticker: string;
  name: string;
  risk_type: string;
  region: string;
  account_id?: string | null;
  account_name?: string | null;
  accounts?: Account | null;
  quantity: number;
  avg_price: number;
  current_price: number;
  dividend_yield: number | string | null;
  dividend_cycle: string;
};

type Row = Holding & {
  accountLabel: string;
  investment: number;
  value: number;
  pl: number;
  plRate: number;
  annualDividend: number;
  hasPrice: boolean;
};

type Snap = {
  id?: string;
  snapshot_date: string;
  account_id?: string | null;
  account_name?: string | null;
  total_investment: number;
  total_value: number;
  total_profit: number;
  total_profit_rate: number;
  annual_dividend: number;
};

type DivLog = { id?: string; dividend_month: string; ticker: string | null; account_id?: string | null; amount: number };

const ALL_ACCOUNT_ID = 'ALL';
const fallbackAccounts: Account[] = [
  { id: 'fallback-1', account_name: '삼성생명 퇴직연금', broker: '삼성생명', account_type: '퇴직연금', display_order: 1, is_active: true },
  { id: 'fallback-2', account_name: '삼성증권 연금저축', broker: '삼성증권', account_type: '연금저축', display_order: 2, is_active: true },
  { id: 'fallback-3', account_name: '한국투자증권 주식계좌', broker: '한국투자증권', account_type: '주식', display_order: 3, is_active: true },
  { id: 'fallback-4', account_name: '한국투자증권 ISA', broker: '한국투자증권', account_type: 'ISA', display_order: 4, is_active: true },
];

const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR') + '원';
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const parseNumber = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

function normalizeYield(v: unknown) {
  const n = Number(v || 0);
  if (!n) return null;
  return n / 100;
}

function storedYield(v: unknown) {
  const n = Number(v || 0);
  if (!n) return 0;
  return n >= 1 ? n / 100 : n;
}

export default function Page() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(ALL_ACCOUNT_ID);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [logs, setLogs] = useState<DivLog[]>([]);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    ticker: '',
    name: '',
    risk_type: '위험',
    region: '미국',
    account_id: '',
    quantity: '',
    avg_price: '',
    dividend_yield: '',
    dividend_cycle: '월',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [div, setDiv] = useState({ dividend_month: month(), ticker: '', amount: '' });

  const accountList = useMemo(() => {
    const active = accounts.filter((a) => a.is_active !== false);
    return active.length ? active : fallbackAccounts;
  }, [accounts]);

  const accountById = useMemo(() => new Map(accountList.map((a) => [a.id, a])), [accountList]);
  const accountNameById = useMemo(() => new Map(accountList.map((a) => [a.id, a.account_name])), [accountList]);

  const isFallbackAccountId = (id?: string | null) => !!id && id.startsWith('fallback-');
  const isUuid = (id?: string | null) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const realAccountFor = (account?: Account) => {
    if (!account) return null;
    if (!isFallbackAccountId(account.id)) return account;
    return accounts.find((a) => a.account_name === account.account_name) || null;
  };

  async function resolveRealAccountForSave() {
    if (!accounts.length) {
      throw new Error('accounts 테이블을 먼저 불러와야 합니다. 새로고침 후 다시 시도해주세요.');
    }

    const preferredId = form.account_id || (selectedAccountId !== ALL_ACCOUNT_ID ? selectedAccountId : '');
    const selected = accounts.find((a) => a.id === preferredId);

    if (!selected || !isUuid(selected.id)) {
      throw new Error('계좌 선택값이 올바르지 않습니다. 설정에서 실제 계좌를 다시 선택해주세요.');
    }

    return selected;
  }

  const accountLabel = (h: Holding) => {
    if (h.accounts?.account_name) return h.accounts.account_name;
    if (h.account_id && accountNameById.has(h.account_id)) return accountNameById.get(h.account_id)!;
    return h.account_name || '미지정 계좌';
  };

  const allRows: Row[] = useMemo(
    () =>
      holdings.map((h) => {
        const hasPrice = Number(h.current_price) > 0;
        const effectivePrice = hasPrice ? Number(h.current_price) : Number(h.avg_price);
        const dy = storedYield(h.dividend_yield);
        const investment = Number(h.quantity || 0) * Number(h.avg_price || 0);
        const value = Number(h.quantity || 0) * effectivePrice;
        const pl = hasPrice ? value - investment : 0;
        return {
          ...h,
          accountLabel: accountLabel(h),
          dividend_yield: dy,
          investment,
          value,
          pl,
          plRate: investment ? pl / investment : 0,
          annualDividend: value * dy,
          hasPrice,
        };
      }),
    [holdings, accountNameById]
  );

  const selectedAccountName = selectedAccountId === ALL_ACCOUNT_ID ? '전체 계좌' : accountById.get(selectedAccountId)?.account_name || '미지정 계좌';
  const rows = useMemo(
    () => (selectedAccountId === ALL_ACCOUNT_ID ? allRows : allRows.filter((r) => r.account_id === selectedAccountId || r.accountLabel === selectedAccountName)),
    [allRows, selectedAccountId, selectedAccountName]
  );

  const accountSummaries = useMemo(() => {
    const totalValue = allRows.reduce((s, r) => s + r.value, 0);
    return accountList.map((a) => {
      const list = allRows.filter((r) => r.account_id === a.id || r.accountLabel === a.account_name);
      const investment = list.reduce((s, r) => s + r.investment, 0);
      const value = list.reduce((s, r) => s + r.value, 0);
      const annual = list.reduce((s, r) => s + r.annualDividend, 0);
      return {
        account: a,
        count: list.length,
        investment,
        value,
        profit: value - investment,
        rate: investment ? (value - investment) / investment : 0,
        annual,
        monthly: annual / 12,
        share: totalValue ? value / totalValue : 0,
      };
    });
  }, [allRows, accountList]);

  const accountTickers = useMemo(() => new Set(rows.map((r) => r.ticker)), [rows]);
  const filteredLogs = useMemo(
    () => selectedAccountId === ALL_ACCOUNT_ID ? logs : logs.filter((l) => l.account_id ? l.account_id === selectedAccountId : (!l.ticker || accountTickers.has(l.ticker))),
    [logs, selectedAccountId, accountTickers]
  );
  const filteredSnaps = useMemo(
    () =>
      snaps.filter((s) => {
        if (selectedAccountId === ALL_ACCOUNT_ID) return !s.account_id && (!s.account_name || s.account_name === '전체 계좌');
        return s.account_id === selectedAccountId || s.account_name === selectedAccountName;
      }),
    [snaps, selectedAccountId, selectedAccountName]
  );

  const totals = useMemo(() => {
    const investment = rows.reduce((s, r) => s + r.investment, 0);
    const value = rows.reduce((s, r) => s + r.value, 0);
    const annual = rows.reduce((s, r) => s + r.annualDividend, 0);
    const received = filteredLogs.reduce((s, l) => s + Number(l.amount || 0), 0);
    return { investment, value, profit: value - investment, rate: investment ? (value - investment) / investment : 0, annual, monthly: annual / 12, received };
  }, [rows, filteredLogs]);

  const selectedAccountSummary = useMemo(() => {
    if (selectedAccountId === ALL_ACCOUNT_ID) {
      return { accountName: '전체 계좌', count: allRows.length, ...totals, share: 1 };
    }
    const found = accountSummaries.find((a) => a.account.id === selectedAccountId);
    return found
      ? { accountName: found.account.account_name, count: found.count, investment: found.investment, value: found.value, profit: found.profit, rate: found.rate, annual: found.annual, monthly: found.monthly, received: totals.received, share: found.share }
      : { accountName: selectedAccountName, count: 0, investment: 0, value: 0, profit: 0, rate: 0, annual: 0, monthly: 0, received: 0, share: 0 };
  }, [selectedAccountId, allRows.length, totals, accountSummaries, selectedAccountName]);

  async function load() {
    setMsg('DB에서 불러오는 중...');
    const [a, h, s, d] = await Promise.all([
      supabase.from('accounts').select('*').order('display_order', { ascending: true }),
      supabase.from('holdings').select('*, accounts(*)').order('ticker'),
      supabase.from('daily_snapshots').select('*').order('snapshot_date'),
      supabase.from('dividend_logs').select('*').order('dividend_month', { ascending: false }),
    ]);

    if (a.error) {
      setAccounts(fallbackAccounts);
      setMsg('accounts 테이블 확인 필요: ' + a.error.message);
    } else {
      setAccounts((a.data || []) as Account[]);
      setMsg('DB 연결 완료');
    }

    if (h.error) {
      setMsg('DB 연결 오류: ' + h.error.message);
    } else {
      setHoldings((h.data || []) as Holding[]);
      setSnaps((s.data || []) as Snap[]);
      setLogs((d.data || []) as DivLog[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!accounts.length) return;
    if (!form.account_id || isFallbackAccountId(form.account_id) || !accounts.some((a) => a.id === form.account_id)) {
      setForm((f) => ({ ...f, account_id: accounts[0].id }));
    }
  }, [accounts, form.account_id]);

  async function fetchPriceForTicker(ticker: string) {
    try {
      const code = ticker.trim().toUpperCase();
      const res = await fetch('/api/prices?codes=' + encodeURIComponent(code));
      const json = await res.json();
      return Number(json.prices?.[code] || 0);
    } catch {
      return 0;
    }
  }

  async function fetchYieldForTicker(ticker: string) {
    try {
      const code = ticker.trim().toUpperCase();
      const res = await fetch('/api/dividends?codes=' + encodeURIComponent(code));
      const json = await res.json();
      const y = Number(json.yields?.[code]);
      return y > 0 ? y : null;
    } catch {
      return null;
    }
  }

  function resetHoldingForm(accountId?: string) {
    setEditingId(null);
    setForm({
      ticker: '',
      name: '',
      risk_type: '위험',
      region: '미국',
      account_id: accountId || accounts[0]?.id || '',
      quantity: '',
      avg_price: '',
      dividend_yield: '',
      dividend_cycle: '월',
    });
  }

  function editHolding(r: Row) {
    setOpen(true);
    setEditingId(r.id || null);
    const accountId = r.account_id && !isFallbackAccountId(r.account_id)
      ? r.account_id
      : accounts.find((a) => a.account_name === r.accountLabel)?.id || accounts[0]?.id || '';
    setForm({
      ticker: r.ticker,
      name: r.name,
      risk_type: r.risk_type,
      region: r.region,
      account_id: accountId,
      quantity: String(r.quantity || ''),
      avg_price: String(r.avg_price || ''),
      dividend_yield: r.dividend_yield ? (Number(r.dividend_yield) * 100).toFixed(2) : '',
      dividend_cycle: r.dividend_cycle || '월',
    });
    setMsg('선택한 종목을 설정 영역에서 수정할 수 있습니다. 저장 시 현재가를 다시 조회합니다.');
  }

  async function saveHolding() {
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker || !form.name.trim()) {
      setMsg('종목코드와 종목명을 입력해주세요.');
      return;
    }
    setBusy(true);
    setMsg('계좌 확인 중...');
    let realAccount: Account;
    try {
      realAccount = await resolveRealAccountForSave();
    } catch (e: any) {
      setBusy(false);
      setMsg(e.message || '계좌 정보를 확인하지 못했습니다. accounts 테이블과 RLS 설정을 확인해주세요.');
      return;
    }

    setMsg('종목 저장 중 · 현재가 조회 중...');
    const [fetchedPrice, fetchedYield] = await Promise.all([fetchPriceForTicker(ticker), fetchYieldForTicker(ticker)]);
    const payload = {
      ticker,
      name: form.name.trim(),
      risk_type: form.risk_type,
      region: form.region,
      account_id: realAccount.id,
      account_name: realAccount.account_name,
      quantity: Number(form.quantity || 0),
      avg_price: Number(form.avg_price || 0),
      current_price: fetchedPrice || 0,
      dividend_yield: fetchedYield ?? normalizeYield(form.dividend_yield),
      dividend_cycle: form.dividend_cycle,
    };
    const result = editingId
      ? await supabase.from('holdings').update(payload).eq('id', editingId)
      : await supabase.from('holdings').upsert(payload, { onConflict: 'account_id,ticker' });
    setBusy(false);
    if (result.error) {
      setMsg(result.error.message);
    } else {
      resetHoldingForm(realAccount.id);
      setMsg(`${editingId ? '수정' : '저장'} 완료 · 현재가 ${fetchedPrice ? won(fetchedPrice) : '미조회'} · 배당률 ${fetchedYield ? (fetchedYield * 100).toFixed(2) + '% 자동 반영' : '직접 입력값 반영'}`);
      load();
    }
  }

  async function delHolding(r: Row) {
    if (!confirm('삭제할까요?')) return;
    if (r.id) await supabase.from('holdings').delete().eq('id', r.id);
    else await supabase.from('holdings').delete().eq('ticker', r.ticker).eq('account_id', r.account_id || '');
    load();
  }

  async function changePrice(r: Row, price: number) {
    setHoldings((v) => v.map((x) => (x.id === r.id ? { ...x, current_price: price } : x)));
    if (r.id) await supabase.from('holdings').update({ current_price: price }).eq('id', r.id);
    else await supabase.from('holdings').update({ current_price: price }).eq('ticker', r.ticker).eq('account_id', r.account_id || '');
  }

  async function saveSnapshot() {
    const payload = {
      snapshot_date: today(),
      account_id: selectedAccountId === ALL_ACCOUNT_ID ? null : selectedAccountId,
      account_name: selectedAccountName,
      total_investment: totals.investment,
      total_value: totals.value,
      total_profit: totals.profit,
      total_profit_rate: totals.rate,
      annual_dividend: totals.annual,
    };
    const { error } = await supabase.from('daily_snapshots').upsert(payload, { onConflict: 'snapshot_date,account_name' });
    if (error) setMsg(error.message);
    else {
      setMsg(`${selectedAccountName} 오늘 일별 데이터 저장 완료`);
      load();
    }
  }

  async function addDividend() {
    const amount = Number(div.amount);
    if (!amount) return;
    const dividendAccountId = selectedAccountId === ALL_ACCOUNT_ID
      ? (div.ticker ? allRows.find((r) => r.ticker === div.ticker)?.account_id || null : null)
      : selectedAccountId;
    const { error } = await supabase.from('dividend_logs').insert({ dividend_month: div.dividend_month, ticker: div.ticker || null, account_id: dividendAccountId, amount });
    if (error) setMsg(error.message);
    else {
      setDiv({ ...div, amount: '' });
      load();
    }
  }

  async function delDividend(id?: string) {
    if (!id) return;
    await supabase.from('dividend_logs').delete().eq('id', id);
    load();
  }

  async function updatePrices() {
    setBusy(true);
    setMsg('오늘 시세와 배당률 조회 중...');
    try {
      const codes = rows.map((r) => r.ticker).join(',');
      const [priceRes, yieldRes] = await Promise.all([fetch('/api/prices?codes=' + encodeURIComponent(codes)), fetch('/api/dividends?codes=' + encodeURIComponent(codes))]);
      const priceJson = await priceRes.json();
      const yieldJson = await yieldRes.json();
      let count = 0;
      let yieldCount = 0;
      const missed: string[] = [];
      const yieldMissed: string[] = [];
      for (const r of rows) {
        const p = Number(priceJson.prices?.[r.ticker]);
        const y = Number(yieldJson.yields?.[r.ticker]);
        const patch: Record<string, number> = {};
        if (p > 0) {
          count += 1;
          patch.current_price = p;
        } else missed.push(r.ticker);
        if (y > 0) {
          yieldCount += 1;
          patch.dividend_yield = y;
        } else yieldMissed.push(r.ticker);
        if (Object.keys(patch).length) await supabase.from('holdings').update(patch).eq('id', r.id);
      }
      setMsg(`${count}개 시세 · ${yieldCount}개 배당률 갱신 완료${missed.length ? ` · 시세 미조회: ${missed.join(', ')}` : ''}${yieldMissed.length ? ` · 배당률 미조회: ${yieldMissed.join(', ')}` : ''}`);
      await load();
      setTimeout(saveSnapshot, 300);
    } catch (e: any) {
      setMsg('시세/배당률 조회 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateDividendYields() {
    setBusy(true);
    setMsg('배당률 자동 조회 중...');
    try {
      const codes = rows.map((r) => r.ticker).join(',');
      const res = await fetch('/api/dividends?codes=' + encodeURIComponent(codes));
      const json = await res.json();
      let count = 0;
      const missed: string[] = [];
      for (const r of rows) {
        const y = Number(json.yields?.[r.ticker]);
        if (y > 0) {
          count += 1;
          await supabase.from('holdings').update({ dividend_yield: y }).eq('id', r.id);
        } else missed.push(r.ticker);
      }
      setMsg(`${count}개 종목 배당률 갱신 완료${missed.length ? ` · 미조회: ${missed.join(', ')}` : ''}`);
      await load();
    } catch (e: any) {
      setMsg('배당률 조회 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const byMonth = useMemo(() => filteredLogs.reduce((m: Record<string, number>, l) => {
    m[l.dividend_month] = (m[l.dividend_month] || 0) + Number(l.amount);
    return m;
  }, {}), [filteredLogs]);

  const tickerLabel = (ticker: string | null) => {
    if (!ticker) return '전체/구분 없음';
    const h = allRows.find((r) => r.ticker === ticker);
    return h ? `${h.name} · ${ticker}` : ticker;
  };

  return (
    <main className="wrap">
      <header className="hero">
        <div>
          <div className="eyebrow">JINNY TRADING</div>
          <h1 className="title">ETF 포트폴리오</h1>
          <p className="sub">계좌 테이블 분리 · Supabase DB 저장 · 매일 오전 3시 자동 기록</p>
        </div>
        <div className="toolbar">
          <button className="btn blue" onClick={updatePrices} disabled={busy}><RefreshCw size={15}/> 오늘 시세 업데이트</button>
          <button className="btn green" onClick={saveSnapshot}><Save size={15}/> 오늘 기록 저장</button>
          <button className="btn" onClick={updateDividendYields} disabled={busy}><Percent size={15}/> 배당률 업데이트</button>
          <button className="btn" onClick={() => setOpen(!open)}><Settings size={15}/> 설정</button>
        </div>
      </header>

      {msg && <p className="warn">{msg}</p>}

      <section className="section">
        <div className="sectionHead"><h2>계좌별 대시보드</h2><span className="sub">전체 또는 계좌별로 투자 현황을 확인합니다.</span></div>
        <div className="accountTabs">
          <button className={'accountTab ' + (selectedAccountId === ALL_ACCOUNT_ID ? 'active' : '')} onClick={() => setSelectedAccountId(ALL_ACCOUNT_ID)}>전체 계좌</button>
          {accountList.map((a) => <button key={a.id} className={'accountTab ' + (selectedAccountId === a.id ? 'active' : '')} onClick={() => setSelectedAccountId(a.id)}>{a.account_name}</button>)}
        </div>
        <div className="card accountDashboard">
          <div>
            <div className="metricLabel">선택 계좌</div>
            <div className="dashTitle">{selectedAccountSummary.accountName}</div>
            <div className="sub">{selectedAccountSummary.count}개 종목 · 전체 평가금 대비 {(selectedAccountSummary.share * 100).toFixed(1)}%</div>
          </div>
          <div className="dashMetrics">
            <Metric label="투자금" value={won(selectedAccountSummary.investment)} />
            <Metric label="평가금" value={won(selectedAccountSummary.value)} />
            <Metric label="손익" value={won(selectedAccountSummary.profit)} tone={selectedAccountSummary.profit >= 0 ? 'gain' : 'loss'} sub={pct(selectedAccountSummary.rate)} />
            <Metric label="월 예상 배당" value={won(selectedAccountSummary.monthly)} />
          </div>
          <div className="accountBars">
            {accountSummaries.map((a) => (
              <div key={a.account.id} className="accountBarRow">
                <div><b>{a.account.account_name}</b><span>{won(a.value)} · {(a.share * 100).toFixed(1)}%</span></div>
                <div className="bar"><span style={{ width: Math.min(100, a.share * 100) + '%' }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid accountGrid">
          {accountSummaries.map((a) => (
            <div className="card accountCard" key={a.account.id}>
              <div className="metricLabel">{a.account.account_name}</div>
              <div className="metric">{won(a.value)}</div>
              <div className="sub">{a.count}개 종목 · 투자 {won(a.investment)}</div>
              <div className={a.profit >= 0 ? 'gain' : 'loss'}><b>{won(a.profit)}</b> {pct(a.rate)}</div>
              <div className="sub">월 예상 배당 {won(a.monthly)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><h2>{selectedAccountName} 보유 종목</h2><span className="sub">{rows.length}개 종목</span></div>
        <div className="card tableWrap">
          <table className="table">
            <thead><tr><th>계좌</th><th>구분</th><th>종목</th><th className="num">수량</th><th className="num">평균단가</th><th className="num">현재가</th><th className="num">평가금액</th><th className="num">손익</th><th className="num">배당</th><th className="num">관리</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || `${r.account_id}-${r.ticker}`}> 
                  <td><span className="accountPill">{r.accountLabel}</span></td>
                  <td><span className={'pill ' + (r.risk_type === '위험' ? 'risk' : '')}>{r.risk_type}</span></td>
                  <td><b>{r.name}</b><div className="sub">{r.region} · {r.ticker}</div></td>
                  <td className="num">{Number(r.quantity).toLocaleString()}</td>
                  <td className="num">{Math.round(Number(r.avg_price)).toLocaleString()}</td>
                  <td className="num">{Number(r.current_price) > 0 ? Math.round(Number(r.current_price)).toLocaleString('ko-KR') : '미조회'}</td>
                  <td className="num"><b>{won(r.value)}</b></td>
                  <td className={'num ' + (!r.hasPrice ? '' : r.pl >= 0 ? 'gain' : 'loss')}><b>{r.hasPrice ? won(r.pl) : '현재가 필요'}</b><div>{r.hasPrice ? pct(r.plRate) : '-'}</div></td>
                  <td className="num">{r.dividend_yield ? `${(Number(r.dividend_yield) * 100).toFixed(2)}% · ${r.dividend_cycle}` : '없음'}</td>
                  <td className="num"><div className="rowActions"><button className="btn" onClick={() => editHolding(r)}><Pencil size={14}/> 수정</button><button className="btn" onClick={() => delHolding(r)}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section grid two">
        <div>
          <div className="sectionHead"><h2>월별 배당 수령 내역</h2></div>
          <div className="card">
            <div className="form dividendForm">
              <input className="input" type="month" value={div.dividend_month} onChange={(e) => setDiv({ ...div, dividend_month: e.target.value })} />
              <select className="input" value={div.ticker} onChange={(e) => setDiv({ ...div, ticker: e.target.value })}>
                <option value="">전체/구분 없음</option>
                {rows.map((r) => <option key={r.id || `${r.account_id}-${r.ticker}`} value={r.ticker}>{r.name} · {r.accountLabel}</option>)}
              </select>
              <input className="input" placeholder="수령 금액" value={div.amount} onChange={(e) => setDiv({ ...div, amount: e.target.value })} />
              <button className="btn primary" onClick={addDividend}><Plus size={15}/> 추가</button>
            </div>
            <div className="miniList" style={{ marginTop: 14 }}>
              {Object.entries(byMonth).map(([m, a]) => <div className="miniRow" key={m}><b>{m}</b><b>{won(Number(a))}</b></div>)}
              {filteredLogs.slice(0, 8).map((l) => <div className="miniRow" key={l.id}><span>{l.dividend_month} · {tickerLabel(l.ticker)}</span><span>{won(l.amount)} <button className="btn" onClick={() => delDividend(l.id)}>삭제</button></span></div>)}
            </div>
          </div>
        </div>
        <div>
          <div className="sectionHead"><h2>배당 현황</h2></div>
          <div className="card miniList">
            <div className="miniRow"><span>연간 예상 배당</span><b>{won(totals.annual)}</b></div>
            <div className="miniRow"><span>월 예상 배당</span><b>{won(totals.monthly)}</b></div>
            <div className="miniRow"><span>누적 수령 배당</span><b>{won(totals.received)}</b></div>
            <div><div className="sub">평가금 대비 배당률</div><div className="bar"><span style={{ width: Math.min(100, totals.value ? (totals.annual / totals.value) * 1000 : 0) + '%' }} /></div></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead"><h2>{selectedAccountName} 일별 자산 추이</h2><span className="sub">{filteredSnaps.length}일 기록</span></div>
        <div className="card chart">
          {filteredSnaps.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredSnaps}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="snapshot_date"/><YAxis hide domain={['dataMin', 'dataMax']}/><Tooltip formatter={(v: any) => won(Number(v))}/><Line type="monotone" dataKey="total_value" strokeWidth={3} dot={false}/></LineChart>
            </ResponsiveContainer>
          ) : <span className="sub">선택한 계좌의 기록이 2일 이상 저장되면 그래프가 표시됩니다.</span>}
        </div>
      </section>

      <section className={'section settings ' + (open ? 'open' : '')}>
        <div className="sectionHead"><h2>설정</h2></div>
        <div className="card">
          <div className="toolbar" style={{ justifyContent: 'flex-start', marginBottom: 14 }}><button className="btn" onClick={load}>DB 새로고침</button>{editingId && <button className="btn" onClick={() => resetHoldingForm()}>신규 입력으로 전환</button>}</div>
          <div className="form">
            <input className="input" placeholder="종목코드" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
            <input className="input" placeholder="종목명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.risk_type} onChange={(e) => setForm({ ...form, risk_type: e.target.value })}><option>위험</option><option>안전</option></select>
            <select className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option>미국</option><option>한국</option></select>
            <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select>
            <input className="input" placeholder="수량" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className="input" placeholder="평균단가" value={form.avg_price} onChange={(e) => setForm({ ...form, avg_price: e.target.value })} />
            <input className="input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="배당률 % 예: 1.15" value={form.dividend_yield} onChange={(e) => setForm({ ...form, dividend_yield: e.target.value })} />
            <button className="btn green" onClick={saveHolding} disabled={busy || !accounts.length}>저장 후 현재가 조회</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="card"><div className="metricLabel">{label}</div><div className={'metric ' + (tone || '')}>{value}</div>{sub && <div className="sub">{sub}</div>}</div>;
}
