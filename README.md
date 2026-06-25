# Jinny Trading v18

수정 내용:

- Vercel 빌드 오류 수정: `app/api/daily-snapshot/route.ts`의 Map iterator 문법 제거
- TypeScript target을 `es2017`로 조정
- 자동 일별 스냅샷 시세 업데이트도 보유종목 `id` 기준으로 처리
- v17 기능 유지:
  - 오늘 시세 업데이트는 시세만 갱신
  - 배당률은 별도 버튼으로 갱신
  - 현재가 입력필드 제거
  - 종목별 수정 버튼 및 수정 저장

추가 SQL은 없습니다.
