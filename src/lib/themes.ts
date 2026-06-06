/**
 * 主题配色系统
 * 每个主题包含 12 个颜色变量，切换时一次性替换所有变量
 */

export interface ThemeColors {
  /** 页面主背景 */
  'jai-bg': string;
  /** 按钮/边框辅色 */
  'jai-secondary': string;
  /** 标题/强调/hover */
  'jai-accent': string;
  /** 卡片背景 */
  'jai-card': string;
  /** 卡片边框 */
  'jai-card-border': string;
  /** 输入框/淡色区背景 */
  'jai-input-bg': string;
  /** 主要文字 */
  'jai-text': string;
  /** 次要文字 */
  'jai-text-secondary': string;
  /** 禁用/弱化/分隔 */
  'jai-muted': string;
  /** 成功/保存 */
  'jai-success': string;
  /** 思考模式标记 */
  'jai-thinking': string;
  /** 卡片阴影色 (rgba) */
  'jai-shadow': string;
}

export interface Theme {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: 'rose',
    name: '烟粉',
    nameEn: 'Rose Mist',
    description: '柔和烟粉，柔光下安静的写作空间',
    colors: {
      'jai-bg': '#E8C8C8',
      'jai-secondary': '#D4A8A8',
      'jai-accent': '#C48888',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#E0C0C0',
      'jai-input-bg': '#F2E0E0',
      'jai-text': '#4A3535',
      'jai-text-secondary': '#8A6F6F',
      'jai-muted': '#F2E0E0',
      'jai-success': '#6BAA8E',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(195, 150, 150, 0.18)',
    },
  },
  {
    id: 'ocean',
    name: '雾蓝',
    nameEn: 'Ocean Mist',
    description: '柔蓝调，深海的宁静',
    colors: {
      'jai-bg': '#C8D8E8',
      'jai-secondary': '#A8BED4',
      'jai-accent': '#88A2C4',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#C0D0E0',
      'jai-input-bg': '#E0ECF2',
      'jai-text': '#353F4A',
      'jai-text-secondary': '#6F7F8A',
      'jai-muted': '#E0ECF2',
      'jai-success': '#6B9AAA',
      'jai-thinking': '#8b9ff6',
      'jai-shadow': 'rgba(150, 180, 200, 0.18)',
    },
  },
  {
    id: 'forest',
    name: '苔绿',
    nameEn: 'Forest Mist',
    description: '柔绿调，林间的清新',
    colors: {
      'jai-bg': '#C8E0D0',
      'jai-secondary': '#A8D0B0',
      'jai-accent': '#88B898',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#C0D8C8',
      'jai-input-bg': '#E0F0E5',
      'jai-text': '#354A3A',
      'jai-text-secondary': '#6F8A72',
      'jai-muted': '#E0F0E5',
      'jai-success': '#5AAA82',
      'jai-thinking': '#8bb8f6',
      'jai-shadow': 'rgba(150, 200, 165, 0.18)',
    },
  },
  {
    id: 'dusk',
    name: '暮紫',
    nameEn: 'Dusk Violet',
    description: '柔紫调，黄昏的余韵',
    colors: {
      'jai-bg': '#D8C8E0',
      'jai-secondary': '#BEA8D0',
      'jai-accent': '#A888C0',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#D0C0DC',
      'jai-input-bg': '#ECE0F2',
      'jai-text': '#42354A',
      'jai-text-secondary': '#7F6F8A',
      'jai-muted': '#ECE0F2',
      'jai-success': '#7A92AA',
      'jai-thinking': '#9070f0',
      'jai-shadow': 'rgba(175, 150, 200, 0.18)',
    },
  },
  {
    id: 'sand',
    name: '沙棕',
    nameEn: 'Sand Beige',
    description: '柔棕调，沙漠的温暖',
    colors: {
      'jai-bg': '#E0D0C0',
      'jai-secondary': '#D0B8A0',
      'jai-accent': '#C0A088',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#DCC8B8',
      'jai-input-bg': '#F2E8DC',
      'jai-text': '#4A3C32',
      'jai-text-secondary': '#8A7A6A',
      'jai-muted': '#F2E8DC',
      'jai-success': '#6AAA82',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(200, 170, 140, 0.18)',
    },
  },
];

export const DEFAULT_THEME_ID = 'rose';

const THEME_STORAGE_KEY = 'jai_theme';

/** 获取当前主题ID */
export function getCurrentThemeId(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
}

/** 获取主题对象 */
export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/** 应用主题到 DOM */
export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  const c = theme.colors;

  // 更新 JAI 自定义颜色变量
  Object.entries(c).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  // 同步更新 shadcn/ui :root 变量，确保 Button/Card/Input 等组件也跟随主题
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

  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}

/** 初始化主题（页面加载时调用） */
export function initTheme(): void {
  const themeId = getCurrentThemeId();
  applyTheme(themeId);
}
