/**
 * 主题配色系统
 * 每个主题包含颜色变量，切换时一次性替换所有变量
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
  /** 卡片阴影hover色 (rgba) */
  'jai-shadow-hover': string;
  /** 角色聊天气泡背景 */
  'jai-bubble': string;
  /** 用户聊天气泡背景 */
  'jai-bubble-user': string;
  /** 用户聊天气泡上的文字/按钮颜色 */
  'jai-bubble-user-text': string;
  /** 按钮文字颜色 */
  'jai-btn-text': string;
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
  // ===== 现有主题（色差修复） =====
  {
    id: 'rose',
    name: '玫瑰',
    nameEn: 'Rose',
    description: '玫瑰色调，盛放玫瑰的浓郁',
    colors: {
      'jai-bg': '#C8909A',
      'jai-secondary': '#B87888',
      'jai-accent': '#985868',
      'jai-card': '#F8E8EC',
      'jai-card-border': '#C08898',
      'jai-input-bg': '#D8A8B0',
      'jai-text': '#3A1820',
      'jai-text-secondary': '#7A4050',
      'jai-muted': '#D8A8B0',
      'jai-success': '#5DA07E',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(180, 100, 120, 0.20)',
      'jai-shadow-hover': 'rgba(180, 100, 120, 0.30)',
      'jai-bubble': '#F5D5DA',
      'jai-bubble-user': '#B87080',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
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
      'jai-shadow-hover': 'rgba(140, 170, 200, 0.30)',
      'jai-bubble': '#D8E5F0',
      'jai-bubble-user': '#98B4D0',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
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
      'jai-shadow-hover': 'rgba(140, 195, 160, 0.30)',
      'jai-bubble': '#D5EBDD',
      'jai-bubble-user': '#98C8A5',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
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
      'jai-shadow-hover': 'rgba(170, 140, 200, 0.30)',
      'jai-bubble': '#E2D5EE',
      'jai-bubble-user': '#B898D0',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
    },
  },
  // 沙棕：加深accent和secondary，增强层次
  {
    id: 'sand',
    name: '沙棕',
    nameEn: 'Sand Beige',
    description: '柔棕调，沙漠的温暖',
    colors: {
      'jai-bg': '#D8C4A8',
      'jai-secondary': '#C09868',
      'jai-accent': '#9A7040',
      'jai-card': '#F2EAE0',
      'jai-card-border': '#D4BEA0',
      'jai-input-bg': '#E8D8C0',
      'jai-text': '#3A2818',
      'jai-text-secondary': '#7A6048',
      'jai-muted': '#E8D8C0',
      'jai-success': '#5A9870',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(180, 140, 100, 0.22)',
      'jai-shadow-hover': 'rgba(180, 140, 100, 0.32)',
      'jai-bubble': '#E5D5C0',
      'jai-bubble-user': '#C09868',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
    },
  },
  // 枫叶：真实红枫色调
  {
    id: 'midnight',
    name: '枫叶',
    nameEn: 'Maple Leaf',
    description: '红枫色调，层林尽染的深红',
    colors: {
      'jai-bg': '#D4A0A0',
      'jai-secondary': '#C06060',
      'jai-accent': '#A03030',
      'jai-card': '#F5E0E0',
      'jai-card-border': '#D09090',
      'jai-input-bg': '#E8C0C0',
      'jai-text': '#3A1010',
      'jai-text-secondary': '#7A3030',
      'jai-muted': '#E8C0C0',
      'jai-success': '#5A9878',
      'jai-thinking': '#8b9ff6',
      'jai-shadow': 'rgba(180, 80, 80, 0.22)',
      'jai-shadow-hover': 'rgba(180, 80, 80, 0.32)',
      'jai-bubble': '#E8C0B8',
      'jai-bubble-user': '#C05050',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
    },
  },
  // 夕阳：偏黄金调，和枫叶(偏红橙)拉开差距
  {
    id: 'warmnight',
    name: '夕阳',
    nameEn: 'Sunset',
    description: '夕阳色调，天边最后一抹暖光',
    colors: {
      'jai-bg': '#E8C070',
      'jai-secondary': '#D09020',
      'jai-accent': '#B87010',
      'jai-card': '#FAF0D8',
      'jai-card-border': '#D8B060',
      'jai-input-bg': '#F0D898',
      'jai-text': '#3A2008',
      'jai-text-secondary': '#8A5820',
      'jai-muted': '#F0D898',
      'jai-success': '#5A9878',
      'jai-thinking': '#c898f0',
      'jai-shadow': 'rgba(200, 150, 40, 0.22)',
      'jai-shadow-hover': 'rgba(200, 150, 40, 0.32)',
      'jai-bubble': '#F0D898',
      'jai-bubble-user': '#D09020',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
    },
  },
  // 日光：加重灰度层次，不再一片白
  {
    id: 'daylight',
    name: '日光',
    nameEn: 'Daylight',
    description: '明亮清爽，晨光白净空间',
    colors: {
      'jai-bg': '#EDE5DC',
      'jai-secondary': '#C8B8A8',
      'jai-accent': '#8A7868',
      'jai-card': '#FAF8F5',
      'jai-card-border': '#D0C4B8',
      'jai-input-bg': '#E0D5CA',
      'jai-text': '#2E2520',
      'jai-text-secondary': '#7A6E62',
      'jai-muted': '#E0D5CA',
      'jai-success': '#5A9A68',
      'jai-thinking': '#9080e0',
      'jai-shadow': 'rgba(130, 110, 90, 0.15)',
      'jai-shadow-hover': 'rgba(130, 110, 90, 0.25)',
      'jai-bubble': '#E5DCD2',
      'jai-bubble-user': '#C8B8A8',
      'jai-bubble-user-text': '#2E2520',
      'jai-btn-text': '#2E2520',
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
      'jai-shadow-hover': 'rgba(200, 90, 135, 0.32)',
      'jai-bubble': '#F5C0D5',
      'jai-bubble-user': '#D878A0',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
    },
  },
  {
    id: 'neonocean',
    name: '苔绿',
    nameEn: 'Moss',
    description: '苔绿色调，林间苔藓的沉稳',
    colors: {
      'jai-bg': '#8FBFA0',
      'jai-secondary': '#7AA88A',
      'jai-accent': '#5A8A6A',
      'jai-card': '#E8F0E8',
      'jai-card-border': '#8AB89A',
      'jai-input-bg': '#A8D4B8',
      'jai-text': '#1A2E1E',
      'jai-text-secondary': '#4A6A50',
      'jai-muted': '#A8D4B8',
      'jai-success': '#3A8A5A',
      'jai-thinking': '#7080F0',
      'jai-shadow': 'rgba(80, 140, 100, 0.20)',
      'jai-shadow-hover': 'rgba(80, 140, 100, 0.30)',
      'jai-bubble': '#B0D8B8',
      'jai-bubble-user': '#6A9A78',
      'jai-bubble-user-text': '#1A2E1E',
      'jai-btn-text': '#1A2E1E',
    },
  },

  // ===== 新增主题 =====
  // 护眼-暖沙：旧纸张米黄，最有阅读舒适感
  {
    id: 'eyecare-warm',
    name: '护眼暖沙',
    nameEn: 'Warm Sand Eye-Care',
    description: '旧纸张米黄，长时间阅读最舒适',
    isDark: false,
    colors: {
      'jai-bg': '#F0E6D0',
      'jai-secondary': '#C8B090',
      'jai-accent': '#8A7050',
      'jai-card': '#FAF5EC',
      'jai-card-border': '#D8C8A8',
      'jai-input-bg': '#E8DCC8',
      'jai-text': '#3A2E20',
      'jai-text-secondary': '#7A6850',
      'jai-muted': '#E8DCC8',
      'jai-success': '#6A9858',
      'jai-thinking': '#9070D0',
      'jai-shadow': 'rgba(160, 130, 90, 0.15)',
      'jai-shadow-hover': 'rgba(160, 130, 90, 0.25)',
      'jai-bubble': '#E8DCC0',
      'jai-bubble-user': '#C8B090',
      'jai-bubble-user-text': '#3A2E20',
      'jai-btn-text': '#3A2E20',
    },
  },
  // 护眼-薄荷：灰绿底，冷调护眼
  {
    id: 'eyecare-mint',
    name: '护眼薄荷',
    nameEn: 'Mint Eye-Care',
    description: '灰绿底色，清冷护眼不刺激',
    isDark: false,
    colors: {
      'jai-bg': '#C8D8C8',
      'jai-secondary': '#98B898',
      'jai-accent': '#5A8858',
      'jai-card': '#E8F0E8',
      'jai-card-border': '#A8C0A8',
      'jai-input-bg': '#D5E2D5',
      'jai-text': '#1E3020',
      'jai-text-secondary': '#4A6A48',
      'jai-muted': '#D5E2D5',
      'jai-success': '#408848',
      'jai-thinking': '#7080D0',
      'jai-shadow': 'rgba(100, 150, 100, 0.18)',
      'jai-shadow-hover': 'rgba(100, 150, 100, 0.28)',
      'jai-bubble': '#D0E0D0',
      'jai-bubble-user': '#98B898',
      'jai-bubble-user-text': '#1E3020',
      'jai-btn-text': '#1E3020',
    },
  },
  // 深色：深灰底 + 暖灰字，标准暗色
  {
    id: 'dark',
    name: '深色',
    nameEn: 'Dark Mode',
    description: '深灰底色，夜间使用不刺眼',
    isDark: true,
    colors: {
      'jai-bg': '#1A1A1E',
      'jai-secondary': '#3A3A42',
      'jai-accent': '#6A6A78',
      'jai-card': '#252528',
      'jai-card-border': '#3A3A42',
      'jai-input-bg': '#2A2A30',
      'jai-text': '#D0CCC8',
      'jai-text-secondary': '#8A8680',
      'jai-muted': '#2A2A30',
      'jai-success': '#5AAA6A',
      'jai-thinking': '#a78bfa',
      'jai-shadow': 'rgba(0, 0, 0, 0.30)',
      'jai-shadow-hover': 'rgba(0, 0, 0, 0.45)',
      'jai-bubble': '#2E2E35',
      'jai-bubble-user': '#3A3A42',
      'jai-bubble-user-text': '#D0CCC8',
      'jai-btn-text': '#D0CCC8',
    },
  },
  // 粉黑：纯黑底 + 高饱和玫红，赛博朋克风
  {
    id: 'pink-black',
    name: '粉黑',
    nameEn: 'Pink Noir',
    description: '黑底玫红，赛博朋克的冷艳',
    isDark: true,
    colors: {
      'jai-bg': '#0E0E10',
      'jai-secondary': '#C41858',
      'jai-accent': '#E91E63',
      'jai-card': '#1A1A20',
      'jai-card-border': '#C41858',
      'jai-input-bg': '#18181E',
      'jai-text': '#F0E0E8',
      'jai-text-secondary': '#B08898',
      'jai-muted': '#1E1E28',
      'jai-success': '#00D68F',
      'jai-thinking': '#BB86FC',
      'jai-shadow': 'rgba(233, 30, 99, 0.18)',
      'jai-shadow-hover': 'rgba(233, 30, 99, 0.30)',
      'jai-bubble': '#1C1C24',
      'jai-bubble-user': '#C41858',
      'jai-bubble-user-text': '#FFFFFF',
      'jai-btn-text': '#FFFFFF',
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
  root.style.setProperty('--primary-foreground', c['jai-btn-text']);
  root.style.setProperty('--secondary', c['jai-accent']);
  root.style.setProperty('--secondary-foreground', c['jai-btn-text']);
  root.style.setProperty('--muted', c['jai-muted']);
  root.style.setProperty('--muted-foreground', c['jai-text-secondary']);
  root.style.setProperty('--accent', c['jai-accent']);
  root.style.setProperty('--accent-foreground', c['jai-btn-text']);
  root.style.setProperty('--border', c['jai-card-border']);
  root.style.setProperty('--input', c['jai-secondary']);
  root.style.setProperty('--ring', c['jai-accent']);
  root.style.setProperty('--sidebar', c['jai-muted']);
  root.style.setProperty('--sidebar-foreground', c['jai-text']);
  root.style.setProperty('--sidebar-primary', c['jai-accent']);
  root.style.setProperty('--sidebar-primary-foreground', c['jai-btn-text']);
  root.style.setProperty('--sidebar-accent', c['jai-secondary']);
  root.style.setProperty('--sidebar-accent-foreground', c['jai-btn-text']);
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
