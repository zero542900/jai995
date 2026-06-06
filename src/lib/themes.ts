/**
 * 主题配色系统
 * 每个主题包含 14 个颜色变量，切换时一次性替换所有变量
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
  /** 角色聊天气泡背景 */
  'jai-bubble': string;
  /** 用户聊天气泡背景 */
  'jai-bubble-user': string;
}

export interface Theme {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  isDark?: boolean;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: 'rose',
    name: '玫瑰粉',
    nameEn: 'Rose Pink',
    description: '玫瑰粉调，花瓣层叠的柔美',
    colors: {
      'jai-bg': '#E0A0AC',
      'jai-secondary': '#D08898',
      'jai-accent': '#B86878',
      'jai-card': '#F8E8EC',
      'jai-card-border': '#D8A0AA',
      'jai-input-bg': '#ECC0C8',
      'jai-text': '#4A2028',
      'jai-text-secondary': '#8A5060',
      'jai-muted': '#ECC0C8',
      'jai-success': '#5DA07E',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(180, 100, 120, 0.20)',
      'jai-bubble': '#F5D5DA',
      'jai-bubble-user': '#D08898',
    },
  },
  {
    id: 'ocean',
    name: '雾蓝',
    nameEn: 'Ocean Mist',
    description: '柔蓝调，深海的宁静',
    colors: {
      'jai-bg': '#B8D0E8',
      'jai-secondary': '#98B4D0',
      'jai-accent': '#7898BE',
      'jai-card': '#E8F0F8',
      'jai-card-border': '#B0C4DA',
      'jai-input-bg': '#D8E6F0',
      'jai-text': '#2E3A4A',
      'jai-text-secondary': '#607085',
      'jai-muted': '#D8E6F0',
      'jai-success': '#5A92AA',
      'jai-thinking': '#8b9ff6',
      'jai-shadow': 'rgba(140, 170, 200, 0.20)',
      'jai-bubble': '#D8E5F0',
      'jai-bubble-user': '#98B4D0',
    },
  },
  {
    id: 'forest',
    name: '苔绿',
    nameEn: 'Forest Mist',
    description: '柔绿调，林间的清新',
    colors: {
      'jai-bg': '#B8DAC5',
      'jai-secondary': '#98C8A5',
      'jai-accent': '#78B088',
      'jai-card': '#E8F2EC',
      'jai-card-border': '#B0D0BA',
      'jai-input-bg': '#D8ECE0',
      'jai-text': '#2E4A35',
      'jai-text-secondary': '#608A65',
      'jai-muted': '#D8ECE0',
      'jai-success': '#4AA075',
      'jai-thinking': '#8bb8f6',
      'jai-shadow': 'rgba(140, 195, 160, 0.20)',
      'jai-bubble': '#D5EBDD',
      'jai-bubble-user': '#98C8A5',
    },
  },
  {
    id: 'dusk',
    name: '暮紫',
    nameEn: 'Dusk Violet',
    description: '柔紫调，黄昏的余韵',
    colors: {
      'jai-bg': '#D0B8E0',
      'jai-secondary': '#B898D0',
      'jai-accent': '#9E78C0',
      'jai-card': '#EEE5F5',
      'jai-card-border': '#C8B0DC',
      'jai-input-bg': '#E6D6F0',
      'jai-text': '#3A2E4A',
      'jai-text-secondary': '#756088',
      'jai-muted': '#E6D6F0',
      'jai-success': '#6A88AA',
      'jai-thinking': '#8060e8',
      'jai-shadow': 'rgba(170, 140, 200, 0.20)',
      'jai-bubble': '#E2D5EE',
      'jai-bubble-user': '#B898D0',
    },
  },
  {
    id: 'sand',
    name: '沙棕',
    nameEn: 'Sand Beige',
    description: '柔棕调，沙漠的温暖',
    colors: {
      'jai-bg': '#DAC5B0',
      'jai-secondary': '#C8A888',
      'jai-accent': '#B88E70',
      'jai-card': '#F2EAE0',
      'jai-card-border': '#D4BEA8',
      'jai-input-bg': '#EEDCC8',
      'jai-text': '#4A3628',
      'jai-text-secondary': '#8A7058',
      'jai-muted': '#EEDCC8',
      'jai-success': '#5AA07A',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(195, 160, 130, 0.20)',
      'jai-bubble': '#EAD8C2',
      'jai-bubble-user': '#C8A888',
    },
  },
  {
    id: 'midnight',
    name: '枫叶',
    nameEn: 'Maple Leaf',
    description: '枫叶色调，秋日层林的暖意',
    colors: {
      'jai-bg': '#E0B898',
      'jai-secondary': '#D08858',
      'jai-accent': '#C45A30',
      'jai-card': '#F8EDE0',
      'jai-card-border': '#D8A880',
      'jai-input-bg': '#F0D0B8',
      'jai-text': '#4A2010',
      'jai-text-secondary': '#8A5838',
      'jai-muted': '#F0D0B8',
      'jai-success': '#5AA078',
      'jai-thinking': '#8b9ff6',
      'jai-shadow': 'rgba(190, 100, 50, 0.22)',
      'jai-bubble': '#F0D0B8',
      'jai-bubble-user': '#D08858',
    },
  },
  {
    id: 'warmnight',
    name: '夕阳',
    nameEn: 'Sunset',
    description: '夕阳色调，天边最后一抹暖光',
    colors: {
      'jai-bg': '#F0C898',
      'jai-secondary': '#E89838',
      'jai-accent': '#FE8005',
      'jai-card': '#FAF0E0',
      'jai-card-border': '#E8B878',
      'jai-input-bg': '#F8DCB0',
      'jai-text': '#3A2008',
      'jai-text-secondary': '#7A5828',
      'jai-muted': '#F8DCB0',
      'jai-success': '#5AA078',
      'jai-thinking': '#c898f0',
      'jai-shadow': 'rgba(210, 145, 40, 0.22)',
      'jai-bubble': '#F8DCB0',
      'jai-bubble-user': '#E89838',
    },
  },
  {
    id: 'daylight',
    name: '日光',
    nameEn: 'Daylight',
    description: '明亮清爽，晨光白净空间',
    colors: {
      'jai-bg': '#F5F0EC',
      'jai-secondary': '#E0D8D0',
      'jai-accent': '#B0A090',
      'jai-card': '#FAFAF8',
      'jai-card-border': '#E0D8D0',
      'jai-input-bg': '#EDE6E0',
      'jai-text': '#3A3230',
      'jai-text-secondary': '#8A8078',
      'jai-muted': '#EDE6E0',
      'jai-success': '#5AAA78',
      'jai-thinking': '#9080e0',
      'jai-shadow': 'rgba(160, 140, 120, 0.12)',
      'jai-bubble': '#EDE8E3',
      'jai-bubble-user': '#E0D8D0',
    },
  },
  {
    id: 'neonrose',
    name: '樱粉',
    nameEn: 'Cherry Blossom',
    description: '樱粉色调，花瓣飘落的柔美',
    colors: {
      'jai-bg': '#E898B8',
      'jai-secondary': '#D878A0',
      'jai-accent': '#C85888',
      'jai-card': '#F8E5EE',
      'jai-card-border': '#E088A8',
      'jai-input-bg': '#F0B8CC',
      'jai-text': '#4A1830',
      'jai-text-secondary': '#8A4060',
      'jai-muted': '#F0B8CC',
      'jai-success': '#5AAA80',
      'jai-thinking': '#B060F0',
      'jai-shadow': 'rgba(200, 90, 135, 0.22)',
      'jai-bubble': '#F5C0D5',
      'jai-bubble-user': '#D878A0',
    },
  },
  {
    id: 'neonocean',
    name: '薄荷',
    nameEn: 'Mint',
    description: '薄荷色调，清凉舒爽的微风',
    colors: {
      'jai-bg': '#A0D0C8',
      'jai-secondary': '#80BCB0',
      'jai-accent': '#60A898',
      'jai-card': '#E5F2EF',
      'jai-card-border': '#98C8BE',
      'jai-input-bg': '#C0E0D8',
      'jai-text': '#1E3A34',
      'jai-text-secondary': '#50786E',
      'jai-muted': '#C0E0D8',
      'jai-success': '#40A888',
      'jai-thinking': '#7080F0',
      'jai-shadow': 'rgba(100, 175, 155, 0.20)',
      'jai-bubble': '#C8E5DD',
      'jai-bubble-user': '#80BCB0',
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
  root.style.setProperty('--primary-foreground', c['jai-text']);
  root.style.setProperty('--secondary', c['jai-accent']);
  root.style.setProperty('--secondary-foreground', c['jai-text']);
  root.style.setProperty('--muted', c['jai-muted']);
  root.style.setProperty('--muted-foreground', c['jai-text-secondary']);
  root.style.setProperty('--accent', c['jai-accent']);
  root.style.setProperty('--accent-foreground', c['jai-text']);
  root.style.setProperty('--border', c['jai-card-border']);
  root.style.setProperty('--input', c['jai-secondary']);
  root.style.setProperty('--ring', c['jai-accent']);
  root.style.setProperty('--sidebar', c['jai-muted']);
  root.style.setProperty('--sidebar-foreground', c['jai-text']);
  root.style.setProperty('--sidebar-primary', c['jai-accent']);
  root.style.setProperty('--sidebar-primary-foreground', c['jai-text']);
  root.style.setProperty('--sidebar-accent', c['jai-secondary']);
  root.style.setProperty('--sidebar-accent-foreground', c['jai-text']);
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
