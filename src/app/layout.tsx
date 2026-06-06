import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '@/components/nav';

export const metadata: Metadata = {
  title: 'JAI Assistant',
  description: 'JanitorAI 角色卡生成与会话辅助工具',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
        <Nav />
        <main className="md:ml-16 lg:ml-52 pb-16 md:pb-0 min-h-screen">
          <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
