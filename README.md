# Jinny Trading v26 — 월 배당률 표시

## 변경 사항
- 월별 배당 합계에 `월 0.323%` 형식으로 표시
- 개별 배당 수령 내역에도 `월 0.041%` 형식으로 표시
- 계산 기준: 선택한 전체/계좌의 총 투자금 대비 해당 수령 배당금
- 모바일에서도 배당률이 잘 보이도록 초록색 보조 텍스트 적용

## SQL
추가 SQL 없음

# Jinny Trading v25 - 월별 수령 배당률 표시 + 추가매수

## 새로 반영한 내용
- 월별 배당 수령 합계 옆에 `총 투자금 대비 실제 수령 배당률` 표시
- 개별 배당 수령 내역에도 동일한 기준의 배당률 표시
- 전체 계좌 선택 시 전체 투자금, 개별 계좌 선택 시 해당 계좌 투자금을 기준으로 계산
- 계산식: `수령 배당금 ÷ 총 투자금 × 100`

예시:
- 총 투자금 200,000,000원
- 7월 수령 배당금 645,999원
- 표시 배당률 0.323%

## 기존 v24 기능 유지
- 보유 종목별 추가매수
- 추가 수량/매수 단가 입력
- 새 수량/새 평균단가 자동 계산
- `transactions` 거래내역 저장

## Supabase SQL
v24에서 아래 SQL을 아직 실행하지 않았다면 실행하세요. 이번 배당률 표시 기능 자체에는 추가 SQL이 없습니다.

```sql
create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    holding_id uuid not null references holdings(id) on delete cascade,
    trade_date date not null default current_date,
    trade_type text not null,
    quantity numeric not null,
    price numeric not null,
    amount numeric generated always as (quantity * price) stored,
    memo text,
    created_at timestamptz default now()
);

create index if not exists idx_transactions_holding
on transactions(holding_id);

create index if not exists idx_transactions_trade_date
on transactions(trade_date);

alter table transactions disable row level security;
```

## 업로드 방법
1. ZIP 압축 해제
2. GitHub `Jinny-TH/jinnytrading`에 전체 덮어쓰기 업로드
3. Vercel 자동 배포 확인
