import { useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { getApiBase } from '@/lib/api-base';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import type { Generation } from '@/types/database';
import { userStore } from '@/lib/store/user-store';

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
};

const getKey = (pageIndex: number, previousPageData: { history: Generation[], hasMore: boolean } | null, projectId?: string | null) => {
    // If we reached the end
    if (previousPageData && !previousPageData.hasMore) return null;

    const limit = 50;
    const url = new URL(`${getApiBase()}/history`);
    url.searchParams.set('page', (pageIndex + 1).toString());
    url.searchParams.set('limit', limit.toString());

    const userId = userStore.currentUser?.id || usePlaygroundStore.getState().visitorId;
    if (userId) {
        url.searchParams.set('userId', userId);
    }

    // Only add projectId if it's explicitly provided (not null/undefined)
    if (projectId) {
        url.searchParams.set('projectId', projectId);
    }

    return url.toString();
};

export function useHistory(projectId?: string | null) {
    const { data, size, setSize, isValidating, mutate } = useSWRInfinite(
        (index, prev) => getKey(index, prev, projectId),
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

    return {
        history,
        isLoading,
        isRefreshing,
        isEmpty,
        hasMore,
        size,
        setSize,
        mutate
    };
}

