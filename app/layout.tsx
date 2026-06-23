import './globals.css';
export const metadata = { title: 'Jinny Trading', description: 'ETF portfolio dashboard' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
