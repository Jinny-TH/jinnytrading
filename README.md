# Jinny Trading v9 - Accounts Table

이번 버전 변경 사항:

- `accounts` 테이블 분리
- `한국투자증권 ISA` 계좌 추가
- 계좌 탭을 DB에서 자동 생성
- 설정의 `기본 ETF 데이터 DB에 넣기` 버튼 삭제
- 종목 추가 시 계좌 선택값을 `account_id`로 저장
- 매일 오전 3시 자동 기록에서도 계좌별 `account_id/account_name` 저장

## 업로드 전에 Supabase SQL Editor에서 실행

```sql
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null unique,
  broker text,
  account_type text,
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into accounts (account_name, broker, account_type, display_order, is_active)
values
  ('삼성생명 퇴직연금', '삼성생명', '퇴직연금', 1, true),
  ('삼성증권 연금저축', '삼성증권', '연금저축', 2, true),
  ('한국투자증권 주식계좌', '한국투자증권', '주식', 3, true),
  ('한국투자증권 ISA', '한국투자증권', 'ISA', 4, true)
on conflict (account_name) do update set
  broker = excluded.broker,
  account_type = excluded.account_type,
  display_order = excluded.display_order,
  is_active = excluded.is_active;

alter table holdings
add column if not exists account_id uuid references accounts(id);

alter table holdings
add column if not exists account_name text;

update holdings h
set account_id = a.id,
    account_name = a.account_name
from accounts a
where coalesce(h.account_name, '삼성생명 퇴직연금') = a.account_name;

update holdings h
set account_id = a.id,
    account_name = a.account_name
from accounts a
where h.ticker = '448290'
  and a.account_name = '삼성증권 연금저축';

alter table daily_snapshots
add column if not exists account_id uuid references accounts(id);

alter table daily_snapshots
add column if not exists account_name text default '전체 계좌';

alter table daily_snapshots
drop constraint if exists daily_snapshots_snapshot_date_key;

drop index if exists daily_snapshots_date_account_unique;

create unique index if not exists daily_snapshots_date_account_unique
on daily_snapshots(snapshot_date, account_name);
```

## Vercel Cron

`vercel.json`에 매일 한국시간 오전 3시 실행 스케줄이 포함되어 있습니다.

```json
{
  "crons": [{ "path": "/api/daily-snapshot", "schedule": "0 18 * * *" }]
}
```

UTC 18:00 = 한국시간 03:00입니다.

## 테스트

배포 후 아래 주소를 열어 `{ "ok": true }`가 나오면 자동 기록 API가 정상입니다.

```text
https://jinnytrading.vercel.app/api/daily-snapshot
```
