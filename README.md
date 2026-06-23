# Jinny Trading v3

Next.js + Supabase ETF portfolio dashboard.

## v3 fixes
- 설정의 배당률 입력 필드: 소수점 2자리까지 입력 가능 (`step=0.01`)
- 설정의 현재가 입력 필드 삭제
- 종목 저장 시 네이버금융 시세 API로 현재가 자동 조회 후 저장
- 월별 배당 수령 내역에 종목번호 대신 종목명 + 종목코드 표시
- 과거 배당률 입력 오류 일부 보정

## Vercel Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
