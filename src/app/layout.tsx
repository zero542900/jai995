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
        'jai-bg': '#E0A0AC', 'jai-secondary': '#D08898', 'jai-accent': '#B86878',
        'jai-card': '#F8E8EC', 'jai-card-border': '#D8A0AA', 'jai-input-bg': '#ECC0C8',
        'jai-text': '#4A2028', 'jai-text-secondary': '#8A5060', 'jai-muted': '#ECC0C8',
        'jai-success': '#5DA07E', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(180,100,120,0.20)',
        'jai-bubble': '#F5D5DA', 'jai-bubble-user': '#D08898', 'jai-bubble-user-text': '#FFFFFF'
      },
      ocean: {
        'jai-bg': '#B8D0E8', 'jai-secondary': '#98B4D0', 'jai-accent': '#7898BE',
        'jai-card': '#E8F0F8', 'jai-card-border': '#B0C4DA', 'jai-input-bg': '#D8E6F0',
        'jai-text': '#2E3A4A', 'jai-text-secondary': '#607085', 'jai-muted': '#D8E6F0',
        'jai-success': '#5A92AA', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(140,170,200,0.20)',
        'jai-bubble': '#D8E5F0', 'jai-bubble-user': '#98B4D0', 'jai-bubble-user-text': '#FFFFFF'
      },
      forest: {
        'jai-bg': '#B8DAC5', 'jai-secondary': '#98C8A5', 'jai-accent': '#78B088',
        'jai-card': '#E8F2EC', 'jai-card-border': '#B0D0BA', 'jai-input-bg': '#D8ECE0',
        'jai-text': '#2E4A35', 'jai-text-secondary': '#608A65', 'jai-muted': '#D8ECE0',
        'jai-success': '#4AA075', 'jai-thinking': '#8bb8f6', 'jai-shadow': 'rgba(140,195,160,0.20)',
        'jai-bubble': '#D5EBDD', 'jai-bubble-user': '#98C8A5', 'jai-bubble-user-text': '#FFFFFF'
      },
      dusk: {
        'jai-bg': '#D0B8E0', 'jai-secondary': '#B898D0', 'jai-accent': '#9E78C0',
        'jai-card': '#E2D0F0', 'jai-card-border': '#C8B0DC', 'jai-input-bg': '#E6D6F0',
        'jai-text': '#3A2E4A', 'jai-text-secondary': '#756088', 'jai-muted': '#E6D6F0',
        'jai-success': '#6A88AA', 'jai-thinking': '#8060e8', 'jai-shadow': 'rgba(170,140,200,0.20)',
        'jai-bubble': '#E2D5EE', 'jai-bubble-user': '#B898D0', 'jai-bubble-user-text': '#FFFFFF'
      },
      sand: {
        'jai-bg': '#DAC5B0', 'jai-secondary': '#C8A888', 'jai-accent': '#B88E70',
        'jai-card': '#ECDCD0', 'jai-card-border': '#D4BEA8', 'jai-input-bg': '#EEDCC8',
        'jai-text': '#4A3628', 'jai-text-secondary': '#8A7058', 'jai-muted': '#EEDCC8',
        'jai-success': '#5AA07A', 'jai-thinking': '#a78bfa', 'jai-shadow': 'rgba(195,160,130,0.20)',
        'jai-bubble': '#EAD8C2', 'jai-bubble-user': '#C8A888', 'jai-bubble-user-text': '#FFFFFF'
      },
      midnight: {
        'jai-bg': '#E0B898', 'jai-secondary': '#D08858', 'jai-accent': '#C45A30',
        'jai-card': '#F0D8C0', 'jai-card-border': '#D8A880', 'jai-input-bg': '#F0D0B8',
        'jai-text': '#4A2010', 'jai-text-secondary': '#8A5838', 'jai-muted': '#F0D0B8',
        'jai-success': '#5AA078', 'jai-thinking': '#8b9ff6', 'jai-shadow': 'rgba(190,100,50,0.22)',
        'jai-bubble': '#F0D0B8', 'jai-bubble-user': '#D08858', 'jai-bubble-user-text': '#FFFFFF'
      },
      warmnight: {
        'jai-bg': '#F0C898', 'jai-secondary': '#E89838', 'jai-accent': '#FE8005',
        'jai-card': '#F8E0C0', 'jai-card-border': '#E8B878', 'jai-input-bg': '#F8DCB0',
        'jai-text': '#3A2008', 'jai-text-secondary': '#7A5828', 'jai-muted': '#F8DCB0',
        'jai-success': '#5AA078', 'jai-thinking': '#c898f0', 'jai-shadow': 'rgba(210,145,40,0.22)',
        'jai-bubble': '#F8DCB0', 'jai-bubble-user': '#E89838', 'jai-bubble-user-text': '#FFFFFF'
      },
      daylight: {
        'jai-bg': '#F5F0EC', 'jai-secondary': '#E0D8D0', 'jai-accent': '#B0A090',
        'jai-card': '#FAF6F2', 'jai-card-border': '#E0D8D0', 'jai-input-bg': '#EDE6E0',
        'jai-text': '#3A3230', 'jai-text-secondary': '#8A8078', 'jai-muted': '#EDE6E0',
        'jai-success': '#5AAA78', 'jai-thinking': '#9080e0', 'jai-shadow': 'rgba(160,140,120,0.12)',
        'jai-bubble': '#EDE8E3', 'jai-bubble-user': '#E0D8D0', 'jai-bubble-user-text': '#3A3230'
      },
      neonrose: {
        'jai-bg': '#E898B8', 'jai-secondary': '#D878A0', 'jai-accent': '#C85888',
        'jai-card': '#F8E0EC', 'jai-card-border': '#E088A8', 'jai-input-bg': '#F0B8CC',
        'jai-text': '#4A1830', 'jai-text-secondary': '#8A4060', 'jai-muted': '#F0B8CC',
        'jai-success': '#5AAA80', 'jai-thinking': '#B060F0', 'jai-shadow': 'rgba(200,90,135,0.22)',
        'jai-bubble': '#F5C0D5', 'jai-bubble-user': '#D878A0', 'jai-bubble-user-text': '#FFFFFF'
      },
      neonocean: {
        'jai-bg': '#A0D0C8', 'jai-secondary': '#80BCB0', 'jai-accent': '#60A898',
        'jai-card': '#E0F0EC', 'jai-card-border': '#98C8BE', 'jai-input-bg': '#C0E0D8',
        'jai-text': '#1E3A34', 'jai-text-secondary': '#50786E', 'jai-muted': '#C0E0D8',
        'jai-success': '#40A888', 'jai-thinking': '#7080F0', 'jai-shadow': 'rgba(100,175,155,0.20)',
        'jai-bubble': '#C8E5DD', 'jai-bubble-user': '#80BCB0', 'jai-bubble-user-text': '#FFFFFF'
      }
    };
    var colors = themes[themeId] || themes.rose;
    var root = document.documentElement;
    Object.keys(colors).forEach(function(key) {
      root.style.setProperty('--color-' + key, colors[key]);
    });
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
