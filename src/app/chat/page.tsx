'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconBack, IconSparkle, IconPen, IconBrain, IconCopy, IconFlip, IconRefresh, IconLock, IconSend, IconStop, IconTrash, IconEdit, IconKey, IconBook, IconCheck, IconPlot, IconChevronUp, IconChevronDown } from '@/components/icons';
import { copyToClipboard } from '@/lib/utils';
import type { PlotData } from '@/lib/types';

// ========== Types ==========
interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  chineseTranslation?: string;
  translated: boolean;
  translating: boolean;
  flipped: boolean;
  editing: boolean;
  timestamp: number;
}

interface Preset {
  id: string;
  name: string;
  charInfo: string;
  userCard: string;
  userPersonality: string;
  greeting: string;
  plotDirection: string;
  longTermMemory: string;
  personMode: 'first' | 'third';
  thinkingEnabled: boolean;
  plotData?: PlotData;
  createdAt: number;
}

interface Instruction {
  id: string;
  name: string;
  content: string;
  summary: string;
}

// ========== Instruction Utilities ==========
/** Remove all 【...】 blocks from text — used for memory/inspiration/expand APIs */
function stripInstructions(text: string): string {
  return text.replace(/【[\s\S]*?】/g, '').trim();
}

/** Parse content into main text and instruction blocks */
function parseContentSections(text: string): { main: string; instructions: string[] } {
  const instructions: string[] = [];
  const regex = /【([\s\S]*?)】/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    instructions.push(match[1].trim());
  }
  const main = text.replace(/【[\s\S]*?】/g, '').trim();
  return { main, instructions };
}

// ========== Storage helpers ==========
function getPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('jai_presets') || '[]'); } catch { return []; }
}

function getSessions(): Record<string, { messages: ChatMessage[]; memory: string }> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('jai_chat_sessions') || '{}'); } catch { return {}; }
}

function saveSession(presetId: string, messages: ChatMessage[], memory: string) {
  if (typeof window === 'undefined') return;
  const sessions = getSessions();
  sessions[presetId] = { messages, memory };
  localStorage.setItem('jai_chat_sessions', JSON.stringify(sessions));
}

function updatePreset(preset: Preset) {
  if (typeof window === 'undefined') return;
  const presets = getPresets();
  const idx = presets.findIndex(p => p.id === preset.id);
  if (idx >= 0) { presets[idx] = preset; localStorage.setItem('jai_presets', JSON.stringify(presets)); }
}

function getInstructionList(): Instruction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('jai_instructions') || '[]'); } catch { return []; }
}

// ========== Translation Instruction ==========
const TRANSLATION_INSTRUCTION = `你是一位精通中英双语、深谙同人圈文化的资深译者，尤其擅长 AO3 网站上的同人文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 精准还原文风：根据英文原文语气灵活切换，保留口语化表达（如"I am weak"译为"我已溃不成军"），不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留英文原词。
- 禁止 AI 翻译腔：避免"极其"、"缓慢地"、"不是…而是…"等生硬句式。译文读起来像有文风的真人作者所写。

禁止使用以下句式：
- "不是……而是……"
- "在……的过程中"
- "总而言之""综上所述"
- "不仅……更……"
- "不是……是……是……"
- "不是……不是……是……"
- "是……的基石/关键/必修课"
禁止使用排比句、对偶句、反复等修辞性排叠结构。
禁止使用"不x，不y，不z，就"格式。
禁止使用"这就够了"、"很…，但很…"等总结性短判断。
禁止使用任何以"不是"开头的否定句式。
每个观点后面必须跟一个画面、声音、气味或触感描写。
禁用词汇："兜住"、"接住"、"稳"、"守"、"极其"。

如果出现了"不是...而是..."、"在...的过程中"、"总而言之"这三种句式，请立刻删除该句，并用描写具体画面或动作的句子替换。`;

// ========== Component ==========
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetIdParam = searchParams.get('preset');

  const [presets, setPresets] = useState<Preset[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [jaiInput, setJaiInput] = useState('');
  const [personMode, setPersonMode] = useState<'first' | 'third'>('third');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);

  // Style selector states
  const [styleTone, setStyleTone] = useState<string>(''); // 剧集调性
  const [styleGenre, setStyleGenre] = useState<string>(''); // 经典类型
  const [styleEmotion, setStyleEmotion] = useState<string>(''); // 情感浓度
  const [stylePace, setStylePace] = useState<string>(''); // 叙事节奏
  const [styleOptional, setStyleOptional] = useState<string[]>([]); // 可选风格(多选)
  const [mixModeNote, setMixModeNote] = useState(''); // 混合模式主基调
  const [showMixModal, setShowMixModal] = useState(false); // 混合模式弹窗
  const [expandedStyleCategory, setExpandedStyleCategory] = useState<string | null>(null);
  const [showOptionalMenu, setShowOptionalMenu] = useState(false);

  // Mobile toolbar state
  const [showMobileToolbar, setShowMobileToolbar] = useState(false);

  // Feature states
  const [inspirationLoading, setInspirationLoading] = useState(false);
  const [inspirationItems, setInspirationItems] = useState<Array<{ en: string; cn?: string; flipped: boolean; translating?: boolean }>>([]);
  const [showInspiration, setShowInspiration] = useState(false);

  const [expandLoading, setExpandLoading] = useState(false);
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandBrief, setExpandBrief] = useState('');
  const [expandResult, setExpandResult] = useState<{ en: string; cn: string } | null>(null);
  const [expandFlipped, setExpandFlipped] = useState(false);

  const [memoryLoading, setMemoryLoading] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryResult, setMemoryResult] = useState<{ en: string; cn: string } | null>(null);
  const [memoryFlipped, setMemoryFlipped] = useState(false);

  // Plot Assistant states
  const [showPlotPanel, setShowPlotPanel] = useState(false);
  const [plotPredictions, setPlotPredictions] = useState<{ en: string; cn: string }[]>([]);
  const [plotTwist, setPlotTwist] = useState<string | null>(null);
  const [plotPredictLoading, setPlotPredictLoading] = useState(false);
  const [plotDirectionKeyword, setPlotDirectionKeyword] = useState('');
  const [selectedPredictionIdx, setSelectedPredictionIdx] = useState<number | null>(null);

  // Current plot direction (shown in top bar, switched between saved directions)
  const [currentDirection, setCurrentDirection] = useState('');
  const [currentDirectionCn, setCurrentDirectionCn] = useState('');
  const [savedPlotDirections, setSavedPlotDirections] = useState<{ en: string; cn: string; stage?: string; stageCn?: string }[]>([]);
  const [showDirectionCard, setShowDirectionCard] = useState(false);

  // Memory update tracking
  const [lastMemoryCount, setLastMemoryCount] = useState(0);
  const [showMemoryReminder, setShowMemoryReminder] = useState(false);
  const [memoryAutoGenerating, setMemoryAutoGenerating] = useState(false);

  // Main storyline summary (shown in plot panel, from AI analysis)
  const [currentMainLine, setCurrentMainLine] = useState('');
  const [currentMainLineCn, setCurrentMainLineCn] = useState('');
  const [plotStage, setPlotStage] = useState('');
  const [plotStageCn, setPlotStageCn] = useState('');
  const [progressDesc, setProgressDesc] = useState('');
  const [progressDescCn, setProgressDescCn] = useState('');

  // AI analysis state
  const [plotAnalyzeLoading, setPlotAnalyzeLoading] = useState(false);

  // Keyword library states (dynamic AI suggestions + free input)
  const [suggestedKeywords, setSuggestedKeywords] = useState<{
    ending: { en: string; cn: string }[];
    relation: { en: string; cn: string }[];
    scene: { en: string; cn: string }[];
    stage: { en: string; cn: string }[];
  }>({ ending: [], relation: [], scene: [], stage: [] });
  const [selectedEnding, setSelectedEnding] = useState<string[]>([]);
  const [selectedRelation, setSelectedRelation] = useState<string[]>([]);
  const [selectedScene, setSelectedScene] = useState<string[]>([]);
  const [selectedStageKeyword, setSelectedStageKeyword] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState({ ending: '', relation: '', scene: '', stage: '' });

  const [notification, setNotification] = useState('');
  const [showInstructionPicker, setShowInstructionPicker] = useState(false);
  const [instructionList, setInstructionList] = useState<Instruction[]>([]);
  const instructionPickerRef = useRef<HTMLDivElement>(null);

  // Close instruction picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (instructionPickerRef.current && !instructionPickerRef.current.contains(e.target as Node)) {
        setShowInstructionPicker(false);
      }
    };
    if (showInstructionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInstructionPicker]);

  // Close optional menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionalMenuRef.current && !optionalMenuRef.current.contains(e.target as Node)) {
        setShowOptionalMenu(false);
      }
      if (expandedStyleCategory) {
        setExpandedStyleCategory(null);
      }
    };
    if (showOptionalMenu || expandedStyleCategory) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionalMenu, expandedStyleCategory]);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const optionalMenuRef = useRef<HTMLDivElement>(null);

  // ========== Load data ==========
  useEffect(() => {
    const p = getPresets();
    setPresets(p);
    if (presetIdParam && p.find(pr => pr.id === presetIdParam)) {
      setCurrentPresetId(presetIdParam);
    } else if (p.length > 0) {
      setCurrentPresetId(p[0].id);
    }
  }, [presetIdParam]);

  useEffect(() => {
    if (!currentPresetId) return;
    const sessions = getSessions();
    const preset = presets.find(p => p.id === currentPresetId);
    
    // Build greeting message
    let greetingMsg: ChatMessage | null = null;
    if (preset) {
      const greeting = (preset.greeting || '')
        .replace(/\{\{char\}\}/gi, preset.charInfo?.split('\n')[0]?.replace(/[^a-zA-Z\s]/g, '').trim() || 'Char')
        .replace(/\{\{user\}\}/gi, preset.userCard?.split('\n')[0]?.replace(/[^a-zA-Z\s]/g, '').trim() || 'User');
      if (greeting.trim()) {
        greetingMsg = {
          id: 'greeting-' + currentPresetId,
          role: 'bot',
          content: greeting,
          translated: false,
          translating: false,
          flipped: false,
          editing: false,
          timestamp: 0
        };
      }
    }
    
    if (sessions[currentPresetId] && sessions[currentPresetId].messages.length > 0) {
      const saved = sessions[currentPresetId].messages;
      // Always ensure greeting is the first message
      if (greetingMsg && saved[0]?.id !== greetingMsg.id) {
        setMessages([greetingMsg, ...saved]);
      } else {
        setMessages(saved);
      }
    } else if (greetingMsg) {
      setMessages([greetingMsg]);
    } else {
      setMessages([]);
    }
  }, [currentPresetId, presets]);

  // Load personMode, thinkingEnabled, and plotData from preset
  useEffect(() => {
    if (!currentPresetId) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (preset) {
      setPersonMode(preset.personMode || 'third');
      setThinkingEnabled(preset.thinkingEnabled || false);
      // Restore plotData from preset
      if (preset.plotData) {
        const pd = preset.plotData;
        if (pd.currentMainLine) setCurrentMainLine(pd.currentMainLine);
        if (pd.currentMainLineCn) setCurrentMainLineCn(pd.currentMainLineCn);
        if (pd.currentDirection) setCurrentDirection(pd.currentDirection);
        if (pd.currentDirectionCn) setCurrentDirectionCn(pd.currentDirectionCn);
        if (pd.plotStage) setPlotStage(pd.plotStage);
        if (pd.plotStageCn) setPlotStageCn(pd.plotStageCn);
        if (pd.progressDesc) setProgressDesc(pd.progressDesc);
        if (pd.progressDescCn) setProgressDescCn(pd.progressDescCn);
        if (pd.selectedEnding) setSelectedEnding(pd.selectedEnding);
        if (pd.selectedRelation) setSelectedRelation(pd.selectedRelation);
        if (pd.selectedScene) setSelectedScene(pd.selectedScene);
        if (pd.selectedStageKeyword) setSelectedStageKeyword(pd.selectedStageKeyword);
        if (pd.savedPlotDirections) setSavedPlotDirections(pd.savedPlotDirections);
        if (pd.suggestedKeywords) setSuggestedKeywords(pd.suggestedKeywords);
        if (pd.lastMemoryCount !== undefined) setLastMemoryCount(pd.lastMemoryCount);
        if (pd.styleSettings) {
          if (pd.styleSettings.tone) setStyleTone(pd.styleSettings.tone);
          if (pd.styleSettings.genre) setStyleGenre(pd.styleSettings.genre);
          if (pd.styleSettings.intensity) setStyleEmotion(pd.styleSettings.intensity);
          if (pd.styleSettings.rhythm) setStylePace(pd.styleSettings.rhythm);
          if (pd.styleSettings.optionalStyles) setStyleOptional(pd.styleSettings.optionalStyles);
        }
      } else if (preset.plotDirection) {
        // Legacy: migrate from plotDirection (was used as both summary and direction)
        setCurrentMainLine(preset.plotDirection);
        setCurrentDirection(preset.plotDirection);
        setSavedPlotDirections([{ en: preset.plotDirection, cn: '' }]);
      }
    }
  }, [currentPresetId]);

  // Auto-save
  useEffect(() => {
    if (!currentPresetId || messages.length === 0) return;
    const preset = presets.find(p => p.id === currentPresetId);
    saveSession(currentPresetId, messages, preset?.longTermMemory || '');
  }, [messages, currentPresetId, presets]);

  // Save personMode/thinkingEnabled back to preset
  useEffect(() => {
    if (!currentPresetId || presets.length === 0) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (!preset) return;
    if (preset.personMode !== personMode || preset.thinkingEnabled !== thinkingEnabled) {
      const updated = { ...preset, personMode, thinkingEnabled };
      const allPresets = presets.map(p => p.id === currentPresetId ? updated : p);
      localStorage.setItem('jai_presets', JSON.stringify(allPresets));
      setPresets(allPresets);
    }
  }, [personMode, thinkingEnabled]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ========== Helpers ==========
  const currentPreset = presets.find(p => p.id === currentPresetId);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2000);
  };

  const RECENT_MESSAGES_LIMIT = 20;

  const buildChatHistory = useCallback(() => {
    // Strategy: long-term memory summary + recent N messages
    const ltm = currentPreset?.longTermMemory;
    const recent = messages.slice(-RECENT_MESSAGES_LIMIT);
    let history = '';
    if (ltm && messages.length > RECENT_MESSAGES_LIMIT) {
      history += `[Long-term Memory Summary]\n${ltm}\n\n[Recent Conversation]\n`;
    }
    history += recent.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');
    return history;
  }, [messages, currentPreset?.longTermMemory]);

  const buildChatHistoryForMemory = useCallback(() => {
    // Memory/inspiration/expand strip instructions — they shouldn't affect these
    const ltm = currentPreset?.longTermMemory;
    const recent = messages.slice(-RECENT_MESSAGES_LIMIT);
    let history = '';
    if (ltm && messages.length > RECENT_MESSAGES_LIMIT) {
      history += `[Long-term Memory Summary]\n${ltm}\n\n[Recent Conversation]\n`;
    }
    history += recent.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${stripInstructions(m.content)}`).join('\n');
    return history;
  }, [messages, currentPreset?.longTermMemory]);

  // Build style prompt string for API injection
  const STYLE_OPTIONS = {
    tone: {
      '欧美剧集': '日常叙事感，情节逐步展开。多线叙事，分幕节奏。对话克制但有重量。每轮对话推动一个情绪节点。适合长线发展。',
      '电影质感': '画面感强，镜头叙事，节奏更紧凑。场景切换明显，对话密度低，动作和环境描述占比更高。画面感和张力优先。适合高潮段落或单幕收束。',
      '混合模式': '以电影质感为主，但保留剧集的长线推进感。',
    },
    genre: {
      '黑色电影': '光影阴暗，道德模糊，旁白冷峻。冷调、阴影、雨夜。对话简练、暗示多。权力博弈以低语和眼神完成。适合背叛、潜伏、调查线。',
      '西部片': '空旷、孤寂、沉默的对抗，荒野法则。话少，靠动作和眼神推进。荣誉、复仇、清算作为核心驱动。适合孤立场景、最后通牒、决斗。',
      '战争/军事': '纪律、压迫、战场上的情感交错。战术动作为主，感情交流被压缩成暗示和短句。服从、忠诚、牺牲、崩坏。适合小队、任务、撤退、溃败线。',
      '黑帮/犯罪': '雨夜、枪声、背叛的低语。暴力美学与信义并存。层级分明，每个位置都有代价。适合上位、背叛、收编线。',
      '法庭/律政': '言辞交锋，逻辑与情感的博弈。每句话都有攻防。外表冷静内里燃烧。适合审讯、谈判、当面对质。',
      '文艺/公路': '缓慢、孤独、宿命式的相遇。大量留白和环境描写。情感在沉默和风景中流淌。适合逃离、寻找、回归线。',
      '青春痛/校园': '男大、宿舍、暗恋、迷茫、成长痛。言语直白但不成熟，冲动但不后悔。身份还在形成，一切都在试。',
      '街头/废土': '辍学、流浪、底层生存、混迹边缘。粗粝、直白、不装。生存本能驱动一切。适合同类相吸、底层联盟。',
      '叛逆/坠落': '反抗权威、自毁倾向、甜心陷阱/糖宝关系。越界是日常，崩溃是必然。适合越陷越深、毁人毁己线。',
    },
    emotion: {
      '强强对抗': '双方势均力敌，互不相让。对话如击剑，每句都是试探。试探、压制、反杀交替出现。谁先软谁输。适合权力换手、底线博弈。',
      '暧昧推拉': '欲言又止，靠近又撤离。每句话都带未完成的重量。肢体和视线描写替代码头。适合持续拉扯、立场渐染。',
      '极度压抑': '沉默比嘶吼更狠，隐忍成病。静默段落占主导。情绪通过动作泄露。对话断句多、间隙长。适合创伤、废墟、对峙。',
      '极度暴力': '身体或心理上的痛感，真实不遮掩。行动优先于语言。对话纯粹功能性，全为推进动作。身体语言给出全部信息。适合围猎、清算、反杀。',
      '极致占有': '偏见、控制、只属于我的执念。封锁、监视、不允许任何人靠近。占有欲从占有到吞噬。适合囚禁、监视、独占线。',
      '病态依赖': '从利用到离不开，双刃剑。一方是毒药也是解药。离开会死，留下会疯。适合共生、崩坏、无法切割线。',
      '年少轻狂': '冲动、不顾后果、热烈但短暂。没有退路也没有后悔药。燃烧感优先。适合青春暴走、一意孤行线。',
      '迷惘沦陷': '不知道自己想要什么，却已经陷进去。方向感丧失，但身体在靠近。适合身份错位、不知不觉线。',
      '玩世不恭': '用轻浮保护自己，其实比谁都怕受伤。笑着说出最痛的话。什么都不当真，但什么都看在眼里。适合伪装崩塌线。',
    },
    pace: {
      '快切': '事件紧凑，节奏迅猛，适合动作/惊险线。每轮对话切换场景或时间点。推进迅速，冲突提早暴露。适合闪回/多线穿插。',
      '慢热': '情绪的缓慢铺陈，一点一滴积累张力。前几轮只有铺垫和氛围。细节堆叠。情绪在沉默中积累。适合建立关系、倒叙展开。',
      '单幕压缩': '高密度叙事，一集内完成起承转合。所有事件在一轮完整场景内发生。最紧凑的结构。适合短线收束、一次爆发。',
      '篇章递进': '分幕式叙事，每阶段明确主题。每个篇章有自己的高潮和收束。整体推进感强。适合长线发展、多线收束。',
      '即兴感': '没有明确剧本，跟着直觉走，像一场不成熟的冒险。方向随时可能偏转。适合意外相遇、计划外线。',
    },
    optional: {
      '加一点浪漫': '在强硬外壳下，细碎的、沉默的温柔。对话软一点。手与眼。对看变成事件。',
      '加一点背叛': '信任被撕开，关系陷入重新洗牌。所有对话都可以是伏笔。沉默不可信。谁先回头谁输。',
      '加一点救赎': '赎罪、放下、重新站起来。对方是伤口也是方向。一步远或者一步晚。动作比语言更接近答案。',
      '加一点牺牲': '等价交换或无法挽回的让渡。台词不全。心里话只有一半。另一部分用动作替掉。',
      '加一点宿命感': '他们相遇本身就是一种注定。无论怎么绕都会回到同一个地方。适合轮回、重逢线。',
      '加一点战损': '身体或心理的伤痕，不掩饰脆弱。伤疤是叙事的一部分。疼痛让沉默更有重量。',
      '加一点地狱笑话': '在压抑情境中冷幽默。笑着说出最不该笑的事。用荒诞感破局。',
      '加一点不可言说': '留白，不说破，更烫人。最关键的话永远不说出口。沉默比台词更有信息量。',
      '加一点疯感': '不理智、不计后果的冲动。理智在关键时刻下线。适合失控、暴走、赌徒线。',
      '加一点躁动': '荷尔蒙、不安分、坐不住的年轻感。身体比脑子先动。空气里都是张力。适合年轻角色、夏天线。',
      '加一点破碎感': '原生家庭问题、自我认同危机、脆弱但逞强。裂痕在外表下。每一次逞强都在碎一点。适合自毁、伪装崩塌线。',
      '加一点街头气': '粗粝、直白、不装、生存本能。话糙理不糙。活下来才是第一位。适合底层、边缘线。',
    },
  } as const;

  const buildStylePrompt = useCallback(() => {
    const parts: string[] = [];
    if (styleTone === '混合模式') {
      parts.push(`[剧集调性: 混合模式] ${STYLE_OPTIONS.tone['混合模式']}${mixModeNote ? ' ' + mixModeNote : ''}`);
    } else if (styleTone) {
      parts.push(`[剧集调性: ${styleTone}] ${STYLE_OPTIONS.tone[styleTone as keyof typeof STYLE_OPTIONS.tone]}`);
    }
    if (styleGenre) parts.push(`[经典类型: ${styleGenre}] ${STYLE_OPTIONS.genre[styleGenre as keyof typeof STYLE_OPTIONS.genre]}`);
    if (styleEmotion) parts.push(`[情感浓度: ${styleEmotion}] ${STYLE_OPTIONS.emotion[styleEmotion as keyof typeof STYLE_OPTIONS.emotion]}`);
    if (stylePace) parts.push(`[叙事节奏: ${stylePace}] ${STYLE_OPTIONS.pace[stylePace as keyof typeof STYLE_OPTIONS.pace]}`);
    styleOptional.forEach(s => {
      const key = s as keyof typeof STYLE_OPTIONS.optional;
      if (STYLE_OPTIONS.optional[key]) parts.push(`[可选风格: ${s}] ${STYLE_OPTIONS.optional[key]}`);
    });
    parts.push(`[隐形适配规则] 所有生成内容默认适配：成人向、强强关系、耽美叙事。角色年龄层默认29-55岁男性为主（可根据设定自动匹配）。类型影响场景和氛围描写；情感浓度影响对话张力与心理描写；节奏影响推进速度和场景切换频率；可选风格作为调味料嵌入每一段生成的细节中。在生成关键剧情时必须匹配选定的风格组合。`);
    return parts.length > 1
      ? `\n\n[风格指令 - 请严格遵循以下风格进行创作]\n${parts.join('\n')}`
      : '';
  }, [styleTone, styleGenre, styleEmotion, stylePace, styleOptional, mixModeNote]);

  const toggleKeyword = (category: 'ending' | 'relation' | 'scene' | 'stage', keyword: string) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<string[]>>> = {
      ending: setSelectedEnding,
      relation: setSelectedRelation,
      scene: setSelectedScene,
      stage: setSelectedStageKeyword,
    };
    const getter: Record<string, string[]> = {
      ending: selectedEnding,
      relation: selectedRelation,
      scene: selectedScene,
      stage: selectedStageKeyword,
    };
    const current = getter[category];
    const setter = setters[category];
    setter(current.includes(keyword) ? current.filter(k => k !== keyword) : [...current, keyword]);
  };

  const getAllKeywords = () => [...selectedEnding, ...selectedRelation, ...selectedScene, ...selectedStageKeyword];

  const buildMainLinePrompt = useCallback(() => {
    if (!currentMainLine.trim() && !currentDirection.trim() && getAllKeywords().length === 0) return '';
    const parts: string[] = [];
    if (currentMainLine.trim()) parts.push(`[主线概括: ${currentMainLine}]`);
    if (currentDirection.trim()) parts.push(`[当前剧情走向: ${currentDirection}]`);
    const allKw = getAllKeywords();
    if (allKw.length > 0) parts.push(`[主线关键词: ${allKw.join('、')}]`);
    if (plotStage) parts.push(`[当前阶段: ${plotStage}]`);
    if (progressDesc) parts.push(`[进展描述: ${progressDesc}]`);
    return parts.length > 0
      ? `\n\n[主线指令 - 灵感和扩写必须向此方向靠拢]\n${parts.join('\n')}\n所有后续生成的灵感、扩写内容都应推动剧情向主线方向发展。`
      : '';
  }, [currentMainLine, currentDirection, selectedEnding, selectedRelation, selectedScene, selectedStageKeyword, plotStage, progressDesc]);

  // ========== Message Actions ==========
  const sendUserMessage = () => {
    if (!userInput.trim()) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput.trim(),
      translated: false, translating: false, flipped: false, editing: false,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
    setUserInput('');
  };

  const sendBotMessage = () => {
    if (!jaiInput.trim()) return;
    const content = jaiInput.trim();
    setMessages(prev => {
      // If last message is Bot and no User after it, replace it
      if (prev.length > 0 && prev[prev.length - 1].role === 'bot') {
        return prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content, translated: false, translating: false, flipped: false, chineseTranslation: undefined }
            : m
        );
      }
      // Otherwise add new
      return [...prev, {
        id: crypto.randomUUID(),
        role: 'bot' as const,
        content,
        translated: false, translating: false, flipped: false, editing: false,
        timestamp: Date.now()
      }];
    });
    setJaiInput('');
  };

  const deleteMessageAndAfter = (id: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
  };

  const startEditMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, editing: true } : m));
  };

  const saveEditMessage = (id: string, newContent: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, content: newContent, editing: false, translated: false, chineseTranslation: undefined, flipped: false } : m
    ));
  };

  const cancelEditMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, editing: false } : m));
  };

  const flipMessage = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    if (!msg.translated && !msg.translating) {
      // Translate first
      setMessages(prev => prev.map(m => m.id === id ? { ...m, translating: true } : m));
      try {
        const apiKey = localStorage.getItem('jai_api_key');
        if (!apiKey) { showNotification('请先配置 API Key'); return; }

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.content, apiKey })
        });
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        const translation = data.translation || '';

        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, chineseTranslation: translation, translated: true, translating: false, flipped: !m.flipped } : m
        ));
      } catch {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, translating: false } : m));
        showNotification('翻译失败');
      }
    } else {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, flipped: !m.flipped } : m));
    }
  };

  const copyContent = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) showNotification('已复制');
    else showNotification('复制失败');
  };

  // ========== AI Features ==========
  const handleInspiration = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setInspirationLoading(true);
    setShowInspiration(true);
    setInspirationItems([]);

    try {
      const personInstruction = personMode === 'first'
        ? 'Use first person (I/me/my) for all suggestions.'
        : 'Use third person (he/she/they) for all suggestions.';

      const res = await fetch('/api/inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey,
          personMode,
          stylePrompt: buildStylePrompt(),
          mainLinePrompt: buildMainLinePrompt()
        })
      });

      if (!res.ok) throw new Error('灵感生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      // Parse: split by ===ITEM=== first, then fallback to newlines
      let items: string[] = [];
      if (fullText.includes('===ITEM===')) {
        items = fullText.split('===ITEM===')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('==='));
      }
      if (items.length < 3) {
        items = fullText.split('\n')
          .map(s => s.replace(/===ITEM===/g, '').replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(s => s.length > 5 && !s.includes('===ITEM==='));
      }
      const parsed = items.slice(0, 3).map(line => ({
        en: line,
        cn: undefined as string | undefined,
        flipped: false,
        translating: false,
      }));
      setInspirationItems(parsed);
    } catch {
      showNotification('灵感生成失败');
    } finally {
      setInspirationLoading(false);
    }
  };

  const handleExpand = async () => {
    if (!expandBrief.trim() || !currentPreset) return;
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setExpandLoading(true);
    setExpandResult(null);
    setExpandFlipped(false);

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: expandBrief,
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey,
          personMode,
          stylePrompt: buildStylePrompt(),
          mainLinePrompt: buildMainLinePrompt()
        })
      });

      if (!res.ok) throw new Error('扩写失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      setExpandResult({ en: (parts[0] || '').trim(), cn: (parts[1] || '').trim() });
    } catch {
      showNotification('扩写失败');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleMemory = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setMemoryLoading(true);
    setMemoryResult(null);
    setMemoryFlipped(false);
    setShowMemoryModal(true);

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey,
          mainLinePrompt: buildMainLinePrompt(),
          styleEmotion: styleEmotion || undefined,
          stylePace: stylePace || undefined
        })
      });

      if (!res.ok) throw new Error('记忆生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      const enText = (parts[0] || '').trim();
      const cnText = (parts[1] || '').trim();
      setMemoryResult({ en: enText, cn: cnText });
    } catch {
      showNotification('记忆生成失败');
    } finally {
      setMemoryLoading(false);
    }
  };

  const saveMemoryToPreset = () => {
    if (!memoryResult || !currentPreset) return;
    const updated = { ...currentPreset, longTermMemory: memoryResult.en };
    updatePreset(updated);
    setPresets(prev => prev.map(p => p.id === currentPresetId ? updated : p));
    setLastMemoryCount(messages.length);
    setShowMemoryReminder(false);
    showNotification('记忆已写入预设');
  };

  // ========== Plot Assistant ==========
  const handlePlotAnalyze = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotAnalyzeLoading(true);

    try {
      const res = await fetch('/api/plot-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          plotDirection: currentPreset.plotDirection,
          apiKey,
          stylePrompt: buildStylePrompt(),
          mainLinePrompt: buildMainLinePrompt()
        })
      });

      if (!res.ok) throw new Error('分析失败');
      const data = await res.json();

      // Fill in AI-generated main line info
      if (data.mainLineName) {
        setCurrentMainLine(data.mainLineName);
        setCurrentMainLineCn(data.mainLineNameCn || '');
      }
      if (data.stage) {
        setPlotStage(data.stage);
        setPlotStageCn(data.stageCn || '');
      }
      if (data.progressDesc) {
        setProgressDesc(data.progressDesc);
        setProgressDescCn(data.progressDescCn || '');
      }
      // Fill in AI-suggested keywords
      if (data.suggestedKeywords) {
        setSuggestedKeywords({
          ending: data.suggestedKeywords.ending || [],
          relation: data.suggestedKeywords.relation || [],
          scene: data.suggestedKeywords.scene || [],
          stage: data.suggestedKeywords.stage || [],
        });
      }

      showNotification('AI 已概括主线并推荐关键词');
    } catch {
      showNotification('剧情分析失败');
    } finally {
      setPlotAnalyzeLoading(false);
    }
  };

  const handlePlotPredict = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotPredictLoading(true);
    setPlotPredictions([]);
    setPlotTwist(null);
    setSelectedPredictionIdx(null);

    try {
      const res = await fetch('/api/plot-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          plotDirection: currentPreset.plotDirection,
          messageCount: messages.filter(m => m.id !== 'greeting-' + currentPresetId).length,
          directionKeyword: plotDirectionKeyword || undefined,
          personMode,
          apiKey,
          stylePrompt: buildStylePrompt(),
          mainLinePrompt: buildMainLinePrompt()
        })
      });

      if (!res.ok) throw new Error('预测生成失败');
      const data = await res.json();

      if (data.predictions && Array.isArray(data.predictions)) {
        const preds = data.predictions.map((p: { en: string; cn: string } | string) =>
          typeof p === 'string' ? { en: p, cn: '' } : p
        );
        setPlotPredictions(preds);
      }
      if (data.twist) {
        setPlotTwist(data.twist);
      }
    } catch {
      showNotification('预测生成失败');
    } finally {
      setPlotPredictLoading(false);
    }
  };

  // Auto-save all plot data to preset
  const autoSavePlotData = () => {
    if (!currentPresetId) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (!preset) return;
    const plotData: PlotData = {
      currentMainLine,
      currentMainLineCn,
      currentDirection,
      currentDirectionCn,
      plotStage,
      plotStageCn,
      progressDesc,
      progressDescCn,
      selectedEnding,
      selectedRelation,
      selectedScene,
      selectedStageKeyword,
      savedPlotDirections,
      suggestedKeywords,
      styleSettings: {
        tone: styleTone,
        genre: styleGenre,
        intensity: styleEmotion,
        rhythm: stylePace,
        optionalStyles: styleOptional,
        mixModeNote,
      },
      lastMemoryCount,
    };
    const updated = { ...preset, plotData, plotDirection: currentDirection };
    updatePreset(updated);
    setPresets(prev => prev.map(p => p.id === currentPresetId ? updated : p));
  };

  // Debounced auto-save on any plot data change
  useEffect(() => {
    if (!currentPresetId) return;
    const timer = setTimeout(() => {
      autoSavePlotData();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMainLine, currentMainLineCn, currentDirection, currentDirectionCn, plotStage, plotStageCn, progressDesc, progressDescCn,
      selectedEnding, selectedRelation, selectedScene, selectedStageKeyword,
      savedPlotDirections, suggestedKeywords,
      styleTone, styleGenre, styleEmotion, stylePace, styleOptional, mixModeNote, lastMemoryCount]);

  const selectPlotDirection = (idx: number) => {
    const pred = plotPredictions[idx];
    if (!pred) return;
    setSelectedPredictionIdx(idx);
    setCurrentDirection(pred.en);
    setCurrentDirectionCn(pred.cn);
    setSavedPlotDirections(prev => {
      if (prev.some(d => d.en === pred.en)) return prev;
      return [...prev, { en: pred.en, cn: pred.cn, stage: plotStage, stageCn: plotStageCn }];
    });
  };

  const handleBackToPresets = () => {
    if (currentPresetId) {
      const preset = presets.find(p => p.id === currentPresetId);
      if (preset) {
        saveSession(currentPresetId, messages, preset.longTermMemory);
      }
    }
    showNotification('会话已保存');
    setTimeout(() => router.push('/presets'), 500);
  };

  // ========== Render ==========
  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-jai-bg/50 px-4">
        <p className="text-jai-text-secondary mb-4">暂无预设，请先生成 User 卡并保存</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-jai-secondary text-white rounded-lg hover:bg-jai-accent">
          去生成
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-jai-bg/50 chat-fullscreen">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-jai-card/80 backdrop-blur-sm border-b border-jai-card-border">
        <button onClick={handleBackToPresets} className="p-1.5 md:p-1 text-jai-secondary hover:text-jai-accent transition-colors">
          <IconBack className="w-5 h-5" />
        </button>
        <select
          value={currentPresetId}
          onChange={e => setCurrentPresetId(e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-jai-text"
        >
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Direction indicator - fixed above scroll area */}
      {currentDirection && (
        <div className="flex justify-end px-3 md:px-4 pt-1 pb-0.5" onClick={() => setShowInstructionPicker(false)}>
          <button
            onClick={() => setShowDirectionCard(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jai-muted/90 border border-jai-secondary/60 text-jai-accent hover:bg-jai-muted transition-colors text-[11px] max-w-[95%] md:max-w-[80%]"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            <span className="truncate">{currentDirection}</span>
          </button>
        </div>
      )}
      {/* Direction popup card */}
      {showDirectionCard && currentDirection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowDirectionCard(false)}>
          <div className="bg-jai-card rounded-2xl shadow-xl border border-jai-card-border mx-4 max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-3 border-b border-jai-card-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-jai-muted text-jai-accent px-2 py-0.5 rounded-full font-medium">当前走向</span>
              </div>
              <button onClick={() => setShowDirectionCard(false)} className="text-jai-text-secondary hover:text-jai-text p-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-sm text-jai-text leading-relaxed">{currentDirection}</p>
              </div>
              {currentDirectionCn && (
                <div className="pt-2 border-t border-jai-thinking/30">
                  <span className="text-[10px] bg-jai-thinking/20 text-[#8b5cf6] px-1.5 py-0.5 rounded font-medium">中文</span>
                  <p className="text-sm text-jai-text mt-1.5 leading-relaxed">{currentDirectionCn}</p>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-jai-muted flex items-center gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(currentDirection); showNotification('已复制走向'); }}
                className="text-[11px] text-jai-accent hover:text-jai-accent flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                复制
              </button>
              <button
                onClick={() => { setCurrentDirection(''); setCurrentDirectionCn(''); setShowDirectionCard(false); }}
                className="text-[11px] text-jai-text-secondary hover:text-jai-text ml-auto"
              >清除走向</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages - scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-3 md:px-4 space-y-3" onClick={() => setShowInstructionPicker(false)}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onFlip={() => flipMessage(msg.id)}
            onEdit={() => startEditMessage(msg.id)}
            onSaveEdit={(content) => saveEditMessage(msg.id, content)}
            onCancelEdit={() => cancelEditMessage(msg.id)}
            onDelete={() => deleteMessageAndAfter(msg.id)}
            onCopy={() => copyContent(msg.flipped && msg.chineseTranslation ? msg.chineseTranslation : msg.content)}
            onMarkAsInstruction={(selectedIndices: number[]) => {
              // The actual content rebuild happens inside MessageBubble via onSaveEdit
              // This callback is just for notification
              if (selectedIndices.length > 0) {
                showNotification(`已标记 ${selectedIndices.length} 段为指令`);
              }
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Inspiration Panel */}
      {showInspiration && (
        <div className="shrink-0 mx-3 md:mx-4 mb-2 bg-jai-card rounded-xl border border-jai-card-border shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-jai-accent flex items-center gap-1">
              <IconSparkle className="w-3.5 h-3.5" /> 灵感
            </span>
            <div className="flex items-center gap-1">
              <button onClick={handleInspiration} disabled={inspirationLoading} className="p-1 text-jai-secondary hover:text-jai-accent disabled:opacity-50">
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowInspiration(false)} className="p-1 text-jai-text-secondary hover:text-jai-text text-xs">✕</button>
            </div>
          </div>
          {inspirationLoading ? (
            <p className="text-xs text-jai-text-secondary animate-pulse">生成中...</p>
          ) : (
            <div className="space-y-2">
              {inspirationItems.map((item, i) => (
                <div key={i} className="relative">
                  <div
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      item.flipped ? 'bg-jai-muted border-jai-secondary' : 'bg-jai-card border-jai-card-border hover:bg-jai-bg/50'
                    }`}
                    onClick={() => {
                      if (!item.flipped) {
                        // Flip to Chinese - translate if needed
                        const newItems = [...inspirationItems];
                        if (!item.cn) {
                          newItems[i] = { ...item, translating: true };
                          setInspirationItems(newItems);
                          // Call translate API
                          const apiKey = localStorage.getItem('jai_api_key') || '';
                          fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: item.en, apiKey }),
                          }).then(r => r.json()).then(data => {
                            const updated = [...inspirationItems];
                            updated[i] = { ...updated[i], cn: data.translation || '翻译失败', flipped: true, translating: false };
                            setInspirationItems(updated);
                          }).catch(() => {
                            const updated = [...inspirationItems];
                            updated[i] = { ...updated[i], translating: false, flipped: true, cn: '翻译失败' };
                            setInspirationItems(updated);
                          });
                        } else {
                          newItems[i] = { ...item, flipped: true };
                          setInspirationItems(newItems);
                        }
                      } else {
                        // Flip back to English
                        const newItems = [...inspirationItems];
                        newItems[i] = { ...item, flipped: false };
                        setInspirationItems(newItems);
                      }
                    }}
                  >
                    {item.translating ? (
                      <p className="text-xs text-jai-text-secondary animate-pulse">翻译中...</p>
                    ) : item.flipped ? (
                      <p className="text-xs text-jai-text">{item.cn}</p>
                    ) : (
                      <p className="text-xs text-jai-text">{item.en}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyContent(item.en); }}
                      className="text-[10px] text-jai-secondary hover:text-jai-accent"
                    >复制</button>
                    <span className="text-[10px] text-jai-text-secondary">|</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.flipped) {
                          const newItems = [...inspirationItems];
                          if (!item.cn) {
                            newItems[i] = { ...item, translating: true };
                            setInspirationItems(newItems);
                            const apiKey = localStorage.getItem('jai_api_key') || '';
                            fetch('/api/translate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ text: item.en, apiKey }),
                            }).then(r => r.json()).then(data => {
                              const updated = [...inspirationItems];
                              updated[i] = { ...updated[i], cn: data.translation || '翻译失败', flipped: true, translating: false };
                              setInspirationItems(updated);
                            }).catch(() => {
                              const updated = [...inspirationItems];
                              updated[i] = { ...updated[i], translating: false, flipped: true, cn: '翻译失败' };
                              setInspirationItems(updated);
                            });
                          } else {
                            newItems[i] = { ...item, flipped: true };
                            setInspirationItems(newItems);
                          }
                        } else {
                          const newItems = [...inspirationItems];
                          newItems[i] = { ...item, flipped: false };
                          setInspirationItems(newItems);
                        }
                      }}
                      className="text-[10px] text-jai-text-secondary hover:text-jai-text"
                    >翻转</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plot Assistant Panel */}
      {showPlotPanel && (
        <div className="fixed inset-0 z-50 md:relative md:z-auto flex items-end md:items-start justify-center bg-black/30 md:bg-transparent" onClick={() => setShowPlotPanel(false)}>
          <div className="bg-jai-card md:bg-jai-card rounded-t-2xl md:rounded-xl border-t md:border border-jai-card-border md:border-jai-card-border shadow-sm w-full md:mx-4 md:mb-2 max-h-[90vh] md:max-h-[55vh] overflow-hidden md:shadow-sm" onClick={e => e.stopPropagation()}>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-jai-muted/50 border-b border-jai-card-border sticky top-0 z-10">
              <span className="text-xs font-medium text-jai-accent flex items-center gap-1">
                <IconPlot className="w-3.5 h-3.5" /> 剧情助手
              </span>
              <button onClick={() => setShowPlotPanel(false)} className="p-1 text-jai-text-secondary hover:text-jai-text text-xs">✕</button>
            </div>

          <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 44px)' }}>
            {/* Section 0: AI Analyze Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlotAnalyze}
                disabled={plotAnalyzeLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted0 text-white hover:bg-jai-secondary disabled:opacity-50 transition-colors"
              >
                <IconRefresh className={`w-3 h-3 ${plotAnalyzeLoading ? 'animate-spin' : ''}`} />
                {plotAnalyzeLoading ? 'AI 分析中...' : 'AI 概括主线 + 推荐关键词'}
              </button>
              <span className="text-[10px] text-jai-text-secondary">AI 自动概括当前剧情主线和推荐关键词</span>
            </div>

            <div className="border-t border-jai-card-border" />

            {/* Section 1: Main Line Summary (from AI analysis, direction switching is in the top bar) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide">剧情概括</span>
              </div>
              {currentMainLine ? (
                <div className="p-2.5 rounded-lg border bg-jai-muted/50 border-jai-secondary">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-jai-accent">{currentMainLine}</span>
                    {currentMainLineCn && <span className="text-[11px] text-jai-text-secondary">({currentMainLineCn})</span>}
                  </div>
                  {plotStage && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-jai-text-secondary">阶段:</span>
                      <span className="text-[10px] bg-jai-muted text-jai-accent px-1.5 py-0.5 rounded">{plotStageCn || plotStage}</span>
                    </div>
                  )}
                  {progressDesc && (
                    <p className="text-[11px] text-jai-text-secondary">{progressDesc}</p>
                  )}
                  {progressDescCn && (
                    <p className="text-[10px] text-jai-text-secondary mt-0.5">{progressDescCn}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={currentMainLine}
                      onChange={e => setCurrentMainLine(e.target.value)}
                      placeholder="手动输入概括，或点上方 AI 按钮自动概括"
                      className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-jai-card-border" />

            {/* Section 2: Keyword Library */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide">关键词库</span>
                <button
                  onClick={handlePlotAnalyze}
                  disabled={plotAnalyzeLoading}
                  className="p-1 text-jai-secondary hover:text-jai-accent disabled:opacity-50"
                  title="刷新推荐关键词"
                >
                  <IconRefresh className={`w-3 h-3 ${plotAnalyzeLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {suggestedKeywords.ending.length === 0 && suggestedKeywords.relation.length === 0 ? (
                <p className="text-[11px] text-jai-text-secondary">点击上方"AI 概括主线 + 推荐关键词"按钮生成推荐</p>
              ) : (
              <div className="space-y-2">
                {/* Ending keywords */}
                <div>
                  <span className="text-[10px] text-jai-accent font-medium">结局走向</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {suggestedKeywords.ending.map(kw => (
                      <button
                        key={kw.en}
                        onClick={() => toggleKeyword('ending', kw.en)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          selectedEnding.includes(kw.en)
                            ? 'bg-jai-secondary border-jai-accent text-jai-accent'
                            : 'bg-jai-muted/50 border-jai-card-border text-jai-text-secondary hover:bg-jai-muted'
                        }`}
                      ><span className="text-[8px] text-jai-secondary bg-jai-muted px-0.5 rounded mr-0.5">AI</span>{kw.en}<span className="text-[9px] text-jai-text-secondary ml-0.5">({kw.cn})</span></button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={customKeyword.ending}
                      onChange={e => setCustomKeyword(prev => ({ ...prev, ending: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customKeyword.ending.trim()) {
                          setSelectedEnding(prev => prev.includes(customKeyword.ending.trim()) ? prev : [...prev, customKeyword.ending.trim()]);
                          setCustomKeyword(prev => ({ ...prev, ending: '' }));
                        }
                      }}
                      placeholder="自定义..."
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    />
                    <button
                      onClick={() => {
                        if (customKeyword.ending.trim()) {
                          setSelectedEnding(prev => prev.includes(customKeyword.ending.trim()) ? prev : [...prev, customKeyword.ending.trim()]);
                          setCustomKeyword(prev => ({ ...prev, ending: '' }));
                        }
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-jai-muted text-jai-accent rounded hover:bg-jai-secondary"
                    >+</button>
                  </div>
                </div>

                {/* Relation keywords */}
                <div>
                  <span className="text-[10px] text-jai-accent font-medium">关系动态</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {suggestedKeywords.relation.map(kw => (
                      <button
                        key={kw.en}
                        onClick={() => toggleKeyword('relation', kw.en)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          selectedRelation.includes(kw.en)
                            ? 'bg-jai-secondary border-jai-accent text-jai-accent'
                            : 'bg-jai-muted/50 border-jai-card-border text-jai-text-secondary hover:bg-jai-muted'
                        }`}
                      ><span className="text-[8px] text-jai-secondary bg-jai-muted px-0.5 rounded mr-0.5">AI</span>{kw.en}<span className="text-[9px] text-jai-text-secondary ml-0.5">({kw.cn})</span></button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={customKeyword.relation}
                      onChange={e => setCustomKeyword(prev => ({ ...prev, relation: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customKeyword.relation.trim()) {
                          setSelectedRelation(prev => prev.includes(customKeyword.relation.trim()) ? prev : [...prev, customKeyword.relation.trim()]);
                          setCustomKeyword(prev => ({ ...prev, relation: '' }));
                        }
                      }}
                      placeholder="自定义..."
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    />
                    <button
                      onClick={() => {
                        if (customKeyword.relation.trim()) {
                          setSelectedRelation(prev => prev.includes(customKeyword.relation.trim()) ? prev : [...prev, customKeyword.relation.trim()]);
                          setCustomKeyword(prev => ({ ...prev, relation: '' }));
                        }
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-jai-muted text-jai-accent rounded hover:bg-jai-secondary"
                    >+</button>
                  </div>
                </div>

                {/* Scene keywords */}
                <div>
                  <span className="text-[10px] text-jai-accent font-medium">场景</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {suggestedKeywords.scene.map(kw => (
                      <button
                        key={kw.en}
                        onClick={() => toggleKeyword('scene', kw.en)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          selectedScene.includes(kw.en)
                            ? 'bg-jai-secondary border-jai-accent text-jai-accent'
                            : 'bg-jai-muted/50 border-jai-card-border text-jai-text-secondary hover:bg-jai-muted'
                        }`}
                      ><span className="text-[8px] text-jai-secondary bg-jai-muted px-0.5 rounded mr-0.5">AI</span>{kw.en}<span className="text-[9px] text-jai-text-secondary ml-0.5">({kw.cn})</span></button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={customKeyword.scene}
                      onChange={e => setCustomKeyword(prev => ({ ...prev, scene: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customKeyword.scene.trim()) {
                          setSelectedScene(prev => prev.includes(customKeyword.scene.trim()) ? prev : [...prev, customKeyword.scene.trim()]);
                          setCustomKeyword(prev => ({ ...prev, scene: '' }));
                        }
                      }}
                      placeholder="自定义..."
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    />
                    <button
                      onClick={() => {
                        if (customKeyword.scene.trim()) {
                          setSelectedScene(prev => prev.includes(customKeyword.scene.trim()) ? prev : [...prev, customKeyword.scene.trim()]);
                          setCustomKeyword(prev => ({ ...prev, scene: '' }));
                        }
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-jai-muted text-jai-accent rounded hover:bg-jai-secondary"
                    >+</button>
                  </div>
                </div>

                {/* Stage keywords */}
                <div>
                  <span className="text-[10px] text-jai-accent font-medium">阶段</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {suggestedKeywords.stage.map(kw => (
                      <button
                        key={kw.en}
                        onClick={() => toggleKeyword('stage', kw.en)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          selectedStageKeyword.includes(kw.en)
                            ? 'bg-jai-secondary border-jai-accent text-jai-accent'
                            : 'bg-jai-muted/50 border-jai-card-border text-jai-text-secondary hover:bg-jai-muted'
                        }`}
                      ><span className="text-[8px] text-jai-secondary bg-jai-muted px-0.5 rounded mr-0.5">AI</span>{kw.en}<span className="text-[9px] text-jai-text-secondary ml-0.5">({kw.cn})</span></button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={customKeyword.stage}
                      onChange={e => setCustomKeyword(prev => ({ ...prev, stage: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customKeyword.stage.trim()) {
                          setSelectedStageKeyword(prev => prev.includes(customKeyword.stage.trim()) ? prev : [...prev, customKeyword.stage.trim()]);
                          setCustomKeyword(prev => ({ ...prev, stage: '' }));
                        }
                      }}
                      placeholder="自定义..."
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    />
                    <button
                      onClick={() => {
                        if (customKeyword.stage.trim()) {
                          setSelectedStageKeyword(prev => prev.includes(customKeyword.stage.trim()) ? prev : [...prev, customKeyword.stage.trim()]);
                          setCustomKeyword(prev => ({ ...prev, stage: '' }));
                        }
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-jai-muted text-jai-accent rounded hover:bg-jai-secondary"
                    >+</button>
                  </div>
                </div>

                {/* Selected keywords summary */}
                {getAllKeywords().length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-jai-card-border">
                    <span className="text-[10px] text-jai-text-secondary">已选:</span>
                    {getAllKeywords().map((kw, i) => (
                      <span key={i} className="text-[10px] bg-jai-muted text-jai-accent px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        {kw}
                        <button
                          onClick={() => {
                            setSelectedEnding(prev => prev.filter(k => k !== kw));
                            setSelectedRelation(prev => prev.filter(k => k !== kw));
                            setSelectedScene(prev => prev.filter(k => k !== kw));
                            setSelectedStageKeyword(prev => prev.filter(k => k !== kw));
                          }}
                          className="text-jai-secondary hover:text-jai-accent ml-0.5"
                        >×</button>
                      </span>
                    ))}
                    <button
                      onClick={() => { setSelectedEnding([]); setSelectedRelation([]); setSelectedScene([]); setSelectedStageKeyword([]); }}
                      className="text-[10px] text-jai-text-secondary hover:text-jai-text"
                    >清空</button>
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="border-t border-jai-card-border" />

            {/* Section 3: Plot Prediction (God's Eye View) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide">剧情走向（上帝视角）</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={plotDirectionKeyword}
                    onChange={e => setPlotDirectionKeyword(e.target.value)}
                    placeholder="补充方向..."
                    className="text-[10px] w-20 px-1.5 py-0.5 rounded border border-jai-card-border bg-jai-muted/30 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlotPredict(); } }}
                  />
                  <button onClick={handlePlotPredict} disabled={plotPredictLoading} className="p-1 text-jai-secondary hover:text-jai-accent disabled:opacity-50">
                    <IconRefresh className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {plotPredictLoading ? (
                <p className="text-xs text-jai-text-secondary animate-pulse">生成中...</p>
              ) : plotPredictions.length > 0 ? (
                <div className="space-y-2">
                  {plotPredictions.map((pred, i) => {
                    const isSelected = currentDirection === pred.en;
                    return (
                      <div key={i} className={`rounded-lg border p-2 transition-colors ${isSelected ? 'border-jai-accent bg-jai-muted' : 'border-jai-card-border bg-jai-card hover:bg-jai-muted/30'}`}>
                        <p className="text-xs text-jai-text">{pred.en}</p>
                        {pred.cn && <p className="text-[11px] text-jai-text-secondary mt-0.5">{pred.cn}</p>}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <button
                            onClick={() => copyContent(pred.en)}
                            className="text-[10px] text-jai-accent hover:text-jai-accent"
                          >复制</button>
                          <span className="text-[10px] text-jai-text-secondary">|</span>
                          <button
                            onClick={() => selectPlotDirection(i)}
                            className={`text-[10px] font-medium ${isSelected ? 'text-jai-accent' : 'text-jai-accent hover:text-jai-accent'}`}
                          >{isSelected ? '✓ 当前走向' : '选为走向'}</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Twist prediction */}
                  {plotTwist && (
                    <div className="rounded-lg border border-jai-thinking/50 bg-jai-thinking/10 p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-medium text-jai-thinking bg-jai-thinking/20 px-1 py-0.5 rounded">阶段性转折</span>
                      </div>
                      <div>
                        <p className="text-xs text-jai-text">{plotTwist}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button onClick={() => copyContent(plotTwist || '')} className="text-[10px] text-jai-thinking hover:text-jai-thinking/80">复制</button>
                        <span className="text-[10px] text-jai-text-secondary">|</span>
                        <button
                          onClick={() => {
                            if (plotTwist) {
                              setCurrentDirection(plotTwist);
                              setCurrentDirectionCn('翻译中...');
                              setSavedPlotDirections(prev => {
                                if (prev.some(d => d.en === plotTwist)) return prev;
                                return [...prev, { en: plotTwist, cn: '' }];
                              });
                              showNotification('转折已设为当前走向');
                              // Auto-translate twist to Chinese
                              const apiKey = localStorage.getItem('jai_api_key') || '';
                              fetch('/api/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: plotTwist, apiKey }),
                              }).then(r => r.json()).then(data => {
                                const cn = data.translation || '翻译失败';
                                setCurrentDirectionCn(cn);
                                setSavedPlotDirections(prev =>
                                  prev.map(d => d.en === plotTwist ? { ...d, cn } : d)
                                );
                              }).catch(() => {
                                setCurrentDirectionCn('翻译失败');
                                setSavedPlotDirections(prev =>
                                  prev.map(d => d.en === plotTwist ? { ...d, cn: '翻译失败' } : d)
                                );
                              });
                            }
                          }}
                          className="text-[10px] text-jai-thinking hover:text-jai-thinking/80 font-medium"
                        >选为走向</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-jai-text-secondary">点击刷新按钮生成剧情走向预测</p>
              )}
            </div>

          </div>
          </div>
        </div>
      )}

      {/* Expand Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-jai-accent flex items-center gap-1.5">
                  <IconPen className="w-4 h-4" /> 扩写
                </span>
                <button onClick={() => { setShowExpandModal(false); setExpandResult(null); setExpandBrief(''); }} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>

              {!expandResult ? (
                <div className="space-y-3">
                  <textarea
                    value={expandBrief}
                    onChange={e => setExpandBrief(e.target.value)}
                    placeholder="输入简短梗概..."
                    className="w-full text-sm p-3 rounded-xl border border-jai-card-border focus:border-jai-accent focus:outline-none resize-none min-h-[80px]"
                    rows={3}
                  />
                  <button
                    onClick={handleExpand}
                    disabled={!expandBrief.trim() || expandLoading}
                    className="w-full py-2 text-sm bg-jai-secondary text-white rounded-xl hover:bg-jai-accent disabled:opacity-50 transition-colors"
                  >
                    {expandLoading ? '生成中...' : '扩写'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-jai-bg/50 border border-jai-card-border">
                    <p className="text-sm whitespace-pre-wrap">{expandFlipped ? expandResult.cn : expandResult.en}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyContent(expandResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={() => setExpandFlipped(!expandFlipped)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border">
                      <IconFlip className="w-3 h-3" /> {expandFlipped ? '英文' : '中文'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-jai-thinking flex items-center gap-1.5">
                  <IconBrain className="w-4 h-4" /> 长期记忆
                </span>
                <button onClick={() => { setShowMemoryModal(false); setMemoryResult(null); }} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>

              {memoryLoading ? (
                <p className="text-sm text-jai-text-secondary animate-pulse">生成中...</p>
              ) : memoryResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-jai-thinking/10 border border-jai-thinking/30">
                    <p className="text-sm whitespace-pre-wrap">{memoryFlipped ? memoryResult.cn : memoryResult.en}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => copyContent(memoryResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-thinking/10 text-jai-thinking hover:bg-jai-thinking/20">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={() => setMemoryFlipped(!memoryFlipped)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-thinking/10 text-jai-thinking hover:bg-jai-thinking/20">
                      <IconFlip className="w-3 h-3" /> {memoryFlipped ? '英文' : '中文'}
                    </button>
                    <button onClick={saveMemoryToPreset} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#E8F5EF] text-jai-success hover:bg-[#D4EDE2]">
                      <IconLock className="w-3 h-3" /> 写入预设库
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="shrink-0 border-t border-jai-card-border bg-jai-card/90 backdrop-blur-sm px-3 md:px-4 pt-2 pb-2 md:pb-3 space-y-1.5 md:space-y-2 safe-area-bottom">

        {/* Memory Reminder Banner */}
        {showMemoryReminder && !memoryAutoGenerating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-jai-thinking/10 border border-jai-thinking/50 text-jai-thinking text-xs">
            <IconBrain className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate">距上次记忆已超过 20 轮，建议更新长期记忆</span>
            <button
              onClick={handleMemory}
              disabled={memoryLoading}
              className="px-2 py-0.5 text-[10px] rounded bg-jai-thinking/100 text-white hover:bg-jai-thinking/80 disabled:opacity-50 transition-colors shrink-0"
            >
              立即更新
            </button>
            <button
              onClick={() => setShowMemoryReminder(false)}
              className="text-jai-thinking hover:text-[#8b5cf6] shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        {memoryAutoGenerating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-jai-thinking/10 border border-jai-thinking/50 text-[#8b5cf6] text-xs animate-pulse">
            <IconBrain className="w-3.5 h-3.5 shrink-0" />
            <span>自动更新长期记忆中...</span>
          </div>
        )}

        {/* Controls Row - Desktop: always visible; Mobile: in expandable toolbar */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <select
            value={personMode}
            onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
            className="text-xs px-2 py-1 rounded-lg border border-jai-card-border bg-jai-bg/50 text-jai-accent focus:outline-none focus:border-jai-accent"
          >
            <option value="first">第一人称 (I/Me)</option>
            <option value="third">第三人称 (He/She)</option>
          </select>

          {/* Style Category Buttons - Desktop */}
          {(['tone', 'genre', 'emotion', 'pace'] as const).map(cat => {
            const labels: Record<string, string> = { tone: '剧集调性', genre: '经典类型', emotion: '情感浓度', pace: '叙事节奏' };
            const currentVal = cat === 'tone' ? styleTone : cat === 'genre' ? styleGenre : cat === 'emotion' ? styleEmotion : stylePace;
            const setter = cat === 'tone' ? setStyleTone : cat === 'genre' ? setStyleGenre : cat === 'emotion' ? setStyleEmotion : setStylePace;
            const options = STYLE_OPTIONS[cat];
            const isExpanded = expandedStyleCategory === cat;
            return (
              <div key={cat} className="relative">
                <button
                  onClick={() => setExpandedStyleCategory(isExpanded ? null : cat)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${currentVal ? 'bg-jai-secondary text-white border-jai-secondary' : 'border-jai-card-border bg-jai-bg/50 text-jai-accent hover:border-jai-accent'}`}
                >
                  <span>{currentVal || labels[cat]}</span>
                  <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isExpanded && (
                  <div className="absolute bottom-full left-0 mb-1 bg-jai-card border border-jai-card-border rounded-lg shadow-lg py-1 min-w-[220px] z-50 max-h-60 overflow-y-auto">
                    {Object.entries(options).map(([key, desc]) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (cat === 'tone' && key === '混合模式') {
                            setter(key);
                            setShowMixModal(true);
                          } else {
                            setter(key);
                          }
                          setExpandedStyleCategory(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-jai-muted transition-colors ${currentVal === key ? 'bg-jai-muted text-jai-accent font-medium' : 'text-jai-text'}`}
                      >
                        <span className="font-medium">{key}</span>
                        <span className="block text-[10px] text-jai-text-secondary mt-0.5 line-clamp-2">{desc}</span>
                      </button>
                    ))}
                    {currentVal && (
                      <button
                        onClick={() => { setter(''); setExpandedStyleCategory(null); }}
                        className="w-full text-left px-3 py-1 text-xs text-red-400 hover:bg-red-50 border-t border-jai-muted"
                      >清除选择</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Optional Styles - Desktop */}
          <div className="relative" ref={optionalMenuRef}>
            <button
              onClick={() => setShowOptionalMenu(!showOptionalMenu)}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${styleOptional.length > 0 ? 'bg-jai-secondary text-white border-jai-secondary' : 'border-jai-card-border bg-jai-bg/50 text-jai-accent hover:border-jai-accent'}`}
            >
              <span>{styleOptional.length > 0 ? `风格×${styleOptional.length}` : '可选风格'}</span>
            </button>
            {showOptionalMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-jai-card border border-jai-card-border rounded-lg shadow-lg p-2 min-w-[220px] z-50 max-h-64 overflow-y-auto">
                {Object.entries(STYLE_OPTIONS.optional).map(([key, desc]) => (
                  <label key={key} className="flex items-start gap-2 py-1 text-xs text-jai-text cursor-pointer hover:bg-jai-muted rounded px-1">
                    <input
                      type="checkbox"
                      checked={styleOptional.includes(key)}
                      onChange={e => {
                        if (e.target.checked) setStyleOptional(prev => [...prev, key]);
                        else setStyleOptional(prev => prev.filter(v => v !== key));
                      }}
                      className="rounded border-jai-accent text-jai-accent focus:ring-jai-accent mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-medium">{key}</span>
                      <span className="block text-[10px] text-jai-text-secondary mt-0.5">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-jai-text-secondary cursor-pointer ml-auto">
            <span>思考</span>
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${thinkingEnabled ? 'bg-jai-thinking' : 'bg-jai-muted'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-jai-card transition-transform ${thinkingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Mobile: Expandable Toolbar */}
        {showMobileToolbar && (
          <div className="md:hidden space-y-2 pb-1">
            {/* Row 1: Person mode + Style buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={personMode}
                onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
                className="text-xs px-2 py-1.5 rounded-lg border border-jai-card-border bg-jai-bg/50 text-jai-accent focus:outline-none focus:border-jai-accent"
              >
                <option value="first">第一人称</option>
                <option value="third">第三人称</option>
              </select>

              {/* Mobile style buttons - open as bottom sheet */}
              {(['tone', 'genre', 'emotion', 'pace'] as const).map(cat => {
                const labels: Record<string, string> = { tone: '调性', genre: '类型', emotion: '情感', pace: '节奏' };
                const currentVal = cat === 'tone' ? styleTone : cat === 'genre' ? styleGenre : cat === 'emotion' ? styleEmotion : stylePace;
                const isExpanded = expandedStyleCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setExpandedStyleCategory(isExpanded ? null : cat)}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-0.5 ${currentVal ? 'bg-jai-secondary text-white border-jai-secondary' : 'border-jai-card-border bg-jai-bg/50 text-jai-accent'}`}
                  >
                    <span>{currentVal || labels[cat]}</span>
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                );
              })}
              <button
                onClick={() => setShowOptionalMenu(!showOptionalMenu)}
                className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${styleOptional.length > 0 ? 'bg-jai-secondary text-white border-jai-secondary' : 'border-jai-card-border bg-jai-bg/50 text-jai-accent'}`}
              >
                {styleOptional.length > 0 ? `风格×${styleOptional.length}` : '可选'}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-jai-text-secondary cursor-pointer ml-auto">
                <span>思考</span>
                <button
                  onClick={() => setThinkingEnabled(!thinkingEnabled)}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${thinkingEnabled ? 'bg-jai-thinking' : 'bg-jai-muted'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-jai-card transition-transform ${thinkingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>

            {/* Feature buttons - mobile */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={handleInspiration} disabled={inspirationLoading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
                <IconSparkle className="w-3 h-3" /> 灵感
              </button>
              <button onClick={() => setShowExpandModal(true)} disabled={expandLoading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
                <IconPen className="w-3 h-3" /> 扩写
              </button>
              <button onClick={handleMemory} disabled={memoryLoading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
                <IconBrain className="w-3 h-3" /> 记忆
              </button>
              <button
                onClick={() => setShowPlotPanel(!showPlotPanel)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-muted transition-colors"
              >
                <IconPlot className="w-3 h-3" /> 剧情
              </button>
              <div className="relative" ref={instructionPickerRef}>
                <button
                  onClick={() => {
                    setInstructionList(getInstructionList());
                    setShowInstructionPicker(!showInstructionPicker);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border transition-colors"
                >
                  <IconBook className="w-3 h-3" /> 指令
                </button>
                {showInstructionPicker && instructionList.length > 0 && (
                  <div className="absolute bottom-full right-0 mb-1 w-56 max-h-48 overflow-y-auto bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-1">
                    {instructionList.map(inst => (
                      <button
                        key={inst.id}
                        onClick={() => {
                          setUserInput(prev => (prev ? prev + '\n' : '') + `【${inst.content}】`);
                          setShowInstructionPicker(false);
                          showNotification(`已插入「${inst.name}」`);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-jai-muted transition-colors"
                      >
                        <p className="text-xs font-medium text-jai-text truncate">{inst.name}</p>
                        <p className="text-[10px] text-jai-text-secondary truncate">{inst.summary}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showInstructionPicker && instructionList.length === 0 && (
                  <div className="absolute bottom-full right-0 mb-1 w-44 bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-3 px-3">
                    <p className="text-xs text-jai-text-secondary">暂无指令</p>
                    <p className="text-[10px] text-jai-text-secondary mt-0.5">前往指令库添加</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Style bottom sheet */}
        {expandedStyleCategory && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setExpandedStyleCategory(null)}>
            <div className="bg-jai-card rounded-t-2xl w-full max-h-[60vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-jai-card px-4 py-3 border-b border-jai-card-border flex items-center justify-between">
                <span className="text-sm font-medium text-jai-text">
                  {expandedStyleCategory === 'tone' ? '剧集调性' : expandedStyleCategory === 'genre' ? '经典类型' : expandedStyleCategory === 'emotion' ? '情感浓度' : '叙事节奏'}
                </span>
                <button onClick={() => setExpandedStyleCategory(null)} className="p-1 text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>
              <div className="p-3 space-y-1">
                {Object.entries(STYLE_OPTIONS[expandedStyleCategory as 'tone' | 'genre' | 'emotion' | 'pace']).map(([key, desc]) => {
                  const currentVal = expandedStyleCategory === 'tone' ? styleTone : expandedStyleCategory === 'genre' ? styleGenre : expandedStyleCategory === 'emotion' ? styleEmotion : stylePace;
                  const setter = expandedStyleCategory === 'tone' ? setStyleTone : expandedStyleCategory === 'genre' ? setStyleGenre : expandedStyleCategory === 'emotion' ? setStyleEmotion : setStylePace;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (expandedStyleCategory === 'tone' && key === '混合模式') {
                          setter(key);
                          setShowMixModal(true);
                        } else {
                          setter(key);
                        }
                        setExpandedStyleCategory(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${currentVal === key ? 'bg-jai-muted border border-jai-accent' : 'hover:bg-jai-bg/50 border border-transparent'}`}
                    >
                      <span className={`text-sm ${currentVal === key ? 'text-jai-accent font-medium' : 'text-jai-text'}`}>{key}</span>
                      <span className="block text-xs text-jai-text-secondary mt-0.5 line-clamp-2">{desc}</span>
                    </button>
                  );
                })}
                {(expandedStyleCategory === 'tone' ? styleTone : expandedStyleCategory === 'genre' ? styleGenre : expandedStyleCategory === 'emotion' ? styleEmotion : stylePace) && (
                  <button
                    onClick={() => {
                      const setter = expandedStyleCategory === 'tone' ? setStyleTone : expandedStyleCategory === 'genre' ? setStyleGenre : expandedStyleCategory === 'emotion' ? setStyleEmotion : setStylePace;
                      setter('');
                      setExpandedStyleCategory(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-50 rounded-xl"
                  >清除选择</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Optional styles bottom sheet */}
        {showOptionalMenu && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setShowOptionalMenu(false)}>
            <div className="bg-jai-card rounded-t-2xl w-full max-h-[70vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-jai-card px-4 py-3 border-b border-jai-card-border flex items-center justify-between">
                <span className="text-sm font-medium text-jai-text">可选风格</span>
                <button onClick={() => setShowOptionalMenu(false)} className="p-1 text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>
              <div className="p-3 space-y-1">
                {Object.entries(STYLE_OPTIONS.optional).map(([key, desc]) => (
                  <label key={key} className="flex items-start gap-3 py-2.5 px-3 text-sm text-jai-text cursor-pointer hover:bg-jai-muted rounded-xl">
                    <input
                      type="checkbox"
                      checked={styleOptional.includes(key)}
                      onChange={e => {
                        if (e.target.checked) setStyleOptional(prev => [...prev, key]);
                        else setStyleOptional(prev => prev.filter(v => v !== key));
                      }}
                      className="rounded border-jai-accent text-jai-accent focus:ring-jai-accent mt-0.5 shrink-0 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium">{key}</span>
                      <span className="block text-xs text-jai-text-secondary mt-0.5">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mix Mode Modal */}
        {showMixModal && styleTone === '混合模式' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={() => setShowMixModal(false)}>
            <div className="bg-jai-card rounded-xl shadow-lg p-4 w-full max-w-80 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="text-sm font-medium text-jai-text">混合模式 - 请指定主基调</div>
              <div className="text-xs text-jai-text-secondary">例：电影质感为主，但保留剧集的慢热推进感。</div>
              <textarea
                value={mixModeNote}
                onChange={e => setMixModeNote(e.target.value)}
                placeholder="描述你想要的混合效果..."
                className="w-full text-xs border border-jai-card-border rounded-lg p-2 h-20 resize-none focus:outline-none focus:border-jai-accent"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMixModal(false)} className="text-xs px-3 py-1.5 rounded-lg bg-jai-secondary text-white hover:bg-jai-accent">确认</button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Feature Buttons */}
        <div className="hidden md:flex items-center gap-2 relative">
          <button onClick={handleInspiration} disabled={inspirationLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
            <IconSparkle className="w-3.5 h-3.5" /> 灵感
          </button>
          <button onClick={() => setShowExpandModal(true)} disabled={expandLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
            <IconPen className="w-3.5 h-3.5" /> 扩写
          </button>
          <button onClick={handleMemory} disabled={memoryLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
            <IconBrain className="w-3.5 h-3.5" /> 记忆
          </button>
          <button
            onClick={() => setShowPlotPanel(!showPlotPanel)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-muted transition-colors"
          >
            <IconPlot className="w-3.5 h-3.5" /> 剧情
          </button>
          <div className="relative" ref={instructionPickerRef}>
            <button
              onClick={() => {
                setInstructionList(getInstructionList());
                setShowInstructionPicker(!showInstructionPicker);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border transition-colors"
            >
              <IconBook className="w-3.5 h-3.5" /> 指令
            </button>
            {showInstructionPicker && instructionList.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 max-h-60 overflow-y-auto bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-1">
                {instructionList.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => {
                      setUserInput(prev => (prev ? prev + '\n' : '') + `【${inst.content}】`);
                      setShowInstructionPicker(false);
                      showNotification(`已插入「${inst.name}」`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-jai-muted transition-colors"
                  >
                    <p className="text-xs font-medium text-jai-text truncate">{inst.name}</p>
                    <p className="text-[10px] text-jai-text-secondary truncate">{inst.summary}</p>
                  </button>
                ))}
              </div>
            )}
            {showInstructionPicker && instructionList.length === 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-3 px-3">
                <p className="text-xs text-jai-text-secondary">暂无指令</p>
                <p className="text-[10px] text-jai-text-secondary mt-0.5">前往指令库添加</p>
              </div>
            )}
          </div>
        </div>

        {/* Input Row */}
        <div className="flex items-center gap-1.5">
          {/* Mobile toolbar toggle */}
          <button
            onClick={() => setShowMobileToolbar(!showMobileToolbar)}
            className={`md:hidden shrink-0 p-2 rounded-lg border transition-colors ${showMobileToolbar ? 'bg-jai-card-border border-jai-secondary text-jai-accent' : 'border-jai-card-border bg-jai-bg/50 text-jai-accent'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
          <input
            type="text"
            value={jaiInput}
            onChange={e => setJaiInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendBotMessage(); } }}
            placeholder="粘贴 Char 回复..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50/50 focus:border-blue-300 focus:outline-none placeholder:text-blue-300 min-w-0"
          />
          <button
            onClick={sendBotMessage}
            disabled={!jaiInput.trim()}
            className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0"
          >
            发送
          </button>
        </div>

        {/* User Chat Input */}
        <div className="flex items-end gap-2">
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); } }}
            placeholder="输入你的消息..."
            className="flex-1 text-sm p-2.5 md:p-3 rounded-xl border border-jai-card-border focus:border-jai-accent focus:outline-none resize-none min-h-[38px] md:min-h-[40px] max-h-[100px] md:max-h-[120px]"
            rows={1}
          />
          <button
            onClick={sendUserMessage}
            className="p-2.5 md:p-3 rounded-xl bg-jai-secondary text-white hover:bg-jai-accent transition-colors shrink-0"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-jai-text text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {notification}
        </div>
      )}
    </div>
  );
}

// ========== Instruction keyword detection ==========
const INSTRUCTION_KEYWORDS = [
  'Reader Barrage', 'Omniscient Barrage',
  'Small Theaters', 'Plot Diary', 'Alternate Universe', 'AU',
  'Reading Notes', 'Book title',
  "Friends' Circle", 'Friends Circle',
  'Weekly Schedule',
  'Now Playing',
  'System Note', 'System-Level',
  'Want to Do but Dare Not',
  'Random Event',
  'OOC',
  // Chinese keywords
  '读者弹幕', '上帝弹幕', '全知弹幕',
  '小剧场', '剧情日记', '平行宇宙',
  '阅读笔记', '书名', '性别代称',
  '朋友圈',
  '周程表', '周安排',
  '正在播放',
  '系统备注', '系统级',
  '想做但不敢',
  '随机事件',
  '出戏',
];

function isInstructionParagraph(text: string): boolean {
  const lower = text.toLowerCase();
  return INSTRUCTION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}
// ========== Message Bubble Component ==========
function MessageBubble({ message, onFlip, onEdit, onSaveEdit, onCancelEdit, onDelete, onCopy, onMarkAsInstruction }: {
  message: ChatMessage;
  onFlip: () => void;
  onEdit: () => void;
  onSaveEdit: (content: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onMarkAsInstruction: (selectedIndices: number[]) => void;
}) {
  const [editContent, setEditContent] = useState(message.content);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedParagraphs, setSelectedParagraphs] = useState<Set<number>>(new Set());
  const isUser = message.role === 'user';

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  // Parse content into sections
  const displayText = message.flipped && message.chineseTranslation ? message.chineseTranslation : message.content;
  const { main, instructions } = parseContentSections(displayText);

  // Split content into paragraphs for the picker
  const paragraphs = message.content.split(/\n\n+/).filter(p => p.trim());
  // Also split translation for display in picker
  const translationParagraphs = message.chineseTranslation ? message.chineseTranslation.split(/\n\n+/).filter(p => p.trim()) : [];

  const handleOpenPicker = () => {
    // Auto-select paragraphs that look like instructions
    const autoSelected = new Set<number>();
    paragraphs.forEach((p, idx) => {
      if (isInstructionParagraph(p)) {
        autoSelected.add(idx);
      }
      // Also keep paragraphs that are already wrapped in 【】
      if (p.trim().startsWith('【') && p.trim().endsWith('】')) {
        autoSelected.add(idx);
      }
    });
    setSelectedParagraphs(autoSelected);
    setShowPicker(true);
  };

  const handleConfirmPicker = () => {
    if (selectedParagraphs.size === 0) {
      setShowPicker(false);
      return;
    }
    // Rebuild content: wrap selected paragraphs in 【】, leave others as-is
    const rebuilt = paragraphs.map((p, idx) => {
      const clean = p.trim();
      // If already wrapped, keep or unwrap based on selection
      if (clean.startsWith('【') && clean.endsWith('】')) {
        const inner = clean.slice(1, -1);
        return selectedParagraphs.has(idx) ? p : inner;
      }
      return selectedParagraphs.has(idx) ? `【${clean}】` : p;
    }).join('\n\n');
    onMarkAsInstruction(Array.from(selectedParagraphs));
    onSaveEdit(rebuilt);
    setShowPicker(false);
  };

  const toggleParagraph = (idx: number) => {
    setSelectedParagraphs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Paragraph Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-jai-card-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-jai-accent flex items-center gap-1.5">
                  <IconBook className="w-4 h-4" /> 标记为指令
                </span>
                <button onClick={() => setShowPicker(false)} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>
              <p className="text-[11px] text-jai-text-secondary mt-1">选择要标记为指令的段落（已自动识别含指令关键词的段落）</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {paragraphs.map((p, idx) => {
                const isSelected = selectedParagraphs.has(idx);
                const isAuto = isInstructionParagraph(p);
                const preview = p.length > 120 ? p.slice(0, 120) + '...' : p;
                const translationPreview = translationParagraphs[idx]
                  ? (translationParagraphs[idx].length > 120 ? translationParagraphs[idx].slice(0, 120) + '...' : translationParagraphs[idx])
                  : null;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleParagraph(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-jai-accent bg-jai-muted'
                        : 'border-jai-card-border bg-jai-muted/50 hover:bg-jai-muted'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-jai-secondary bg-jai-secondary' : 'border-jai-card-border'
                      }`}>
                        {isSelected && <IconCheck className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-jai-text-secondary whitespace-pre-wrap break-words leading-relaxed">{preview}</p>
                        {translationPreview && (
                          <p className="text-xs text-jai-text whitespace-pre-wrap break-words leading-relaxed mt-0.5">{translationPreview}</p>
                        )}
                        {isAuto && !isSelected && (
                          <span className="inline-block mt-1 text-[9px] text-jai-secondary bg-jai-muted px-1 py-0.5 rounded">建议标记</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-jai-card-border flex items-center justify-between">
              <span className="text-[11px] text-jai-text-secondary">已选 {selectedParagraphs.size} / {paragraphs.length} 段</span>
              <div className="flex gap-2">
                <button onClick={() => setShowPicker(false)} className="px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-text hover:bg-jai-muted">取消</button>
                <button onClick={handleConfirmPicker} className="px-3 py-1.5 text-xs rounded-lg bg-jai-secondary text-white hover:bg-jai-accent disabled:opacity-50" disabled={selectedParagraphs.size === 0}>
                  确认标记
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl shadow-sm ${
        isUser
          ? 'bg-jai-bubble-user text-white rounded-br-sm'
          : 'bg-jai-bubble text-jai-text border border-jai-card-border rounded-bl-sm'
      }`}>
        {/* Role Label */}
        <div className={`px-3 pt-2 pb-0.5 text-[10px] font-medium ${isUser ? 'text-white/70' : 'text-jai-secondary'}`}>
          {isUser ? 'User' : 'Char'}
        </div>

        {/* Content */}
        <div className="px-3 pb-1">
          {message.editing ? (
            <div className="space-y-1.5">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className={`w-full text-sm p-2 rounded-lg border resize-none min-h-[60px] ${
                  isUser ? 'bg-jai-secondary/30 border-jai-accent text-white placeholder:text-jai-secondary/70' : 'bg-jai-muted border-jai-secondary text-jai-text'
                } focus:outline-none`}
                rows={3}
              />
              <div className="flex gap-1.5">
                <button onClick={() => onSaveEdit(editContent)} className="text-[10px] px-2 py-0.5 bg-jai-secondary text-white rounded">保存</button>
                <button onClick={onCancelEdit} className="text-[10px] px-2 py-0.5 bg-jai-muted text-jai-text rounded">取消</button>
              </div>
            </div>
          ) : (
            <>
              {/* Main content */}
              {main && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {main}
                </p>
              )}
              {/* Instruction blocks */}
              {instructions.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {instructions.map((inst, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-jai-secondary/30 text-jai-muted'
                          : 'bg-jai-muted/80 text-jai-text border border-jai-card-border/50'
                      }`}
                    >
                      <span className={`inline-block text-[9px] font-medium px-1 py-0.5 rounded mb-1 ${
                        isUser ? 'bg-jai-accent/30 text-jai-muted' : 'bg-jai-card-border text-jai-secondary'
                      }`}>
                        指令
                      </span>
                      <span className="ml-1">{inst}</span>
                      {message.chineseTranslation && !message.flipped && (() => {
                        const transParagraphs = message.chineseTranslation.split(/\n\n+/).filter(p => p.trim());
                        const transInst = transParagraphs.find(tp => {
                          const clean = tp.trim().replace(/^【|】$/g, '');
                          return clean.length > 0;
                        });
                        return transInst ? <span className="ml-1 text-jai-text-secondary text-[10px] block mt-0.5">{transInst.replace(/^【|】$/g, '')}</span> : null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
              {!main && instructions.length === 0 && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {displayText}
                </p>
              )}
              {message.translating && <span className="text-xs opacity-60 ml-1">翻译中...</span>}
            </>
          )}
        </div>

        {/* Action Buttons - always visible */}
        {!message.editing && (
          <div className={`flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 pb-1.5 md:pb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button onClick={onFlip} title="翻转" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-secondary/70 hover:text-white' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconFlip className="w-3 h-3" />
            </button>
            <button onClick={onCopy} title="复制" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-secondary/70 hover:text-white' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconCopy className="w-3 h-3" />
            </button>
            <button onClick={onEdit} title="编辑" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-secondary/70 hover:text-white' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconEdit className="w-3 h-3" />
            </button>
            <button onClick={handleOpenPicker} title="标记为指令" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-secondary/70 hover:text-white' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconBook className="w-3 h-3" />
            </button>
            <button onClick={onDelete} title="删除此条及之后" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-secondary/70 hover:text-red-300' : 'text-jai-text-secondary hover:text-red-400'}`}>
              <IconTrash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
