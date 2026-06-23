# Jinny Trading v12 - 동일 종목 계좌별 저장 최종 수정

## 이번 수정 내용

- 종목 저장 기준을 `ticker` 단독에서 `account_id + ticker`로 변경
- 같은 종목을 한국투자증권 주식계좌와 한국투자증권 ISA에 각각 보유 가능
- 현재가 수정, 배당률 업데이트, 삭제를 개별 보유종목 `id` 기준으로 처리
- 종목 추가 시 fallback 계좌 ID가 저장되지 않도록 방지

## Supabase SQL

이미 아래 인덱스가 생성되어 있다면 다시 실행하지 않아도 됩니다.
확인용 SQL:

```sql
select indexname, indexdef
from pg_indexes
where tablename = 'holdings';
```

`holdings_account_ticker_unique`가 보이면 정상입니다.

처음 적용하는 경우 아래 SQL을 실행하세요.

```sql
-- 기존 ticker 단독 unique 제거
alter table holdings
  drop constraint if exists holdings_ticker_key;

drop index if exists holdings_ticker_key;

-- account_id가 비어 있는 기존 종목은 account_name 기준으로 연결
update holdings h
set account_id = a.id
from accounts a
where h.account_id is null
and h.account_name = a.account_name;

-- 그래도 account_id가 없는 기존 종목은 삼성생명 퇴직연금으로 연결
update holdings h
set account_id = a.id,
    account_name = '삼성생명 퇴직연금'
from accounts a
where h.account_id is null
and a.account_name = '삼성생명 퇴직연금';

-- 448290은 삼성증권 연금저축으로 연결
update holdings h
set account_id = a.id,
    account_name = '삼성증권 연금저축'
from accounts a
where h.ticker = '448290'
and a.account_name = '삼성증권 연금저축';

-- 같은 계좌 안에서는 같은 종목 중복 방지, 다른 계좌에는 같은 종목 허용
create unique index if not exists holdings_account_ticker_unique
on holdings(account_id, ticker);

-- 배당 내역 계좌 구분
alter table dividend_logs
add column if not exists account_id uuid;

alter table dividend_logs
  drop constraint if exists dividend_logs_account_id_fkey;

alter table dividend_logs
add constraint dividend_logs_account_id_fkey
foreign key (account_id)
references accounts(id);

create index if not exists idx_holdings_account_id
on holdings(account_id);

create index if not exists idx_dividend_logs_account_id
on dividend_logs(account_id);
```

## 업로드 방법

1. 이 ZIP 압축 해제
2. GitHub `Jinny-TH/jinnytrading` 저장소에 전체 덮어쓰기 업로드
3. Vercel 자동 배포 확인
4. 배포 후 같은 종목을 서로 다른 계좌에 다시 추가 테스트
