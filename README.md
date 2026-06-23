# Jinny Trading v6 - Account Dashboards

## Supabase SQL 먼저 실행

```sql
alter table holdings
add column if not exists account_name text default '삼성생명 퇴직연금';

alter table daily_snapshots
add column if not exists account_name text default '전체 계좌';

alter table daily_snapshots
drop constraint if exists daily_snapshots_snapshot_date_key;

create unique index if not exists daily_snapshots_date_account_unique
on daily_snapshots(snapshot_date, account_name);

update holdings
set account_name = '삼성생명 퇴직연금'
where account_name is null;

update holdings
set account_name = '삼성증권 연금저축'
where ticker = '448290';
```

## 변경 사항
- 전체 탭 + 계좌별 탭
- 선택 계좌별 대시보드
- 계좌별 투자금, 평가금, 손익, 월 예상 배당
- 계좌별 상위 보유 종목
- 계좌별 배당 내역 필터
- 계좌별 일별 자산 추이 저장/조회
