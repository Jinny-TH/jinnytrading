import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Jinny Invest | 종합 금융 투자 관리', description: '통합 계좌, 투자 분석, 배당 및 자산 추이를 관리하는 종합 금융 투자 관리 서비스' };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
