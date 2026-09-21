import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Generation } from '@/types/database';
import type { PlaygroundState } from '@/lib/store/playground-store.types';
import type { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { MODEL_ID_WORKFLOW } from '@/lib/constants/models';
import { usePlaygroundHistoryActions } from '@/app/studio/playground/_components/containers/hooks/usePlaygroundHistoryActions';

const harness = vi.hoisted(() => ({
  state: {} as PlaygroundState,
  toast: vi.fn(),
}));
vi.mock('@/hooks/common/use-toast', () => ({ useToast: () => ({ toast: harness.toast }) }));
vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: Object.assign(
    (selector: (state: PlaygroundState) => unknown) => selector(harness.state),
    { getState: () => harness.state },
  ),
}));
vi.mock('@/lib/utils/download', () => ({ downloadImage: vi.fn() }));
vi.mock('@/lib/interaction-tracking', () => ({ downloadGeneration: vi.fn() }));

const record = {
  id: 'saved-result',
  config: {
    prompt: 'saved prompt', model: 'saved-model', width: 1536, height: 1024,
    sourceImageUrls: ['/saved-reference.png'], taskId: 'old-task',
  },
} as Generation;

function setup(workflows: IViewComfy[] = []) {
  const args = {
    workflows, defaultImageModelId: 'default-model',
    setActiveShortcutTemplate: vi.fn(),
    handleGenerate: vi.fn().mockResolvedValue(undefined),
    mutateHistory: vi.fn().mockResolvedValue(undefined),
  };
  return { ...renderHook(() => usePlaygroundHistoryActions(args)), args };
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.state = {
    config: { prompt: 'current prompt', model: 'current-model', width: 1024, height: 1024 },
    applyModel: vi.fn(), updateConfig: vi.fn(),
    setSelectedModel: vi.fn(), setSelectedPresetName: vi.fn(),
    setSelectedWorkflowConfig: vi.fn(), setUploadedImages: vi.fn(),
    applyImages: vi.fn().mockResolvedValue(undefined),
  } as unknown as PlaygroundState;
});

describe('Playground history actions', () => {
  it('restores model parameters while preserving current prompt and uploaded images', async () => {
    const { result, args } = setup();
    await act(() => result.current.handleUseHistoryModel(record));
    expect(harness.state.applyModel).toHaveBeenCalledWith('saved-model', expect.objectContaining({
      prompt: 'current prompt', width: 1536, taskId: undefined,
    }));
    expect(harness.state.applyImages).not.toHaveBeenCalled();
    expect(harness.state.setUploadedImages).not.toHaveBeenCalled();
    expect(args.setActiveShortcutTemplate).toHaveBeenCalledWith(null);
  });

  it('restores workflow identity, base model and reference images together', async () => {
    const workflow = { viewComfyJSON: { id: 'workflow-1', title: 'Saved workflow' } } as IViewComfy;
    const { result } = setup([workflow]);
    await act(() => result.current.handleUseHistoryAll({
      ...record, config: { ...record.config, workflowName: 'workflow-1', baseModel: 'base-model' },
    }));
    expect(harness.state.setSelectedWorkflowConfig).toHaveBeenCalledWith(workflow, 'Saved workflow');
    expect(harness.state.setSelectedModel).toHaveBeenCalledWith(MODEL_ID_WORKFLOW);
    expect(harness.state.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      model: MODEL_ID_WORKFLOW, baseModel: 'base-model', prompt: 'saved prompt', taskId: undefined,
    }));
    expect(harness.state.applyImages).toHaveBeenCalledWith(['/saved-reference.png']);
  });

  it('waits for reference restoration before rerunning a saved record', async () => {
    let resolveImages!: () => void;
    harness.state.applyImages = vi.fn(() => new Promise<void>(resolve => { resolveImages = resolve; }));
    const { result, args } = setup();
    const pending = result.current.handleRegenerate(record);
    expect(args.handleGenerate).not.toHaveBeenCalled();
    await act(async () => { resolveImages(); await pending; });
    expect(args.handleGenerate).toHaveBeenCalledWith(expect.objectContaining({
      configOverride: expect.objectContaining({ prompt: 'saved prompt', taskId: undefined }),
      sourceImageUrls: ['/saved-reference.png'],
    }));
  });

  it('clears previous uploaded images when fully restoring a text-only record', async () => {
    const { result } = setup();
    await act(() => result.current.handleUseHistoryAll({
      ...record, config: { ...record.config, sourceImageUrls: [] },
    }));
    expect(harness.state.setUploadedImages).toHaveBeenCalledWith([]);
    expect(harness.state.applyImages).not.toHaveBeenCalled();
  });

  it('batch generation reuses only prompts and clears edit and reference context', async () => {
    vi.useFakeTimers();
    try {
      harness.state.config = {
        ...harness.state.config, isEdit: true, parentId: 'parent',
        sourceImageUrls: ['/current-reference.png'], localSourceIds: ['local-ref'],
      };
      const { result, args } = setup();
      await act(async () => {
        const pending = result.current.handleBatchUse([record]);
        await vi.runAllTimersAsync();
        await pending;
      });
      expect(args.handleGenerate).toHaveBeenCalledWith({
        configOverride: expect.objectContaining({
          model: 'current-model', prompt: 'saved prompt', isEdit: false,
          parentId: undefined, sourceImageUrls: [], localSourceIds: [],
        }),
        sourceImageUrls: [], localSourceIds: [], ignoreActiveShortcutTemplate: true,
      });
      expect(harness.state.applyImages).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
