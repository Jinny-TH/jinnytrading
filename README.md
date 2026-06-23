# Jinny Trading v13

## 수정 내용
- 설정 > 종목 추가 시 `fallback-*` 계좌 ID 때문에 저장이 막히던 문제 수정
- 저장 시 `accounts` 테이블에서 실제 UUID를 다시 조회해서 `holdings.account_id`에 저장
- 동일 종목을 여러 계좌에 각각 저장하는 구조 유지

## 필요한 SQL
이미 v11/v12 SQL을 실행했다면 추가 SQL은 필요 없습니다.

그래도 계좌 조회 또는 저장 문제가 계속되면 Supabase SQL Editor에서 아래 확인용 SQL을 실행하세요.

```sql
select id, account_name, broker, account_type, display_order, is_active
from accounts
order by display_order;
```

RLS로 조회가 막히면 개인용 사이트 기준으로 아래를 실행하세요.

```sql
alter table accounts disable row level security;
alter table holdings disable row level security;
alter table dividend_logs disable row level security;
alter table daily_snapshots disable row level security;
```

동일 종목을 여러 계좌에 저장하기 위한 인덱스 확인:

```sql
select indexname, indexdef
from pg_indexes
where tablename='holdings';
```

아래 인덱스가 보여야 합니다.

```sql
create unique index if not exists holdings_account_ticker_unique
on holdings(account_id, ticker);
```
