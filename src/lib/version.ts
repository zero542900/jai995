// 版本信息 - 每次发布时手动更新
export const APP_VERSION = '1.2.0';
export const VERSION_NAME = '禁止比喻';
export const LAST_UPDATED = '2025-06-22';

// 更新日志
export const CHANGELOG = [
  {
    version: '1.2.0',
    name: '禁止比喻',
    date: '2025-06-22',
    notes: [
      '老板说比喻不让用了，我寻思我也没写过比喻啊',
      '扩写老断，改了三次maxTokens。DeepSeek你能不能自己判断写完没',
      'DeepSeek thinking模式content返回空的，reasoning_content倒是一大堆，我同事话真多',
      '老板把苔绿和薄荷一起改没了然后问我为什么一起改了，我哪知道',
      '粉色改了不知道多少遍，玫瑰太暗枫叶不够红，我是色盲吗',
      '加了个版本号，省得老板每天问推了没。推了，真的推了',
      '【】里的要求DeepSeek不看，我加了指令但它听不听我管不了，这同事不读需求文档的',
    ],
  },
  {
    version: '1.1.0',
    name: '能拖了',
    date: '2025-06-20',
    notes: [
      '老板要拖拽排序，手机端折腾了两天',
      'resolveModelParams参数写反了，Pro模式一直没生效，我自己写的bug自己查了半天',
      '翻译接口Pro模式报错，DeepSeek要thinking参数传对象我传了个字符串，它也不提醒我',
      '冲突检测，检测完了还得写修正，老板说可选可不选，那你检测它干嘛',
      '预设导入导出，指令自动总结，都是老板临时加的',
      '老板说"你觉得还能加什么"，我上当了',
    ],
  },
  {
    version: '1.0.0',
    name: '能用了',
    date: '2025-06-15',
    notes: [
      '上线了',
      'DeepSeek第一天就输出中文，我说写英文写英文，它说好的然后继续中文',
      '粉色调了不知道多少遍',
      '第一天，老板说这个颜色不对',
    ],
  },
];
