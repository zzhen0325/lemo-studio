import { useCallback, useEffect, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { getApiBase } from '@/lib/api-base';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Generation } from '@/types/database';

const HISTORY_PAGE_LIMIT = 50;

interface HistoryPage {
    history: Generation[];
    hasMore: boolean;
    total?: number;
}

export interface PlaygroundHistoryController {
    history: Generation[];
    setHistory: (history: Generation[] | ((prev: Generation[]) => Generation[])) => void;
    getHistoryItem: (matcher: string | ((item: Generation) => boolean)) => Generation | undefined;
}

const isHistoryDebugEnabled = () => {
    if (typeof window !== 'undefined') {
        return process.env.NEXT_PUBLIC_HISTORY_DEBUG === '1' || window.localStorage.getItem('__DEBUG_HISTORY__') === '1';
    }
    return process.env.NEXT_PUBLIC_HISTORY_DEBUG === '1';
};

const fetcher = async (url: string) => {
    const start = Date.now();
    const res = await fetch(url);
    const elapsedMs = Date.now() - start;
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (isHistoryDebugEnabled()) {
            console.error('[HistoryDebug][Front] fetch_failed', { url, status: res.status, elapsedMs, body: errText.slice(0, 300) });
        }
        throw new Error('Failed to fetch history');
    }
    const data = await res.json();
    if (isHistoryDebugEnabled()) {
        console.info('[HistoryDebug][Front] fetch_ok', {
            url,
            status: res.status,
            elapsedMs,
            count: Array.isArray(data?.history) ? data.history.length : undefined,
            total: data?.total,
            hasMore: data?.hasMore,
        });
    }
    return data;
};

const getKey = (
    pageIndex: number,
    previousPageData: { history: Generation[], hasMore: boolean } | null,
    userId: string | null,
) => {
    if (!userId) return null;
    // If we reached the end
    if (previousPageData && !previousPageData.hasMore) return null;

    const limit = HISTORY_PAGE_LIMIT;
    const apiBase = getApiBase().replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('page', (pageIndex + 1).toString());
    params.set('limit', limit.toString());
    params.set('userId', userId);
    const requestUrl = `${apiBase}/history?${params.toString()}`;

    if (isHistoryDebugEnabled()) {
        console.info('[HistoryDebug][Front] swr_key', {
            pageIndex,
            userId,
            requestUrl,
        });
    }

    return requestUrl;
};

export function useHistory() {
    const actorId = useAuthStore((state) => state.actorId);
    const currentUser = useAuthStore((state) => state.currentUser);
    const ensureSession = useAuthStore((state) => state.ensureSession);

    useEffect(() => {
        void ensureSession().catch(() => undefined);
    }, [ensureSession]);

    useEffect(() => {
        if (!isHistoryDebugEnabled()) return;
        console.info('[HistoryDebug][Front] identity', {
            currentUserId: currentUser?.id || null,
            actorId: actorId || null,
            apiBase: getApiBase(),
        });
    }, [actorId, currentUser?.id]);

    const { data, size, setSize, isValidating, mutate } = useSWRInfinite(
        (index, prev) => getKey(index, prev, actorId),
        fetcher,
        {
            revalidateOnFocus: true,
            revalidateFirstPage: false,
            persistSize: true,
            dedupingInterval: 5000,
            // 保持之前的数据，避免加载时闪烁
            keepPreviousData: true,
            // 如果有缓存，优先显示缓存数据，同时后台刷新
            revalidateIfStale: true,
            // 减少首屏等待时间
            focusThrottleInterval: 10000,
        }
    );

    const history = useMemo(() => data ? data.flatMap(page => page.history) : [], [data]);
    const isLoading = (!data && isValidating);
    const isRefreshing = (isValidating && data && data.length > 0);
    const isEmpty = (data?.[0]?.history?.length === 0);
    const hasMore = data ? data[data.length - 1].hasMore : true;

    const setHistory = useCallback((updater: Generation[] | ((prev: Generation[]) => Generation[])) => {
        void mutate((previousPages?: HistoryPage[]) => {
            const previousHistory = previousPages ? previousPages.flatMap((page) => page.history) : [];
            const nextHistory = typeof updater === 'function' ? updater(previousHistory) : updater;
            const uniqueHistory = Array.from(
                new Map(nextHistory.map((item) => [item.id, item])).values()
            );

            const chunkCount = Math.max(1, Math.ceil(uniqueHistory.length / HISTORY_PAGE_LIMIT));
            const existingLastHasMore = previousPages?.[previousPages.length - 1]?.hasMore ?? false;
            const existingLastTotal = previousPages?.[previousPages.length - 1]?.total;

            return Array.from({ length: chunkCount }, (_, index) => {
                const start = index * HISTORY_PAGE_LIMIT;
                const end = start + HISTORY_PAGE_LIMIT;
                const historyChunk = uniqueHistory.slice(start, end);
                return {
                    history: historyChunk,
                    hasMore: index < chunkCount - 1 ? true : existingLastHasMore,
                    total: typeof existingLastTotal === 'number' ? Math.max(existingLastTotal, uniqueHistory.length) : undefined,
                };
            });
        }, { revalidate: false });
    }, [mutate]);

    const getHistoryItem = useCallback((matcher: string | ((item: Generation) => boolean)) => {
        if (typeof matcher === 'string') {
            return history.find((item) => item.id === matcher);
        }
        return history.find(matcher);
    }, [history]);

    return {
        history,
        isLoading,
        isRefreshing,
        isEmpty,
        hasMore,
        size,
        setSize,
        mutate,
        setHistory,
        getHistoryItem,
    };
}
