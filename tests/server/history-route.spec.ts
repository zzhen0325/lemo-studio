import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getHistoryMock = vi.fn();
const getHistoryDetailMock = vi.fn();
const getOrCreateSessionMock = vi.fn();
const attachSessionCookieMock = vi.fn();

vi.mock('@/lib/server/container', () => ({
  getServerServices: vi.fn(async () => ({
    historyService: {
      getHistory: getHistoryMock,
      getHistoryDetail: getHistoryDetailMock,
    },
  })),
}));

vi.mock('@/lib/server/auth/session', () => ({
  getOrCreateSession: (...args: unknown[]) => getOrCreateSessionMock(...args),
  attachSessionCookie: (...args: unknown[]) => attachSessionCookieMock(...args),
}));

import { GET } from '@/app/api/history/route';

describe('GET /api/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreateSessionMock.mockResolvedValue({
      session: {
        actorId: 'viewer-1',
      },
      shouldSetCookie: false,
    });
  });

  it('routes id/outputUrl lookups to history detail hydration', async () => {
    getHistoryDetailMock.mockResolvedValue({
      item: { id: 'gen-1' },
    });

    const response = await GET(new NextRequest('http://localhost/api/history?id=gen-1'));

    expect(getHistoryDetailMock).toHaveBeenCalledWith({
      id: 'gen-1',
      outputUrl: null,
      userId: null,
      viewerUserId: 'viewer-1',
    });
    expect(getHistoryMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      item: { id: 'gen-1' },
    });
  });

  it('keeps list requests on the paginated history path', async () => {
    getHistoryMock.mockResolvedValue({
      history: [],
      total: 0,
      hasMore: false,
    });

    const response = await GET(new NextRequest('http://localhost/api/history?page=1&limit=24&sortBy=recent'));

    expect(getHistoryMock).toHaveBeenCalledWith(expect.objectContaining({
      page: '1',
      limit: '24',
      sortBy: 'recent',
      userId: null,
      viewerUserId: 'viewer-1',
    }));
    expect(getHistoryDetailMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      history: [],
      total: 0,
      hasMore: false,
    });
  });
});
