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
        'jai-bg': '#1E2433', 'jai-secondary': '#3A4560', 'jai-accent': '#6880A8',
        'jai-card': '#2A3248', 'jai-card-border': '#2E3750', 'jai-input-bg': '#323B52',
        'jai-text': '#D0D8EA', 'jai-text-secondary': '#90A0B8', 'jai-muted': '#323B52',
        'jai-success': '#5AAA90', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(20,30,50,0.35)'
      },
      warmnight: {
        'jai-bg': '#2A2320', 'jai-secondary': '#4A3E38', 'jai-accent': '#A07858',
        'jai-card': '#342C28', 'jai-card-border': '#38302C', 'jai-input-bg': '#3A3230',
        'jai-text': '#E8D8C8', 'jai-text-secondary': '#B8A898', 'jai-muted': '#3A3230',
        'jai-success': '#6AAA78', 'jai-thinking': '#c898f0', 'jai-shadow': 'rgba(30,20,15,0.35)'
      },
      daylight: {
        'jai-bg': '#F5F0EC', 'jai-secondary': '#E0D8D0', 'jai-accent': '#B0A090',
        'jai-card': '#FFFFFF', 'jai-card-border': '#E0D8D0', 'jai-input-bg': '#EDE6E0',
        'jai-text': '#3A3230', 'jai-text-secondary': '#8A8078', 'jai-muted': '#EDE6E0',
        'jai-success': '#5AAA78', 'jai-thinking': '#9080e0', 'jai-shadow': 'rgba(160,140,120,0.12)'
      },
      neonrose: {
        'jai-bg': '#1A1520', 'jai-secondary': '#3A2848', 'jai-accent': '#E060A0',
        'jai-card': '#252030', 'jai-card-border': '#2E2438', 'jai-input-bg': '#2E2238',
        'jai-text': '#EED8F5', 'jai-text-secondary': '#B898C8', 'jai-muted': '#2E2238',
        'jai-success': '#50D898', 'jai-thinking': '#B060F0', 'jai-shadow': 'rgba(180,60,120,0.25)'
      },
      neonocean: {
        'jai-bg': '#121A28', 'jai-secondary': '#283848', 'jai-accent': '#40B8D8',
        'jai-card': '#1A2435', 'jai-card-border': '#1E2A3C', 'jai-input-bg': '#1E2838',
        'jai-text': '#D8E8F8', 'jai-text-secondary': '#88B0D0', 'jai-muted': '#1E2838',
        'jai-success': '#40D8A0', 'jai-thinking': '#7080F0', 'jai-shadow': 'rgba(40,140,180,0.25)'
      }
    };
    var colors = themes[themeId] || themes.rose;
    var root = document.documentElement;
    // Set jai-* color variables
    Object.keys(colors).forEach(function(key) {
      root.style.setProperty('--color-' + key, colors[key]);
    });
    // Sync shadcn/ui :root variables so all components follow theme
    // Dark themes use light text on buttons, light themes use card color
    var isDark = ['midnight','warmnight','neonrose','neonocean'].indexOf(themeId) >= 0;
    var c = colors;
    var onDark = isDark ? c['jai-text'] : c['jai-card'];
    root.style.setProperty('--background', c['jai-bg']);
    root.style.setProperty('--foreground', c['jai-text']);
    root.style.setProperty('--card', c['jai-card']);
    root.style.setProperty('--card-foreground', c['jai-text']);
    root.style.setProperty('--popover', c['jai-card']);
    root.style.setProperty('--popover-foreground', c['jai-text']);
    root.style.setProperty('--primary', c['jai-secondary']);
    root.style.setProperty('--primary-foreground', onDark);
    root.style.setProperty('--secondary', c['jai-accent']);
    root.style.setProperty('--secondary-foreground', onDark);
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
