import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShortcutPromptComposer } from '@/app/studio/playground/_components/ShortcutPromptComposer';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';

describe('ShortcutPromptComposer collapsed structured session', () => {
  it('renders five analysis sections with dividers and color tokens in collapsed view', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const values = createShortcutPromptValues(shortcut);

    const onAnalysisSectionChange = vi.fn();
    const { container } = render(
      <ShortcutPromptComposer
        shortcut={shortcut}
        values={values}
        removedFieldIds={[]}
        optimizationSession={{
          originPrompt: 'Create a US-EVENT KV ...',
          activeVariantId: 'v1',
          variants: [
            {
              id: 'v1',
              label: '预算海报',
              coreSuggestions: values,
              palette: [
                { hex: '#15BC55', weight: '50%' },
                { hex: '#F8E6CC', weight: '50%' },
              ],
              analysis: {
                canvas: { detailText: '整体以 #15BC55 为主色，叠加米色纸张底。' },
                subject: { detailText: '主体为账本与收据云，强调预算记录感。' },
                background: { detailText: '背景使用浅纸纹与便签层。' },
                layout: { detailText: '主标题居中，时间信息置于右上。' },
                typography: { detailText: '标题用粗体无衬线，副标题轻量辅助。' },
              },
              promptPreview: '',
              pendingInstruction: '',
              pendingScope: 'variant',
              isModifying: false,
            },
          ],
        }}
        onFieldChange={() => {}}
        onRemoveField={() => {}}
        onExitTemplateMode={() => {}}
        onAnalysisSectionChange={onAnalysisSectionChange}
        isExpanded={false}
      />,
    );

    const collapsedSections = screen.getByTestId('collapsed-analysis-sections');
    expect(collapsedSections).toBeTruthy();
    expect(collapsedSections.firstElementChild?.className || '').toContain('divide-y');

    expect(screen.getByTestId('collapsed-analysis-canvas')).toBeTruthy();
    expect(screen.getByTestId('collapsed-analysis-subject')).toBeTruthy();
    expect(screen.getByTestId('collapsed-analysis-background')).toBeTruthy();
    expect(screen.getByTestId('collapsed-analysis-layout')).toBeTruthy();
    expect(screen.getByTestId('collapsed-analysis-typography')).toBeTruthy();

    const colorTokens = container.querySelectorAll('[data-detail-text-color-token="true"]');
    expect(colorTokens.length).toBeGreaterThan(0);
    expect(screen.getByText('#15BC55')).toBeTruthy();

    const canvasEditor = within(screen.getByTestId('collapsed-analysis-canvas')).getByRole('textbox');
    canvasEditor.textContent = '整体以 #FF8800 为主色，保持统一视觉。';
    fireEvent.input(canvasEditor);

    expect(onAnalysisSectionChange).toHaveBeenCalled();
    expect(onAnalysisSectionChange).toHaveBeenLastCalledWith(
      'canvas',
      expect.objectContaining({
        detailText: expect.stringContaining('#FF8800'),
      }),
    );
  });

  it('supports inline rewrite instruction input in expanded view', () => {
    const shortcut = getShortcutById('us-kv');
    if (!shortcut) {
      throw new Error('Missing us-kv shortcut');
    }

    const values = createShortcutPromptValues(shortcut);
    const onApplyEdit = vi.fn();

    render(
      <ShortcutPromptComposer
        shortcut={shortcut}
        values={values}
        removedFieldIds={[]}
        optimizationSession={{
          originPrompt: 'Create a US-EVENT KV ...',
          activeVariantId: 'v1',
          variants: [
            {
              id: 'v1',
              label: '预算海报',
              coreSuggestions: values,
              palette: [
                { hex: '#15BC55', weight: '50%' },
                { hex: '#F8E6CC', weight: '50%' },
              ],
              analysis: {
                canvas: { detailText: '整体以 #15BC55 为主色，叠加米色纸张底。' },
                subject: { detailText: '主体为账本与收据云，强调预算记录感。' },
                background: { detailText: '背景使用浅纸纹与便签层。' },
                layout: { detailText: '主标题居中，时间信息置于右上。' },
                typography: { detailText: '标题用粗体无衬线，副标题轻量辅助。' },
              },
              promptPreview: '',
              pendingInstruction: '',
              pendingScope: 'variant',
              isModifying: false,
            },
          ],
        }}
        onFieldChange={() => {}}
        onRemoveField={() => {}}
        onExitTemplateMode={() => {}}
        onAnalysisSectionChange={() => {}}
        onApplyEdit={onApplyEdit}
        isExpanded
      />,
    );

    const instructionInput = screen.getAllByPlaceholderText('输入改写指令...')[0] as HTMLInputElement;
    fireEvent.change(instructionInput, { target: { value: '让画面更简洁' } });
    fireEvent.keyDown(instructionInput, { key: 'Enter' });

    expect(onApplyEdit).toHaveBeenCalledWith('canvas', '让画面更简洁');
    expect(instructionInput.value).toBe('');
  });
});
