import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryListOptions } from '@/lib/server/repositories/history.repository';

const normalizeAssetMock = vi.fn();
const getFileUrlMock = vi.fn();
const getBatchInteractionDataMock = vi.fn();

vi.mock('@/lib/server/utils/cdn-image-url', () => ({
  tryNormalizeAssetUrlToCdn: (...args: unknown[]) => normalizeAssetMock(...args),
}));

vi.mock('@/src/storage/object-storage', () => ({
  getFileUrl: (...args: unknown[]) => getFileUrlMock(...args),
}));

vi.mock('@/lib/server/service/interaction.service', () => ({
  getBatchInteractionData: (...args: unknown[]) => getBatchInteractionDataMock(...args),
}));

import { HistoryService } from '@/lib/server/service/history.service';

function createRepositoryMock() {
  return {
    countByOwner: vi.fn(async () => 1),
    countPublic: vi.fn(async () => 1),
    listByOwner: vi.fn(async (_ownerId: string, _options?: HistoryListOptions) => []),
    listPublic: vi.fn(async (_options: HistoryListOptions = {}) => [
      {
        id: 'gen-1',
        user_id: 'user-1',
        project_id: 'default',
        output_url: 'storage/output-1.png',
        config: {
          prompt: 'prompt',
          width: 1024,
          height: 1024,
          model: 'coze_seedream4_5',
          baseModel: 'flux_klein',
          workflowName: 'Flux Workflow',
          sourceImageUrls: ['storage/source-1.png'],
        },
        status: 'completed',
        created_at: '2026-04-05T00:00:00.000Z',
      },
    ]),
    update: vi.fn(async () => undefined),
  };
}

describe('HistoryService lightweight mode', () => {
  beforeEach(() => {
    normalizeAssetMock.mockReset();
    getFileUrlMock.mockReset();
    getBatchInteractionDataMock.mockReset();

    normalizeAssetMock.mockResolvedValue({
      storageKey: 'normalized/key.png',
      url: undefined,
    });
    getFileUrlMock.mockImplementation((key: string) => `https://signed.example/${key}`);
    getBatchInteractionDataMock.mockResolvedValue(new Map());
  });

  it('skips heavy normalization and interaction lookups for lightweight/minimal queries', async () => {
    const repository = createRepositoryMock();
    const service = new HistoryService(repository as never);

    const result = await service.getHistory({
      page: 1,
      limit: 24,
      sortBy: 'recent',
      viewerUserId: 'viewer-1',
      lightweight: '1',
      minimal: '1',
    });

    expect(repository.listPublic).toHaveBeenCalledTimes(1);
    const listPublicOptions = repository.listPublic.mock.calls[0]?.[0];
    expect(listPublicOptions?.select).toContain('output_url,config,status,created_at');
    expect(normalizeAssetMock).not.toHaveBeenCalled();
    expect(getBatchInteractionDataMock).not.toHaveBeenCalled();

    expect(result.history[0].outputUrl).toBe('storage/output-1.png');
    expect(result.history[0].config.sourceImageUrls).toEqual(['storage/source-1.png']);
    expect(result.history[0].viewerState).toBeUndefined();
  });

  it('uses full normalization path when lightweight flags are absent', async () => {
    const repository = createRepositoryMock();
    const service = new HistoryService(repository as never);

    const result = await service.getHistory({
      page: 1,
      limit: 24,
      sortBy: 'recent',
      viewerUserId: 'viewer-1',
    });

    expect(normalizeAssetMock).toHaveBeenCalled();
    expect(getBatchInteractionDataMock).toHaveBeenCalledTimes(1);
    expect(result.history[0].outputUrl).toBe('https://signed.example/normalized/key.png');
  });

  it('preserves existing config fields when persisting normalized source image urls', async () => {
    const repository = createRepositoryMock();
    const service = new HistoryService(repository as never);

    await service.getHistory({
      page: 1,
      limit: 24,
      sortBy: 'recent',
      viewerUserId: 'viewer-1',
    });

    expect(repository.update).toHaveBeenCalledWith('gen-1', {
      output_url: 'normalized/key.png',
      config: {
        prompt: 'prompt',
        width: 1024,
        height: 1024,
        model: 'coze_seedream4_5',
        baseModel: 'flux_klein',
        workflowName: 'Flux Workflow',
        sourceImageUrls: ['normalized/key.png'],
      },
    });
  });
});
