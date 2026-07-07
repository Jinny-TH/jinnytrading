# Jinny Trading v24 - 추가매수 / 거래내역

## 반영 내용
- 보유 종목별 `추가매수` 버튼 추가
- 추가수량 / 매수단가 입력 시 총수량, 새 평균단가, 매수금액 자동 계산
- 저장 시 holdings의 `quantity`, `avg_price` 자동 업데이트
- transactions 테이블에 거래내역 저장
- 모바일에서도 하단 팝업 형태로 추가매수 입력 가능

## Supabase SQL
아래 SQL을 Supabase SQL Editor에서 먼저 실행하세요.

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
