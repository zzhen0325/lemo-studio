import type { BannerModelId, BannerTemplateConfig } from '@/lib/playground/types';

export const BANNER_ALLOWED_MODELS: BannerModelId[] = [
  'flux_klein',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
];

export const DEFAULT_BANNER_TEMPLATE_ID = 'banner-ramadhan-v1';

export const BANNER_TEMPLATES: BannerTemplateConfig[] = [
  {
    id: 'banner-ramadhan-v1',
    name: 'Ramadhan 海报',
    thumbnailUrl: '/images/1080X1440.png',
    baseImageUrl: '/images/1080X1440.png',
    width: 1080,
    height: 1440,
    defaultModel: 'flux_klein',
    allowedModels: BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Berkahnya Ramadhan',
      subTitle: 'Bagikan postingan Ramadhan dan menangkan Hadiah Eksklusif senilai 4.5 juta!',
      timeText: '11 24 Mar',
      extraDesc: '保留绿色节庆海报风格，主标题高对比醒目，整体排版层次清晰。',
    },
    promptTemplate: [
      '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
      '将主标题“{{originalMainTitle}}”修改为“{{mainTitle}}”。',
      '将主标题下方的“{{originalSubTitle}}”修改为“{{subTitle}}”。',
      '将时间“{{originalTimeText}}”修改为“{{timeText}}”。',
      '补充描述：{{extraDesc}}',
      '要求：',
      '1. 输出中不要保留任何标注框、标注编号或辅助线。',
      '2. 文字排版具有设计感，主标题更醒目，Subheadline作为辅助信息。',
      '3. 视觉风格统一，具备商业 Banner 质感。',
    ].join('\n'),
  },
  {
    id: 'banner-neon-v1',
    name: 'Neon 光效 Banner',
    thumbnailUrl: '/images/3334.png',
    baseImageUrl: '/images/3334.png',
    width: 1440,
    height: 900,
    defaultModel: 'flux_klein',
    allowedModels: BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Merry Christmas',
      subTitle: 'lalallalala',
      timeText: 'Dec 24 - Dec 31',
      extraDesc: '整体色调改为绿色调，主色为 #4BD460',
    },
    promptTemplate: [
      '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
      '将主标题“{{originalMainTitle}}”修改为“{{mainTitle}}”。',
      '将副标题“{{originalSubTitle}}”修改为“{{subTitle}}”。',
      '将时间“{{originalTimeText}}”修改为“{{timeText}}”。',
      '补充描述：{{extraDesc}}',
      '要求：',
      '1. 输出中不要保留任何标注框、标注编号或辅助线。',
      '2. 文字排版自然，主标题更醒目，副标题作为辅助信息。',
      '3. 视觉风格统一，具备商业 Banner 质感。',
    ].join('\n'),
  },
  {
    id: 'banner-neon-v2',
    name: 'Neon 光效 Banner 2',
    thumbnailUrl: '/images/3335.png',
    baseImageUrl: '/images/3335.png',
    width: 1440,
    height: 900,
    defaultModel: 'flux_klein',
    allowedModels: BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Future Drops',
      subTitle: 'Launch your spring campaign in one click',
      timeText: 'Apr 12 - Apr 30',
      extraDesc: '氛围偏科技感，增加层次化高光与柔和阴影。',
    },
    promptTemplate: [
      '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
      '将主标题“{{originalMainTitle}}”修改为“{{mainTitle}}”。',
      '将副标题“{{originalSubTitle}}”修改为“{{subTitle}}”。',
      '将时间“{{originalTimeText}}”修改为“{{timeText}}”。',
      '补充描述：{{extraDesc}}',
      '要求：',
      '1. 输出中不要保留任何标注框、标注编号或辅助线。',
      '2. 文字排版自然，主标题更醒目，副标题作为辅助信息。',
      '3. 视觉风格统一，具备商业 Banner 质感。',
    ].join('\n'),
  },
];

export function getBannerTemplateById(templateId?: string): BannerTemplateConfig | undefined {
  const resolvedId = templateId || DEFAULT_BANNER_TEMPLATE_ID;
  return (
    BANNER_TEMPLATES.find((template) => template.id === resolvedId)
    || BANNER_TEMPLATES.find((template) => template.id === DEFAULT_BANNER_TEMPLATE_ID)
    || BANNER_TEMPLATES[0]
  );
}
