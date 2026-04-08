import { beforeEach, describe, expect, it, vi } from 'vitest';

const normalizeAssetMock = vi.fn();
const uploadImageBufferMock = vi.fn();

vi.mock('@/lib/server/utils/cdn-image-url', () => ({
  tryNormalizeAssetUrlToCdn: (...args: unknown[]) => normalizeAssetMock(...args),
  uploadImageBufferToCdn: (...args: unknown[]) => uploadImageBufferMock(...args),
}));

import { ToolsPresetsService } from '@/lib/server/service/tools-presets.service';

function createService() {
  const toolPresetsRepository = {
    upsert: vi.fn(async () => undefined),
    listByToolId: vi.fn(async () => []),
    deleteOwned: vi.fn(async () => undefined),
  };

  const imageAssetsRepository = {
    deleteMany: vi.fn(async () => undefined),
  };

  return {
    service: new ToolsPresetsService(toolPresetsRepository as never, imageAssetsRepository as never),
    toolPresetsRepository,
    imageAssetsRepository,
  };
}

describe('ToolsPresetsService', () => {
  beforeEach(() => {
    normalizeAssetMock.mockReset();
    uploadImageBufferMock.mockReset();
    normalizeAssetMock.mockResolvedValue({
      url: 'https://cdn.example/tools-preset.png',
      storageKey: 'public/tools-presets/tools-preset.png',
    });
    uploadImageBufferMock.mockResolvedValue({
      url: 'https://cdn.example/uploaded.png',
      storageKey: 'public/tools-presets/uploaded.png',
    });
  });

  it('persists preset records with snake_case tool_id', async () => {
    const { service, toolPresetsRepository } = createService();
    const formData = new FormData();
    formData.append('toolId', 'pixel-grid');
    formData.append('name', 'Signal Grid');
    formData.append('values', JSON.stringify({ gridDensity: 120 }));
    formData.append('screenshotUrl', 'public/runtime-assets/signal-grid.png');

    const preset = await service.savePresetFromFormData(formData);

    expect(toolPresetsRepository.upsert).toHaveBeenCalledTimes(1);
    expect(toolPresetsRepository.upsert).toHaveBeenCalledWith(
      preset.id,
      expect.objectContaining({
        tool_id: 'pixel-grid',
        name: 'Signal Grid',
        values: { gridDensity: 120 },
        thumbnail: 'public/tools-presets/tools-preset.png',
      }),
    );
  });

  it('lists presets with normalized thumbnail urls', async () => {
    const { service, toolPresetsRepository } = createService();
    toolPresetsRepository.listByToolId.mockResolvedValue([
      {
        _id: 'preset-1',
        name: 'Tunnel',
        values: { lineCount: 88 },
        thumbnail: 'public/tools-presets/tunnel.png',
        timestamp: 123,
      },
    ] as never);

    const presets = await service.listPresets('data-tunnel');

    expect(toolPresetsRepository.listByToolId).toHaveBeenCalledWith('data-tunnel');
    expect(presets).toEqual([
      {
        id: 'preset-1',
        name: 'Tunnel',
        values: { lineCount: 88 },
        thumbnail: 'https://cdn.example/tools-preset.png',
        timestamp: 123,
      },
    ]);
  });
});
