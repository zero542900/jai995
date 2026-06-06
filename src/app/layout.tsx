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

/**
 * 主题初始化脚本 - 内联执行，在首次绘制前应用主题
 * 避免主题闪烁（FOUC）
 */
const themeInitScript = `
(function() {
  try {
    var themeId = localStorage.getItem('jai_theme') || 'rose';
    var themes = {
      rose: {
        'jai-bg': '#E8D5D5', 'jai-secondary': '#D4B8B8', 'jai-accent': '#C4A2A2',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0CECE', 'jai-input-bg': '#F2EBEB',
        'jai-text': '#4A3F3F', 'jai-text-secondary': '#8A7F7F', 'jai-muted': '#F2EBEB',
        'jai-success': '#7DB8A0', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(200,170,170,0.15)'
      },
      ocean: {
        'jai-bg': '#D5DDE8', 'jai-secondary': '#B8C4D4', 'jai-accent': '#A2B0C4',
        'jai-card': '#FFFFFF', 'jai-card-border': '#CED8E0', 'jai-input-bg': '#EBF0F2',
        'jai-text': '#3F4A5A', 'jai-text-secondary': '#7F8A9A', 'jai-muted': '#EBF0F2',
        'jai-success': '#7DA0B8', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(170,185,200,0.15)'
      },
      forest: {
        'jai-bg': '#D5E0D8', 'jai-secondary': '#B8D4BD', 'jai-accent': '#A2C4A8',
        'jai-card': '#FFFFFF', 'jai-card-border': '#CEDEC2', 'jai-input-bg': '#EBF2EB',
        'jai-text': '#3F4A42', 'jai-text-secondary': '#7F8A80', 'jai-muted': '#EBF2EB',
        'jai-success': '#7DB8A0', 'jai-thinking': '#8bb8f6', 'jai-shadow': 'rgba(170,200,175,0.15)'
      },
      dusk: {
        'jai-bg': '#DDD5E0', 'jai-secondary': '#C4B8D0', 'jai-accent': '#B0A2C0',
        'jai-card': '#FFFFFF', 'jai-card-border': '#D8CEE0', 'jai-input-bg': '#F0EBF2',
        'jai-text': '#453F4A', 'jai-text-secondary': '#857F8A', 'jai-muted': '#F0EBF2',
        'jai-success': '#8AA0B8', 'jai-thinking': '#9b7ff6', 'jai-shadow': 'rgba(185,170,200,0.15)'
      },
      sand: {
        'jai-bg': '#E0D8D0', 'jai-secondary': '#D0C4B8', 'jai-accent': '#C0B0A2',
        'jai-card': '#FFFFFF', 'jai-card-border': '#DED0C8', 'jai-input-bg': '#F2EDE8',
        'jai-text': '#4A433F', 'jai-text-secondary': '#8A837F', 'jai-muted': '#F2EDE8',
        'jai-success': '#8AB8A0', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(200,185,170,0.15)'
      }
    };
    var colors = themes[themeId] || themes.rose;
    var root = document.documentElement;
    Object.keys(colors).forEach(function(key) {
      root.style.setProperty('--color-' + key, colors[key]);
    });
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
        {/* 主题初始化脚本 - 必须在其他组件渲染前执行，避免FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
