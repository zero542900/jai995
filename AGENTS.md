# JAI Assistant - 项目上下文

## 项目概览
JAI 辅助网页，用于生成 JanitorAI 角色 User 卡、管理预设和进行 AI 会话。

## 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **AI API**: DeepSeek API (用户自带 Key，localStorage 存储)
- **数据存储**: localStorage (预设、会话、API Key)

## 目录结构
```
src/
├── app/
│   ├── page.tsx              # 生成 User 面具（主页面）
│   ├── chat/page.tsx         # 会话页面
│   ├── presets/
│   │   ├── page.tsx          # 预设库列表
│   │   └── [id]/page.tsx     # 预设详情
│   ├── settings/page.tsx     # 设置（API Key）
│   └── api/
│       ├── generate/route.ts # 生成 User 卡
│       ├── chat/route.ts     # 会话聊天
│       ├── inspiration/route.ts # 灵感生成
│       ├── expand/route.ts   # 扩写功能
│       └── memory/route.ts   # 长期记忆生成
├── components/
│   ├── nav.tsx               # 导航（PC 侧边栏 + 手机底栏）
│   └── ui/                   # shadcn/ui 组件
├── lib/
│   ├── types.ts              # 类型定义
│   ├── storage.ts            # localStorage 存取工具
│   ├── deepseek.ts           # DeepSeek API 调用封装
│   └── utils.ts              # 通用工具 (cn)
```

## 构建和测试命令
- 开发: `pnpm dev`
- 构建: `pnpm build`
- 类型检查: `pnpm ts-check`
- 代码检查: `pnpm lint`
- 启动生产: `pnpm start`

## 核心数据结构
- **Preset**: 预设卡 (id, name, charInfo, userCard, userPersonality, plotDirection, longTermMemory)
- **Session**: 会话 (id, presetId, name, messages[], longTermMemory)
- **ChatMessage**: 消息 (id, role, content, thinking?, timestamp)

## AI 功能
- 所有 AI 调用通过 DeepSeek API，用户在设置页配置 API Key
- 流式输出 (SSE)：所有生成功能均使用流式响应
- 思考模式：使用 `deepseek-reasoner` 模型
- 普通模式：使用 `deepseek-chat` 模型

## 设计规范
- 粉色主题：低饱和度玫瑰灰，不累眼
- 详见 DESIGN.md
