import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Jinny Trading', description: 'ETF portfolio dashboard' };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
