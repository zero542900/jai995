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
        'jai-bg': '#E8C8C8', 'jai-secondary': '#D4A8A8', 'jai-accent': '#C48888',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0C0C0', 'jai-input-bg': '#F2E0E0',
        'jai-text': '#4A3535', 'jai-text-secondary': '#8A6F6F', 'jai-muted': '#F2E0E0',
        'jai-success': '#6BAA8E', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(195,150,150,0.18)'
      },
      ocean: {
        'jai-bg': '#C8D8E8', 'jai-secondary': '#A8BED4', 'jai-accent': '#88A2C4',
        'jai-card': '#FFFFFF', 'jai-card-border': '#C0D0E0', 'jai-input-bg': '#E0ECF2',
        'jai-text': '#353F4A', 'jai-text-secondary': '#6F7F8A', 'jai-muted': '#E0ECF2',
        'jai-success': '#6B9AAA', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(150,180,200,0.18)'
      },
      forest: {
        'jai-bg': '#C8E0D0', 'jai-secondary': '#A8D0B0', 'jai-accent': '#88B898',
        'jai-card': '#FFFFFF', 'jai-card-border': '#C0D8C8', 'jai-input-bg': '#E0F0E5',
        'jai-text': '#354A3A', 'jai-text-secondary': '#6F8A72', 'jai-muted': '#E0F0E5',
        'jai-success': '#5AAA82', 'jai-thinking': '#8bb8f6', 'jai-shadow': 'rgba(150,200,165,0.18)'
      },
      dusk: {
        'jai-bg': '#D8C8E0', 'jai-secondary': '#BEA8D0', 'jai-accent': '#A888C0',
        'jai-card': '#FFFFFF', 'jai-card-border': '#D0C0DC', 'jai-input-bg': '#ECE0F2',
        'jai-text': '#42354A', 'jai-text-secondary': '#7F6F8A', 'jai-muted': '#ECE0F2',
        'jai-success': '#7A92AA', 'jai-thinking': '#9070f0', 'jai-shadow': 'rgba(175,150,200,0.18)'
      },
      sand: {
        'jai-bg': '#E0D0C0', 'jai-secondary': '#D0B8A0', 'jai-accent': '#C0A088',
        'jai-card': '#FFFFFF', 'jai-card-border': '#DCC8B8', 'jai-input-bg': '#F2E8DC',
        'jai-text': '#4A3C32', 'jai-text-secondary': '#8A7A6A', 'jai-muted': '#F2E8DC',
        'jai-success': '#6AAA82', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(200,170,140,0.18)'
      }
    };
    var colors = themes[themeId] || themes.rose;
    var root = document.documentElement;
    // Set jai-* color variables
    Object.keys(colors).forEach(function(key) {
      root.style.setProperty('--color-' + key, colors[key]);
    });
    // Sync shadcn/ui :root variables so all components follow theme
    var c = colors;
    root.style.setProperty('--background', c['jai-bg']);
    root.style.setProperty('--foreground', c['jai-text']);
    root.style.setProperty('--card', c['jai-card']);
    root.style.setProperty('--card-foreground', c['jai-text']);
    root.style.setProperty('--popover', c['jai-card']);
    root.style.setProperty('--popover-foreground', c['jai-text']);
    root.style.setProperty('--primary', c['jai-secondary']);
    root.style.setProperty('--primary-foreground', c['jai-card']);
    root.style.setProperty('--secondary', c['jai-accent']);
    root.style.setProperty('--secondary-foreground', c['jai-card']);
    root.style.setProperty('--muted', c['jai-muted']);
    root.style.setProperty('--muted-foreground', c['jai-text-secondary']);
    root.style.setProperty('--accent', c['jai-accent']);
    root.style.setProperty('--accent-foreground', c['jai-card']);
    root.style.setProperty('--border', c['jai-card-border']);
    root.style.setProperty('--input', c['jai-secondary']);
    root.style.setProperty('--ring', c['jai-accent']);
    root.style.setProperty('--sidebar', c['jai-muted']);
    root.style.setProperty('--sidebar-foreground', c['jai-text']);
    root.style.setProperty('--sidebar-primary', c['jai-accent']);
    root.style.setProperty('--sidebar-primary-foreground', c['jai-card']);
    root.style.setProperty('--sidebar-accent', c['jai-secondary']);
    root.style.setProperty('--sidebar-accent-foreground', c['jai-card']);
    root.style.setProperty('--sidebar-border', c['jai-card-border']);
    root.style.setProperty('--sidebar-ring', c['jai-accent']);
    root.style.setProperty('--chart-1', c['jai-accent']);
    root.style.setProperty('--chart-2', c['jai-secondary']);
    root.style.setProperty('--chart-3', c['jai-card-border']);
    root.style.setProperty('--chart-4', c['jai-muted']);
    root.style.setProperty('--chart-5', c['jai-text-secondary']);
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
