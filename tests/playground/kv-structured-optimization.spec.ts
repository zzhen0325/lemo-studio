import { describe, expect, it } from 'vitest';

import { getShortcutById } from '@/config/playground-shortcuts';
import {
  assembleDesignStructuredShortcutPrompt,
  buildDesignSectionDetailSyncInstruction,
  buildDesignVariantEditUserInput,
  buildKvStructuredOptimizationInput,
  parseDesignStructuredOptimizationResponse,
  parseDesignStructuredVariantEditResponse,
} from '@/app/studio/playground/_lib/kv-structured-optimization';

describe('design structured optimization helpers', () => {
  it('builds optimization input from the original KV shortcut prompt', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const result = buildKvStructuredOptimizationInput(
      shortcut,
      {
        mainTitle: '#Biweeklybudget',
        subTitle: 'Tell us what you actually spend in 2 weeks with #biweeklybudget',
        eventTime: '8/1-8/31',
        heroSubject: 'oversized budget notebook and receipts cloud',
        style: '拼贴、插画',
        primaryColor: '#15BC55',
      },
      [],
    );

    expect(result).toContain('Create a US-EVENT KV');
    expect(result).toContain('main title "#Biweeklybudget');
    expect(result).toContain('event timing "8/1-8/31');
    expect(result).toContain('featuring hero subject "oversized budget notebook and receipts cloud');
    expect(result).toContain('#15BC55');
  });

  it('parses the new 5-section structured protocol for KV shortcuts', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "软木拼贴",
          "coreFields": {
            "mainTitle": "Cozy Chats",
            "subTitle": "Grab a blanket and spill the tea with #CozyChats",
            "eventTime": "12/2 - 12/31",
            "style": "趣味拼贴, Y2K复古, 公告板质感",
            "primaryColor": "#E7AE68"
          },
          "coreSuggestions": {
            "mainTitle": "",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": ""
          },
          "palette": [
            { "hex": "#E7AE68", "role": "base", "usage": "整体背景主色与软木板基底", "weight": "53.2%" },
            { "hex": "#884823", "role": "accent", "usage": "针织纹理底块与深棕文字", "weight": "" },
            { "hex": "#E5D5D1", "role": "support", "usage": "米白描边与辅助字体", "weight": "" }
          ],
          "analysis": {
            "canvas": {
              "tokens": ["16:9横幅", "趣味拼贴", "温暖生活感", "Y2K复古公告板"],
              "detailText": "整体色彩方案以占比53.2%的#E7AE68暖橙色作为基底，搭配#884823深棕色与#E5D5D1米白色。"
            },
            "subject": {
              "tokens": ["双少女贴纸角色", "白色剪贴描边", "开朗社交感"],
              "detailText": "左侧为深棕卷发红帽少女，右侧为浅金长发捧杯少女，二者都带有轻微投影。"
            },
            "background": {
              "tokens": ["软木板纹理", "深棕针织底块", "公告板小物件"],
              "detailText": "背景基础层为#E7AE68暖橙色软木板纹理，中间层铺有#884823深棕色针织纹理底块。"
            },
            "layout": {
              "tokens": ["居中对称构图", "时间气泡标签", "底部标语条"],
              "detailText": "视觉焦点为画面中心标题，右上为时间标签，底部为标语横幅。"
            },
            "typography": {
              "tokens": ["剪报字母标题", "手撕纸边", "轻微投影"],
              "detailText": "标题字母采用#E85988、亮黄与#E5D5D1的错位配色。"
            }
          },
          "promptPreview": "Cozy collage banner with #E7AE68 cork-board base, #884823 knit accents, clipped letter title and cheerful sticker portraits."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.mode).toBe('design_structured_variants_v1');
    expect(result.sourceType).toBe('kv_shortcut');
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].label).toBe('软木拼贴');
    expect(result.variants[0].palette[0]).toEqual({
      hex: '#E7AE68',
      weight: '53.2%',
    });
    expect(result.variants[0].analysis.canvas.tokens).toEqual([
      '16:9横幅',
      '趣味拼贴',
      '温暖生活感',
      'Y2K复古公告板',
    ]);
    expect(result.variants[0].analysis.typography.detailText).toContain('#E85988');
    expect(result.variants[1].id).toBe('v2');
  });

  it('parses image reverse variants with empty core fields and preserves prose colors', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "image_reverse",
      "variants": [
        {
          "id": "v1",
          "label": "预算手账",
          "coreFields": {
            "mainTitle": "",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": ""
          },
          "palette": [
            { "hex": "#09B548", "role": "base", "usage": "背景主色", "weight": "" }
          ],
          "analysis": {
            "canvas": {
              "tokens": ["竖版海报", "拼贴风", "美式复古手账"],
              "detailText": "主要使用#09B548作为背景主色，辅以#EFC5BC描边色、#A8C8E6预算单底色和#9D7654钱包棕色。"
            },
            "subject": {
              "tokens": ["欢乐女性主体", "亮黄色猫眼墨镜", "预算单据", "棕色钱包"],
              "detailText": "人物带有#EFC5BC外描边和浅黄绿色第二层外描边，悬浮感十足。"
            },
            "background": {
              "tokens": ["褶皱白纸基底", "绿色下半背景", "收据水印"],
              "detailText": "下半部分是大面积#09B548绿色背景，并有浅绿星形装饰图案。"
            },
            "layout": {
              "tokens": ["中心聚焦", "顶部标题", "底部便签文案"],
              "detailText": "顶部是粗黑无衬线标题，中心是人物主体，底部是四行错落提示文字。"
            },
            "typography": {
              "tokens": ["粗黑无衬线字体", "撕边便签底色"],
              "detailText": "时间便签与底部文字条都用高对比色块承载黑色字体。"
            }
          },
          "promptPreview": "Vertical scrapbook poster with #09B548 base, #EFC5BC sticker outline, #A8C8E6 budget sheet, bold black headline and playful ripped-paper notes."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.sourceType).toBe('image_reverse');
    expect(result.variants[0].coreFields.mainTitle).toBe('');
    expect(result.variants[0].analysis.canvas.detailText).toContain('#09B548');
    expect(result.variants[0].palette.map((entry) => entry.hex)).toEqual(
      expect.arrayContaining(['#09B548', '#EFC5BC', '#A8C8E6', '#9D7654']),
    );
  });

  it('derives palette from analysis and prompt preview when API omits palette', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "自然派海报",
          "coreFields": {
            "mainTitle": "Fresh Finds",
            "subTitle": "Soft greens for spring",
            "eventTime": "03/01 - 03/15",
            "style": "清新拼贴",
            "primaryColor": "#A4B97E"
          },
          "coreSuggestions": {
            "mainTitle": "",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": ""
          },
          "analysis": {
            "canvas": {
              "tokens": ["春日浅绿基调", "柔和留白"],
              "detailText": "整体以#A4B97E为主色，辅以#CBD4A0和#F5E3C8形成柔和层次。"
            },
            "subject": {
              "tokens": ["花束主体", "纸张拼贴"],
              "detailText": "主体边缘点缀少量#CBD4A0高光。"
            },
            "background": {
              "tokens": ["奶油纸底", "浅米色衬底"],
              "detailText": "背景底部是#F5E3C8大色块。"
            },
            "layout": {
              "tokens": ["上下分区", "标题居中"],
              "detailText": ""
            },
            "typography": {
              "tokens": ["轻复古无衬线"],
              "detailText": ""
            }
          },
          "promptPreview": "Fresh spring poster with #A4B97E color fields, #CBD4A0 highlights, and a #F5E3C8 paper base."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].palette).toEqual([
      { hex: '#A4B97E', weight: '33.3%' },
      { hex: '#CBD4A0', weight: '33.3%' },
      { hex: '#F5E3C8', weight: '33.4%' },
    ]);
  });

  it('parses the lightweight 2-variant format and rebuilds prompt preview from analysis only', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "日常消费场景拼贴风",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴",
            "primaryColor": "#15BC55"
          },
          "coreSuggestions": {
            "mainTitle": "保留原有 hashtag 格式，放大字号突出核心话题",
            "subTitle": "搭配消费小票、硬币等装饰元素环绕排版，增强活动场景关联",
            "eventTime": "放在主视觉右下角，用标签形式承载，清晰醒目",
            "style": "美式复古拼贴，混合纸质剪裁、实物扫描、手绘涂鸦多种材质质感",
            "primaryColor": "#15BC55作为主色，搭配奶白、浅橙、炭黑作为辅助色，明快有活力"
          },
          "analysis": {
            "canvas": {
              "tokens": ["美式复古拼贴", "高饱和明快", "纸质肌理", "生活化氛围感"],
              "detailText": "整体为美式日常向拼贴风格KV，主色使用#15BC55的亮绿色，搭配奶白色基底、浅橙点缀色、炭黑文字色。"
            },
            "subject": {
              "tokens": ["半开钱包主体", "消费小票拼贴", "小额硬币散落", "手绘支出图标"],
              "detailText": "核心主体是位于画面中上部的剪裁感半开真皮钱包，钱包开口处向外散落消费小票和硬币。"
            },
            "background": {
              "tokens": ["奶白基底", "方格纹底层", "撕边彩纸点缀", "浅绿投影层"],
              "detailText": "最底层是奶白色带细格纹的卡纸基底，最上层叠加#15BC55的半透明软投影。"
            },
            "layout": {
              "tokens": ["上主体下信息", "居中对齐", "标签式时间", "元素环绕标题"],
              "detailText": "主标题#Biweeklybudget放在主体正下方居中位置，活动时间8/1-8/31放在画面右下角。"
            },
            "typography": {
              "tokens": ["粗体无衬线", "手写体副标题", "标签体时间", "层级清晰"],
              "detailText": "主标题使用粗宽无衬线字体，填充#15BC55亮绿色；副标题和活动时间为次级信息层。"
            }
          }
        },
        {
          "id": "v2",
          "label": "数据可视化拼贴风",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴",
            "primaryColor": "#15BC55"
          },
          "coreSuggestions": {
            "mainTitle": "和条形图主体融合，强化数据统计的主题属性",
            "subTitle": "放在图表侧边，搭配色块标注增强可读性",
            "eventTime": "放在图表顶部左侧，用日历剪片形式呈现，贴合活动周期",
            "style": "现代数据拼贴，混合图表剪片、荧光材质、杂志字体、几何色块",
            "primaryColor": "#15BC55作为数据主色，搭配荧光橙、浅灰、纯白作为辅助色，专业有活力"
          },
          "analysis": {
            "canvas": {
              "tokens": ["现代数据拼贴", "高对比色彩", "荧光肌理", "社交传播感"],
              "detailText": "整体为美式现代数据向拼贴风格KV，主色使用#15BC55的亮绿色，搭配纯白基底、荧光橙点缀色、深灰文字色。"
            },
            "subject": {
              "tokens": ["双周预算条形图", "彩色数据块", "荧光便签标注", "美元符号装饰"],
              "detailText": "核心主体是位于画面左侧的剪裁感彩色条形图，所有辅助元素都围绕条形图展开。"
            },
            "background": {
              "tokens": ["纯白基底", "网格线层", "几何色块托底", "半透明投影"],
              "detailText": "最底层是纯白色带浅灰色细网格线的卡纸基底。"
            },
            "layout": {
              "tokens": ["左主体右信息", "左右分区", "日历式时间", "标题融合数据"],
              "detailText": "主标题#Biweeklybudget放在条形图顶部，活动时间8/1-8/31放在画面左上角。"
            },
            "typography": {
              "tokens": ["杂志粗体标题", "无衬线副标题", "日历体时间", "层级明确"],
              "detailText": "主标题使用美式杂志常用的粗宽无衬线字体，白色字叠加在#15BC55的绿色数据条上。"
            }
          }
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].id).toBe('v1');
    expect(result.variants[1].id).toBe('v2');
    expect(result.variants[0].promptPreview).toContain('主标题#Biweeklybudget放在主体正下方居中位置');
    expect(result.variants[1].promptPreview).toContain('主标题#Biweeklybudget放在条形图顶部');
    expect(result.variants[0].promptPreview).not.toContain('main title "#Biweeklybudget"');
    expect(result.variants[0].promptPreview).not.toContain('supporting title "Tell us what you actually spend in 2 weeks with #biweeklybudget"');
    expect(result.variants[0].promptPreview).not.toContain('event timing "8/1-8/31"');
  });

  it('parses a single variant edit response and preserves prompt preview', () => {
    const raw = `{
      "mode": "design_structured_variant_edit_v1",
      "variant": {
        "id": "v2",
        "label": "桌面账本",
        "coreFields": {
          "mainTitle": "#Biweeklybudget",
          "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
          "eventTime": "8/1-8/31",
          "style": "拼贴、插画",
          "primaryColor": "#15BC55"
        },
        "coreSuggestions": {
          "mainTitle": "",
          "subTitle": "",
          "eventTime": "",
          "style": "",
          "primaryColor": ""
        },
        "palette": [
          { "hex": "#15BC55", "role": "base", "usage": "主标题高亮", "weight": "" }
        ],
        "analysis": {
          "canvas": { "tokens": ["手账桌面", "绿色主导"], "detailText": "整体像一张摊开的桌面预算手账海报。" },
          "subject": { "tokens": ["夸张账本主体", "收据云团"], "detailText": "主体是一册夸张放大的双周预算账本，周围收据像云团一样环绕。" },
          "background": { "tokens": ["木桌背景", "便签层"], "detailText": "背景以浅木纹桌面和便签层搭出真实空间。" },
          "layout": { "tokens": ["标题压在主体上方"], "detailText": "主标题压在主体上方，副标题沿着账本下缘展开。" },
          "typography": { "tokens": ["粗黑标题", "便签副标题"], "detailText": "标题是厚重黑体，副标题像便签贴纸。" }
        },
        "promptPreview": "A playful budget poster built around an oversized biweekly ledger as the hero subject, with receipt clouds, sticky-note subtitle blocks, and a strong #15BC55 title treatment."
      }
    }`;

    const result = parseDesignStructuredVariantEditResponse(raw);

    expect(result.mode).toBe('design_structured_variant_edit_v1');
    expect(result.variant.id).toBe('v2');
    expect(result.variant.analysis.subject.detailText).toContain('夸张放大的双周预算账本');
    expect(result.variant.promptPreview).toContain('hero subject');
  });

  it('preserves Chinese quotation marks inside JSON strings', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "手账撕贴风",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴",
            "primaryColor": "#1BDA3B"
          },
          "coreSuggestions": {
            "mainTitle": "#BiweeklyBudget",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": "#1BDA3B"
          },
          "analysis": {
            "canvas": { "tokens": ["竖版KV"], "detailText": "整体以#1BDA3B为主色。" },
            "subject": { "tokens": ["开心女生"], "detailText": "主体带有#1BDA3B描边。" },
            "background": { "tokens": ["活页本基底"], "detailText": "" },
            "layout": { "tokens": ["中心聚焦"], "detailText": "" },
            "typography": { "tokens": ["粗黑无衬线"], "detailText": "" }
          },
          "promptPreview": "顶部区域放置第一视觉重点的加粗黑色无衬线主标题“#Biweeklybudget”，右上角用浅粉撕边便签承载活动时间“8/1-8/31”，底部区域放置副标题“Tell us what you actually spend in 2 weeks with #biweeklybudget”。"
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].promptPreview).toContain('“#Biweeklybudget”');
    expect(result.variants[0].promptPreview).toContain('“8/1-8/31”');
  });

  it('repairs unescaped straight quotes inside JSON string values', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "手账撕贴风",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴",
            "primaryColor": "#1BDA3B"
          },
          "coreSuggestions": {
            "mainTitle": "#BiweeklyBudget",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": "#1BDA3B"
          },
          "analysis": {
            "canvas": { "tokens": ["竖版KV"], "detailText": "整体以#1BDA3B为主色。" },
            "subject": { "tokens": ["开心女生"], "detailText": "主体带有#1BDA3B描边。" },
            "background": { "tokens": ["活页本基底"], "detailText": "" },
            "layout": { "tokens": ["中心聚焦"], "detailText": "" },
            "typography": { "tokens": ["粗黑无衬线"], "detailText": "" }
          },
          "promptPreview": "顶部区域放置第一视觉重点的加粗黑色无衬线主标题 "#Biweeklybudget"，右上角承载活动时间 "8/1-8/31"，底部区域放置副标题 "Tell us what you actually spend in 2 weeks with #biweeklybudget"。"
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].promptPreview).toContain('"#Biweeklybudget"');
    expect(result.variants[0].promptPreview).toContain('"8/1-8/31"');
  });

  it('repairs quoted field names followed by commas inside prose strings', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "字段引号",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴",
            "primaryColor": "#1BDA3B"
          },
          "analysis": {
            "canvas": { "tokens": ["竖版KV"], "detailText": "整体以#1BDA3B为主色。" },
            "subject": { "tokens": ["开心女生"], "detailText": "主体带有#1BDA3B描边。" },
            "background": { "tokens": ["活页本基底"], "detailText": "" },
            "layout": {
              "tokens": ["中心聚焦"],
              "detailText": "把 "mainTitle", "subTitle", and "eventTime" 围绕主体排布，确保主标题仍是第一视觉层。"
            },
            "typography": { "tokens": ["粗黑无衬线"], "detailText": "" }
          },
          "promptPreview": "Place "mainTitle", "subTitle", and "eventTime" around the hero while keeping a strong #1BDA3B title block."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].analysis.layout.detailText).toContain('"mainTitle", "subTitle", and "eventTime"');
    expect(result.variants[0].promptPreview).toContain('"mainTitle", "subTitle", and "eventTime"');
  });

  it('repairs fullwidth JSON punctuation and curly quotes from model output', () => {
    const raw = `{
      “mode”： “design_structured_variants_v1”，
      “sourceType”： “kv_shortcut”，
      “variants”： [
        {
          “id”： “v1”，
          “label”： “全角标点”，
          “coreFields”： {
            “mainTitle”： “Fresh Finds”，
            “subTitle”： “Soft greens for spring”，
            “eventTime”： “03/01 - 03/15”，
            “style”： “清新拼贴”，
            “primaryColor”： “#A4B97E”
          }，
          “analysis”： {
            canvas： { tokens： [“春日浅绿基调”, “柔和留白”], detailText： “整体以#A4B97E为主色，辅以#CBD4A0和#F5E3C8。” }，
            subject： { tokens： [“花束主体”], detailText： “主体边缘点缀少量#CBD4A0高光。” }，
            background： { tokens： [“奶油纸底”], detailText： “背景底部是#F5E3C8大色块。” }，
            layout： { tokens： [“上下分区”, “标题居中”], detailText： “” }，
            typography： { tokens： [“轻复古无衬线”], detailText： “” }
          }
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.sourceType).toBe('kv_shortcut');
    expect(result.variants[0].label).toBe('全角标点');
    expect(result.variants[0].analysis.canvas.tokens).toEqual(['春日浅绿基调', '柔和留白']);
    expect(result.variants[0].palette.map((entry) => entry.hex)).toEqual(
      expect.arrayContaining(['#A4B97E', '#CBD4A0', '#F5E3C8']),
    );
  });

  it('repairs single-quoted object-literal responses with bare keys', () => {
    const raw = `{
      mode: 'design_structured_variants_v1',
      sourceType: 'image_reverse',
      variants: [
        {
          id: 'v1',
          label: '单引号输出',
          analysis: {
            canvas: { tokens: ['绿色主导', '米白纸张'], detailText: '整体以#15BC55为主色，搭配#E5D5D1米白色纸张背景。' },
            subject: { tokens: ['预算账本'], detailText: '主体带有#15BC55描边。' },
            background: { tokens: ['便签层'], detailText: '' },
            layout: { tokens: ['中心标题'], detailText: '标题位于主体正下方。' },
            typography: { tokens: ['粗黑标题'], detailText: '主标题使用粗黑无衬线字体。' }
          },
          promptPreview: 'A playful budget collage with #15BC55 title treatment and #E5D5D1 paper texture.'
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.sourceType).toBe('image_reverse');
    expect(result.variants[0].label).toBe('单引号输出');
    expect(result.variants[0].analysis.layout.detailText).toContain('标题位于主体正下方');
    expect(result.variants[0].palette).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hex: '#15BC55' }),
        expect.objectContaining({ hex: '#E5D5D1' }),
      ]),
    );
  });

  it('normalizes legacy advanced/layoutTypography responses into layout and typography', () => {
    const raw = `
    {
      "mode": "kv_structured_variants_v1",
      "variants": {
        "v1": {
          "label": "贴纸拼贴",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴、插画",
            "primaryColor": "#15BC55"
          },
          "advanced": {
            "canvas": "playful collage, soft beige paper, green-led palette",
            "subject": "receipts\\nshopping bag\\nburger sticker",
            "background": ["kraft paper base", "light doodles"],
            "layoutTypography": "centered headline; sticker date tag; bold rounded sans serif"
          },
          "promptPreview": "preview-1 with #15BC55"
        }
      }
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.sourceType).toBe('kv_shortcut');
    expect(result.variants[0].analysis.canvas.tokens).toEqual([
      'playful collage',
      'soft beige paper',
      'green-led palette',
    ]);
    expect(result.variants[0].analysis.subject.tokens).toEqual([
      'receipts',
      'shopping bag',
      'burger sticker',
    ]);
    expect(result.variants[0].analysis.layout.tokens).toEqual(
      expect.arrayContaining(['centered headline', 'sticker date tag']),
    );
    expect(result.variants[0].analysis.typography.tokens).toEqual(
      expect.arrayContaining(['centered headline', 'bold rounded sans serif']),
    );
  });

  it('backfills palette hex values mentioned only in prose', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "image_reverse",
      "variants": [
        {
          "id": "v1",
          "label": "色彩回填",
          "palette": [
            { "hex": "#E7AE68", "role": "base", "usage": "背景主色", "weight": "53.2%" }
          ],
          "analysis": {
            "canvas": {
              "tokens": ["16:9横幅"],
              "detailText": "整体以#E7AE68为基底，搭配#884823深棕色、#E5D5D1米白色与#E85988亮粉色。"
            },
            "subject": { "tokens": [], "detailText": "" },
            "background": { "tokens": [], "detailText": "" },
            "layout": { "tokens": [], "detailText": "" },
            "typography": { "tokens": [], "detailText": "" }
          },
          "promptPreview": "Warm collage with #E7AE68, #884823, #E5D5D1 and #E85988 accents."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].palette).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hex: '#E7AE68', weight: '53.2%' }),
        expect.objectContaining({ hex: '#884823' }),
        expect.objectContaining({ hex: '#E5D5D1' }),
        expect.objectContaining({ hex: '#E85988' }),
      ]),
    );
  });

  it('derives palette when API response contains no palette field', () => {
    const raw = `{
      "mode": "design_structured_variants_v1",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "纯文本颜色",
          "coreFields": {
            "mainTitle": "#Biweeklybudget",
            "subTitle": "Tell us what you actually spend in 2 weeks with #biweeklybudget",
            "eventTime": "8/1-8/31",
            "style": "拼贴、插画",
            "primaryColor": "#15BC55"
          },
          "coreSuggestions": {
            "mainTitle": "",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": ""
          },
          "analysis": {
            "canvas": {
              "tokens": ["绿色主导", "米白纸张"],
              "detailText": "整体以占比53.2%的#15BC55为主色，搭配#E5D5D1米白色纸张背景。"
            },
            "subject": { "tokens": ["预算账本"], "detailText": "" },
            "background": { "tokens": ["便签层"], "detailText": "" },
            "layout": { "tokens": ["中心标题"], "detailText": "" },
            "typography": { "tokens": ["粗黑标题"], "detailText": "" }
          },
          "promptPreview": "A playful budget collage with #15BC55 title treatment and #E5D5D1 paper texture."
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.variants[0].palette).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hex: '#15BC55', weight: '53.2%' }),
        expect.objectContaining({ hex: '#E5D5D1' }),
      ]),
    );
  });

  it('assembles a deterministic prompt from analysis only', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const result = assembleDesignStructuredShortcutPrompt(
      shortcut,
      {
        mainTitle: '#Biweeklybudget',
        subTitle: 'Tell us what you actually spend in 2 weeks with #biweeklybudget',
        eventTime: '8/1-8/31',
        heroSubject: 'oversized budget notebook and receipts cloud',
        style: '拼贴、插画',
        primaryColor: '#15BC55',
      },
      [],
      {
        canvas: {
          tokens: ['playful collage', 'beige kraft texture'],
          detailText: '整体以#15BC55为主色，结合暖米色纸张背景。',
        },
        subject: {
          tokens: ['receipts', 'shopping bag'],
          detailText: '',
        },
        background: {
          tokens: ['doodle icons', 'soft paper grain'],
          detailText: '',
        },
        layout: {
          tokens: ['centered title block', 'sticker date tag'],
          detailText: '',
        },
        typography: {
          tokens: ['bold rounded sans serif'],
          detailText: '标题保留醒目的圆角无衬线风格。',
        },
      },
      [
        { hex: '#15BC55', weight: '' },
      ],
    );

    expect(result).toContain('canvas: playful collage, beige kraft texture');
    expect(result).toContain('layout: centered title block, sticker date tag');
    expect(result).toContain('标题保留醒目的圆角无衬线风格');
    expect(result).not.toContain('main title "#Biweeklybudget"');
    expect(result).not.toContain('supporting title "Tell us what you actually spend in 2 weeks with #biweeklybudget"');
    expect(result).not.toContain('event timing "8/1-8/31"');
    expect(result).not.toContain('primary color #15BC55');
    expect(result).not.toContain('Create a US-EVENT KV');
    expect(result).not.toContain('color palette:');
  });

  it('still throws when the response has no usable variant content', () => {
    expect(() => parseDesignStructuredOptimizationResponse('{}')).toThrow(
      /did not contain any usable variants/i,
    );
  });

  it('does not include palette when building variant edit user input', () => {
    const payload = JSON.parse(buildDesignVariantEditUserInput({
      instruction: '把主体改得更有故事性',
      scope: 'variant',
      variant: {
        id: 'v1',
        label: '自然派海报',
        coreFields: {
          mainTitle: 'Fresh Finds',
          subTitle: 'Soft greens for spring',
          eventTime: '03/01 - 03/15',
          style: '清新拼贴',
          primaryColor: '#A4B97E',
        },
        coreSuggestions: {
          mainTitle: '',
          subTitle: '',
          eventTime: '',
          style: '',
          primaryColor: '',
        },
        palette: [
          { hex: '#A4B97E', weight: '60%' },
        ],
        analysis: {
          canvas: { tokens: ['春日浅绿基调'], detailText: '整体以#A4B97E为主色。' },
          subject: { tokens: ['花束主体'], detailText: '' },
          background: { tokens: ['奶油纸底'], detailText: '' },
          layout: { tokens: ['标题居中'], detailText: '' },
          typography: { tokens: ['轻复古无衬线'], detailText: '' },
        },
        promptPreview: 'Fresh spring poster with #A4B97E color fields.',
      },
      context: {
        shortcutId: 'us-kv',
        shortcutPrompt: 'Create a US-EVENT KV...',
        market: 'US',
      },
    }));

    expect(payload.currentVariant.palette).toBeUndefined();
    expect(payload.currentVariant.analysis.canvas.detailText).toContain('#A4B97E');
  });

  it('builds a section detail sync instruction from edited tokens and the original detail text', () => {
    const instruction = buildDesignSectionDetailSyncInstruction({
      sectionKey: 'subject',
      section: {
        tokens: ['超大账本主体', '收据云团', '桌面故事感'],
        detailText: '主体是一册夸张放大的双周预算账本，周围收据像云团一样环绕。',
      },
    });

    expect(instruction).toContain('请只更新 subject section 的 detailText');
    expect(instruction).toContain('["超大账本主体","收据云团","桌面故事感"]');
    expect(instruction).toContain('主体是一册夸张放大的双周预算账本');
    expect(instruction).toContain('严格保留当前 tokens 原样不变');
  });
});
