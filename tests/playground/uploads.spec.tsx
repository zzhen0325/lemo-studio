import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlaygroundState } from '@/lib/store/playground-store.types';
import { usePlaygroundUploads } from '@/app/studio/playground/_components/containers/hooks/usePlaygroundUploads';

const harness = vi.hoisted(() => ({ state: {} as PlaygroundState }));
vi.mock('@/hooks/common/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api-base', () => ({ getApiBase: () => '/api' }));
vi.mock('@/app/studio/playground/_lib/moodboard-card-gallery', () => ({ upsertMoodboardAsShortcut: vi.fn() }));
vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: Object.assign(
    (selector: (state: PlaygroundState) => unknown) => selector(harness.state),
    { getState: () => harness.state },
  ),
}));

beforeEach(() => {
  harness.state = {
    config: { aspectRatio: 'auto' },
    setDescribeImages: vi.fn(), setUploadedImages: vi.fn(),
    updateDescribeImage: vi.fn(), updateUploadedImage: vi.fn(),
    updateHistorySourceUrl: vi.fn(), updateConfig: vi.fn(),
    syncLocalImageToHistory: vi.fn().mockResolvedValue(undefined),
  } as unknown as PlaygroundState;
  vi.stubGlobal('Image', class {
    naturalWidth = 512;
    naturalHeight = 256;
    onload?: () => void;
    set src(_value: string) { this.onload?.(); }
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup() {
  return renderHook(() => usePlaygroundUploads({
    activeTab: 'describe', getNextAutoMoodboardName: () => 'Board',
    refreshMoodboardCards: vi.fn().mockResolvedValue(undefined),
  }));
}

it('finalizes the same local reference and reconciles history after an awaited upload', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ path: 'images/saved.png', url: '/signed.png' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = setup();
  await act(() => result.current.handleFilesUpload([
    new File(['image'], 'reference.png', { type: 'image/png' }),
    new File(['text'], 'ignored.txt', { type: 'text/plain' }),
  ], 'reference', { waitForUpload: true }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/upload', expect.objectContaining({ method: 'POST' }));
  const append = vi.mocked(harness.state.setUploadedImages).mock.calls[0][0];
  if (typeof append !== 'function') throw new Error('Expected preview updater');
  const preview = append([])[0];
  expect(preview.isUploading).toBe(true);
  expect(harness.state.updateUploadedImage).toHaveBeenCalledWith(preview.id, {
    path: 'images/saved.png', previewUrl: '/signed.png', isUploading: false,
  });
  expect(harness.state.syncLocalImageToHistory).toHaveBeenCalledWith(preview.id, 'images/saved.png');
  expect(harness.state.updateHistorySourceUrl).toHaveBeenCalledWith(preview.previewUrl, '/signed.png');
  expect(harness.state.updateConfig).toHaveBeenCalledWith({ width: 2048, height: 1024 });
  expect(harness.state.setDescribeImages).not.toHaveBeenCalled();
});

it('propagates awaited Describe upload failures and clears the uploading flag', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'Upload rejected' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { result } = setup();
  await expect(result.current.handleFilesUpload([
    new File(['image'], 'describe.png', { type: 'image/png' }),
  ], 'describe', { waitForUpload: true })).rejects.toThrow('Upload rejected');
  expect(harness.state.updateDescribeImage).toHaveBeenCalledWith(expect.any(String), { isUploading: false });
  expect(harness.state.updateConfig).not.toHaveBeenCalled();
  expect(harness.state.syncLocalImageToHistory).not.toHaveBeenCalled();
});
