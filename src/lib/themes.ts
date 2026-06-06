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
    description: '低饱和度烟粉灰，柔光下安静的写作空间',
    colors: {
      'jai-bg': '#E8D5D5',
      'jai-secondary': '#D4B8B8',
      'jai-accent': '#C4A2A2',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#E0CECE',
      'jai-input-bg': '#F2EBEB',
      'jai-text': '#4A3F3F',
      'jai-text-secondary': '#8A7F7F',
      'jai-muted': '#F2EBEB',
      'jai-success': '#7DB8A0',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(200, 170, 170, 0.15)',
    },
  },
  {
    id: 'ocean',
    name: '雾蓝',
    nameEn: 'Ocean Mist',
    description: '低饱和度灰蓝调，深海的宁静',
    colors: {
      'jai-bg': '#D5DDE8',
      'jai-secondary': '#B8C4D4',
      'jai-accent': '#A2B0C4',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#CED8E0',
      'jai-input-bg': '#EBF0F2',
      'jai-text': '#3F4A5A',
      'jai-text-secondary': '#7F8A9A',
      'jai-muted': '#EBF0F2',
      'jai-success': '#7DA0B8',
      'jai-thinking': '#8b9ff6',
      'jai-shadow': 'rgba(170, 185, 200, 0.15)',
    },
  },
  {
    id: 'forest',
    name: '苔绿',
    nameEn: 'Forest Mist',
    description: '低饱和度灰绿调，林间的清新',
    colors: {
      'jai-bg': '#D5E0D8',
      'jai-secondary': '#B8D4BD',
      'jai-accent': '#A2C4A8',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#CEDEC2',
      'jai-input-bg': '#EBF2EB',
      'jai-text': '#3F4A42',
      'jai-text-secondary': '#7F8A80',
      'jai-muted': '#EBF2EB',
      'jai-success': '#7DB8A0',
      'jai-thinking': '#8bb8f6',
      'jai-shadow': 'rgba(170, 200, 175, 0.15)',
    },
  },
  {
    id: 'dusk',
    name: '暮紫',
    nameEn: 'Dusk Violet',
    description: '低饱和度灰紫调，黄昏的余韵',
    colors: {
      'jai-bg': '#DDD5E0',
      'jai-secondary': '#C4B8D0',
      'jai-accent': '#B0A2C0',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#D8CEE0',
      'jai-input-bg': '#F0EBF2',
      'jai-text': '#453F4A',
      'jai-text-secondary': '#857F8A',
      'jai-muted': '#F0EBF2',
      'jai-success': '#8AA0B8',
      'jai-thinking': '#9b7ff6',
      'jai-shadow': 'rgba(185, 170, 200, 0.15)',
    },
  },
  {
    id: 'sand',
    name: '沙棕',
    nameEn: 'Sand Beige',
    description: '低饱和度灰棕调，沙漠的温暖',
    colors: {
      'jai-bg': '#E0D8D0',
      'jai-secondary': '#D0C4B8',
      'jai-accent': '#C0B0A2',
      'jai-card': '#FFFFFF',
      'jai-card-border': '#DED0C8',
      'jai-input-bg': '#F2EDE8',
      'jai-text': '#4A433F',
      'jai-text-secondary': '#8A837F',
      'jai-muted': '#F2EDE8',
      'jai-success': '#8AB8A0',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(200, 185, 170, 0.15)',
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
