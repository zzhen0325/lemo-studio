import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PlaygroundInputSection,
  type PlaygroundInputSectionProps,
} from '@/app/studio/playground/_components/PlaygroundInputSection';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';

vi.mock('@studio/playground/_components/PromptInput', () => ({
  default: ({ onStructuredExpandedChange }: { onStructuredExpandedChange?: (expanded: boolean) => void }) => (
    <div data-testid="prompt-input">
      <button type="button" data-testid="mock-structured-expand" onClick={() => onStructuredExpandedChange?.(true)}>
        expand
      </button>
      <button type="button" data-testid="mock-structured-collapse" onClick={() => onStructuredExpandedChange?.(false)}>
        collapse
      </button>
    </div>
  ),
}));

vi.mock('@studio/playground/_components/ControlToolbar', () => ({
  default: () => <div data-testid="control-toolbar" />,
}));

vi.mock('@/components/ui/split-text', () => ({
  default: () => <div data-testid="split-text" />,
}));

function createBaseProps(): PlaygroundInputSectionProps {
  return {
    showHistory: true,
    config: {
      prompt: '',
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
    },
    uploadedImages: [],
    describeImages: [],
    isStackHovered: false,
    isInputFocused: false,
    isOptimizing: false,
    isGenerating: false,
    isDescribing: false,
    isDescribeMode: false,
    isDraggingOver: false,
    isDraggingOverPanel: false,
    isPresetGridOpen: false,
    isAspectRatioLocked: false,
    isSelectorExpanded: false,
    batchSize: 1,
    selectedModel: 'coze_seedream4_5',
    selectedAIModel: 'auto',
    selectedLoras: [],
    selectedPresetName: undefined,
    selectedWorkflowConfig: undefined,
    workflows: [],
    fileInputRef: { current: document.createElement('input') },
    describePanelRef: { current: document.createElement('div') } as React.RefObject<HTMLDivElement>,
    setConfig: () => {},
    setIsStackHovered: () => {},
    setIsInputFocused: () => {},
    setPreviewImage: () => {},
    removeImage: () => {},
    handleFilesUpload: () => {},
    handleOptimizePrompt: () => {},
    handleGenerate: () => {},
    handleDescribe: () => {},
    setSelectedAIModel: () => {},
    setSelectedModel: () => {},
    setIsAspectRatioLocked: () => {},
    setSelectedWorkflowConfig: () => {},
    applyWorkflowDefaults: () => {},
    setIsSelectorExpanded: () => {},
    setBatchSize: () => {},
    setIsLoraDialogOpen: () => {},
    setIsPresetGridOpen: () => {},
    onClearPreset: () => {},
    setIsDescribeMode: () => {},
    setDescribeImages: () => {},
    setIsDraggingOver: () => {},
    setIsDraggingOverPanel: () => {},
  };
}

function createStructuredShortcutTemplate(): NonNullable<PlaygroundInputSectionProps['shortcutTemplate']> {
  const shortcut = getShortcutById('us-kv');
  if (!shortcut) {
    throw new Error('Missing us-kv shortcut');
  }

  const values = createShortcutPromptValues(shortcut);

  return {
    shortcut,
    values,
    removedFieldIds: [],
    optimizationSession: {
      originPrompt: 'Create a US-EVENT KV ...',
      activeVariantId: 'v1',
      variants: [
        {
          id: 'v1',
          label: '预算海报',
          coreSuggestions: values,
          palette: [{ hex: '#15BC55', weight: '100%' }],
          analysis: {
            canvas: { detailText: '整体以 #15BC55 为主色。' },
            subject: { detailText: '主体强调预算账本。' },
            background: { detailText: '背景使用浅色纸纹。' },
            layout: { detailText: '标题居中。' },
            typography: { detailText: '主标题使用粗体。' },
          },
          promptPreview: '',
          pendingInstruction: '',
          pendingScope: 'variant',
          isModifying: false,
        },
      ],
    },
  };
}

describe('PlaygroundInputSection structured prompt behavior', () => {
  it('hides upload stack/button when structured session exists or prompt is optimizing', () => {
    const baseProps = createBaseProps();

    const { rerender } = render(<PlaygroundInputSection {...baseProps} />);
    expect(screen.getByLabelText('上传参考图')).toBeTruthy();

    rerender(
      <PlaygroundInputSection
        {...baseProps}
        isOptimizing
      />,
    );
    expect(screen.queryByLabelText('上传参考图')).toBeNull();

    rerender(
      <PlaygroundInputSection
        {...baseProps}
        shortcutTemplate={createStructuredShortcutTemplate()}
      />,
    );

    expect(screen.queryByLabelText('上传参考图')).toBeNull();
  });

  it('keeps legacy optimize/loading copy for non-structured mode', () => {
    const baseProps = createBaseProps();

    const { rerender } = render(<PlaygroundInputSection {...baseProps} />);
    expect(screen.getByRole('button', { name: 'AI自动优化' })).toBeTruthy();
    expect(screen.queryByText('AI自动优化')).toBeNull();

    rerender(<PlaygroundInputSection {...baseProps} isOptimizing />);
    expect(screen.getByRole('button', { name: 'AI自动优化中' })).toBeTruthy();
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('shows re-optimize copy only when structured prompt session exists', () => {
    const baseProps = createBaseProps();
    const structuredTemplate = createStructuredShortcutTemplate();

    const { rerender } = render(
      <PlaygroundInputSection
        {...baseProps}
        shortcutTemplate={structuredTemplate}
      />,
    );
    expect(screen.getByRole('button', { name: '重新优化' })).toBeTruthy();
    expect(screen.getByText('重新优化')).toBeTruthy();

    rerender(
      <PlaygroundInputSection
        {...baseProps}
        shortcutTemplate={structuredTemplate}
        isOptimizing
      />,
    );
    expect(screen.getByRole('button', { name: '重新优化中' })).toBeTruthy();
    expect(screen.getByText('重新优化中')).toBeTruthy();
  });

  it('hides sparkles re-optimize button when structured composer is expanded', () => {
    const baseProps = createBaseProps();

    render(
      <PlaygroundInputSection
        {...baseProps}
        shortcutTemplate={createStructuredShortcutTemplate()}
      />,
    );

    expect(screen.getByRole('button', { name: '重新优化' })).toBeTruthy();

    fireEvent.click(screen.getByTestId('mock-structured-expand'));
    expect(screen.queryByRole('button', { name: '重新优化' })).toBeNull();

    fireEvent.click(screen.getByTestId('mock-structured-collapse'));
    expect(screen.getByRole('button', { name: '重新优化' })).toBeTruthy();
  });
});
