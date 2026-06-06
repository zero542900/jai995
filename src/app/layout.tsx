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
        'jai-bg': '#E8BABA', 'jai-secondary': '#D49898', 'jai-accent': '#C47878',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0B0B0', 'jai-input-bg': '#F2D5D5',
        'jai-text': '#4A2E2E', 'jai-text-secondary': '#8A6060', 'jai-muted': '#F2D5D5',
        'jai-success': '#5DA07E', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(190,140,140,0.20)'
      },
      ocean: {
        'jai-bg': '#B8D0E8', 'jai-secondary': '#98B4D0', 'jai-accent': '#7898BE',
        'jai-card': '#FFFFFF', 'jai-card-border': '#B0C4DA', 'jai-input-bg': '#D8E6F0',
        'jai-text': '#2E3A4A', 'jai-text-secondary': '#607085', 'jai-muted': '#D8E6F0',
        'jai-success': '#5A92AA', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(140,170,200,0.20)'
      },
      forest: {
        'jai-bg': '#B8DAC5', 'jai-secondary': '#98C8A5', 'jai-accent': '#78B088',
        'jai-card': '#FFFFFF', 'jai-card-border': '#B0D0BA', 'jai-input-bg': '#D8ECE0',
        'jai-text': '#2E4A35', 'jai-text-secondary': '#608A65', 'jai-muted': '#D8ECE0',
        'jai-success': '#4AA075', 'jai-thinking': '#8bb8f6', 'jai-shadow': 'rgba(140,195,160,0.20)'
      },
      dusk: {
        'jai-bg': '#D0B8E0', 'jai-secondary': '#B898D0', 'jai-accent': '#9E78C0',
        'jai-card': '#FFFFFF', 'jai-card-border': '#C8B0DC', 'jai-input-bg': '#E6D6F0',
        'jai-text': '#3A2E4A', 'jai-text-secondary': '#756088', 'jai-muted': '#E6D6F0',
        'jai-success': '#6A88AA', 'jai-thinking': '#8060e8', 'jai-shadow': 'rgba(170,140,200,0.20)'
      },
      sand: {
        'jai-bg': '#DAC5B0', 'jai-secondary': '#C8A888', 'jai-accent': '#B88E70',
        'jai-card': '#FFFFFF', 'jai-card-border': '#D4BEA8', 'jai-input-bg': '#EEDCC8',
        'jai-text': '#4A3628', 'jai-text-secondary': '#8A7058', 'jai-muted': '#EEDCC8',
        'jai-success': '#5AA07A', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(195,160,130,0.20)'
      },
      midnight: {
        'jai-bg': '#A8B8D0', 'jai-secondary': '#8EA0BC', 'jai-accent': '#6E88A8',
        'jai-card': '#FFFFFF', 'jai-card-border': '#A0B0C8', 'jai-input-bg': '#C0CEDF',
        'jai-text': '#2A3650', 'jai-text-secondary': '#5A6E88', 'jai-muted': '#C0CEDF',
        'jai-success': '#5AA098', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(120,150,190,0.20)'
      },
      warmnight: {
        'jai-bg': '#E0C0A0', 'jai-secondary': '#D0A880', 'jai-accent': '#C09068',
        'jai-card': '#FFFFFF', 'jai-card-border': '#D8B898', 'jai-input-bg': '#ECDCB8',
        'jai-text': '#4A3420', 'jai-text-secondary': '#8A6848', 'jai-muted': '#ECDCB8',
        'jai-success': '#5AA078', 'jai-thinking': '#c898f0', 'jai-shadow': 'rgba(180,140,100,0.20)'
      },
      daylight: {
        'jai-bg': '#F5F0EC', 'jai-secondary': '#E0D8D0', 'jai-accent': '#B0A090',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0D8D0', 'jai-input-bg': '#EDE6E0',
        'jai-text': '#3A3230', 'jai-text-secondary': '#8A8078', 'jai-muted': '#EDE6E0',
        'jai-success': '#5AAA78', 'jai-thinking': '#9080e0', 'jai-shadow': 'rgba(160,140,120,0.12)'
      },
      neonrose: {
        'jai-bg': '#E8A0B0', 'jai-secondary': '#D88898', 'jai-accent': '#C87080',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0A0AE', 'jai-input-bg': '#F0C0CA',
        'jai-text': '#4A2228', 'jai-text-secondary': '#8A5060', 'jai-muted': '#F0C0CA',
        'jai-success': '#5AAA80', 'jai-thinking': '#B060F0', 'jai-shadow': 'rgba(190,100,120,0.20)'
      },
      neonocean: {
        'jai-bg': '#A0D0C8', 'jai-secondary': '#80BCB0', 'jai-accent': '#60A898',
        'jai-card': '#FFFFFF', 'jai-card-border': '#98C8BE', 'jai-input-bg': '#C0E0D8',
        'jai-text': '#1E3A34', 'jai-text-secondary': '#50786E', 'jai-muted': '#C0E0D8',
        'jai-success': '#40A888', 'jai-thinking': '#7080F0', 'jai-shadow': 'rgba(100,175,155,0.20)'
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
