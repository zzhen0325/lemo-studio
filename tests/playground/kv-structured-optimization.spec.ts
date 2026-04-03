import { describe, expect, it } from 'vitest';

import { getShortcutById } from '@/config/moodboard-cards';
import {
  assembleDesignStructuredShortcutPrompt,
  buildDesignSectionEditUserInput,
  buildDesignVariantEditUserInput,
  buildKvStructuredOptimizationInput,
  parseDesignSectionEditResponse,
  parseDesignStructuredOptimizationResponse,
  parseDesignStructuredVariantEditResponse,
} from '@/app/studio/playground/_lib/kv-structured-optimization';

describe('design structured optimization helpers (v2)', () => {
  it('builds optimization input from KV shortcut prompt', () => {
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
    expect(result).toContain('#15BC55');
  });

  it('parses v2 structured variants without tokens and pads to four variants', () => {
    const raw = `{
      "mode": "design_structured_variants_v2",
      "sourceType": "kv_shortcut",
      "variants": [
        {
          "id": "v1",
          "label": "软木拼贴",
          "coreFields": {
            "mainTitle": "Cozy Chats",
            "subTitle": "Grab a blanket and spill the tea",
            "eventTime": "12/2 - 12/31",
            "style": "趣味拼贴",
            "primaryColor": "#E7AE68"
          },
          "coreSuggestions": {
            "mainTitle": "",
            "subTitle": "",
            "eventTime": "",
            "style": "",
            "primaryColor": ""
          },
          "analysis": {
            "canvas": { "detailText": "整体以#E7AE68为底色，叠加#884823与#E5D5D1。" },
            "subject": { "detailText": "双少女贴纸角色作为主视觉。" },
            "background": { "detailText": "软木板纹理+针织底块。" },
            "layout": { "detailText": "主标题居中，时间标签在右上。" },
            "typography": { "detailText": "剪报字母标题，带轻微投影。" }
          }
        }
      ]
    }`;

    const result = parseDesignStructuredOptimizationResponse(raw);

    expect(result.mode).toBe('design_structured_variants_v2');
    expect(result.sourceType).toBe('kv_shortcut');
    expect(result.variants).toHaveLength(4);
    expect(result.variants[0].label).toBe('软木拼贴');
    expect(result.variants[0].analysis.canvas.detailText).toContain('#E7AE68');
    expect(result.variants[0].analysis.layout).not.toHaveProperty('tokens');
    expect(result.variants[0].palette.map((entry) => entry.hex)).toEqual(
      expect.arrayContaining(['#E7AE68', '#884823', '#E5D5D1']),
    );
  });

  it('parses v2 variant edit response and keeps detailText-only analysis', () => {
    const raw = `{
      "mode": "design_structured_variant_edit_v2",
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
        "analysis": {
          "canvas": { "detailText": "整体像一张摊开的桌面预算手账海报。" },
          "subject": { "detailText": "主体是一册夸张放大的双周预算账本。" },
          "background": { "detailText": "背景以浅木纹桌面和便签层搭出真实空间。" },
          "layout": { "detailText": "主标题压在主体上方，副标题沿账本下缘展开。" },
          "typography": { "detailText": "标题是厚重黑体，副标题像便签贴纸。" }
        },
        "promptPreview": "A playful budget poster with an oversized ledger and strong #15BC55 title treatment."
      }
    }`;

    const result = parseDesignStructuredVariantEditResponse(raw);

    expect(result.mode).toBe('design_structured_variant_edit_v2');
    expect(result.variant.id).toBe('v2');
    expect(result.variant.analysis.subject.detailText).toContain('夸张放大的双周预算账本');
    expect(result.variant.analysis.subject).not.toHaveProperty('tokens');
  });

  it('parses section edit response and validates required fields', () => {
    const raw = `{
      "mode": "design_structured_section_edit_v2",
      "sectionKey": "layout",
      "detailText": "主标题收束在视觉中心，副标题贴近主体边缘形成二级层级。"
    }`;

    const result = parseDesignSectionEditResponse(raw);
    expect(result.mode).toBe('design_structured_section_edit_v2');
    expect(result.sectionKey).toBe('layout');
    expect(result.detailText).toContain('主标题收束在视觉中心');

    expect(() => parseDesignSectionEditResponse(`{
      "mode": "design_structured_section_edit_v2",
      "sectionKey": "layout",
      "detailText": ""
    }`)).toThrow(/missing detailText/i);
  });

  it('assembles prompt from detailText only', () => {
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
        canvas: { detailText: '整体以#15BC55为主色，结合暖米色纸张背景。' },
        subject: { detailText: '主体是夸张化预算账本与收据云团。' },
        background: { detailText: '背景用浅米纸纹与便签层衬托。' },
        layout: { detailText: '标题居中，时间标签靠右上。' },
        typography: { detailText: '主标题使用粗黑无衬线，副标题为便签体。' },
      },
      [
        { hex: '#15BC55', weight: '' },
      ],
    );

    expect(result).toContain('整体以#15BC55为主色');
    expect(result).toContain('标题居中，时间标签靠右上');
    expect(result).not.toContain('canvas:');
    expect(result).not.toContain('tokens');
  });

  it('builds variant edit user input with v2 task id', () => {
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
          { hex: '#A4B97E', weight: '40%' },
        ],
        analysis: {
          canvas: { detailText: '整体春日浅绿基调。' },
          subject: { detailText: '花束主体搭配纸张拼贴。' },
          background: { detailText: '奶油纸底。' },
          layout: { detailText: '上下分区，标题居中。' },
          typography: { detailText: '轻复古无衬线。' },
        },
        promptPreview: 'Fresh spring poster with #A4B97E fields.',
      },
      context: {
        shortcutId: 'us-kv',
        shortcutPrompt: 'Create a US-EVENT KV ...',
        market: 'US',
      },
    }));

    expect(payload.task).toBe('design_structured_variant_edit_v2');
    expect(payload.scope).toBe('variant');
    expect(payload.currentVariant.analysis.canvas.detailText).toBe('整体春日浅绿基调。');
  });

  it('builds section edit user input with full analysis context', () => {
    const payload = JSON.parse(buildDesignSectionEditUserInput({
      variantId: 'v1',
      sectionKey: 'typography',
      instruction: '让标题更醒目并加强层级',
      currentSectionText: '主标题使用粗黑无衬线字体。',
      fullAnalysisContext: {
        canvas: { detailText: '整体春日浅绿基调。' },
        subject: { detailText: '花束主体搭配纸张拼贴。' },
        background: { detailText: '奶油纸底。' },
        layout: { detailText: '上下分区，标题居中。' },
        typography: { detailText: '主标题使用粗黑无衬线字体。' },
      },
      shortcutContext: {
        shortcutId: 'us-kv',
        shortcutPrompt: 'Create a US-EVENT KV ...',
        market: 'US',
      },
    }));

    expect(payload.task).toBe('design_structured_section_edit_v2');
    expect(payload.variantId).toBe('v1');
    expect(payload.sectionKey).toBe('typography');
    expect(payload.shortcutContext.shortcutId).toBe('us-kv');
    expect(payload.fullAnalysisContext.layout.detailText).toContain('上下分区');
  });

  it('throws when optimization response has no usable variant content', () => {
    expect(() => parseDesignStructuredOptimizationResponse('{}')).toThrow(
      /did not contain any usable variants/i,
    );
  });
});
