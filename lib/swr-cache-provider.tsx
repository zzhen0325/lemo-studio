'use client';

import { SWRConfig } from 'swr';
import { ReactNode, useEffect, useMemo, useCallback } from 'react';

const CACHE_KEY = 'swr-history-cache';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时

interface CacheData {
    version: number;
    timestamp: number;
    data: [string, unknown][];
}

/**
 * 从 localStorage 加载 SWR 缓存
 */
function loadCache(): Map<string, unknown> {
    if (typeof window === 'undefined') return new Map();

    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return new Map();

        const cached: CacheData = JSON.parse(raw);

        // 检查版本和过期时间
        if (cached.version !== CACHE_VERSION) return new Map();
        if (Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) {
            localStorage.removeItem(CACHE_KEY);
            return new Map();
        }

        // 只恢复 history 相关的缓存
        const historyEntries = cached.data.filter(([key]) =>
            typeof key === 'string' && key.includes('/history')
        );

        return new Map(historyEntries);
    } catch {
        return new Map();
    }
}

/**
 * 保存 SWR 缓存到 localStorage
 */
function saveCache(cache: Map<string, unknown>) {
    if (typeof window === 'undefined') return;

    try {
        // 只保存 history 相关的缓存，限制大小
        const historyEntries = Array.from(cache.entries())
            .filter(([key]) => typeof key === 'string' && key.includes('/history'))
            .slice(0, 10); // 最多保存 10 个页面的缓存

        const cacheData: CacheData = {
            version: CACHE_VERSION,
            timestamp: Date.now(),
            data: historyEntries,
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
        // localStorage 可能已满，忽略错误
        console.warn('[SWR Cache] Failed to save cache:', e);
    }
}

/**
 * 创建带持久化的 SWR 缓存 Provider
 */
function createCacheProvider() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = loadCache() as Map<string, any>;

    return {
        cache,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get(key: string): any {
            return cache.get(key);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(key: string, value: any) {
            cache.set(key, value);
        },
        delete(key: string) {
            cache.delete(key);
        },
        keys() {
            return cache.keys();
        },
    };
}

interface SWRCacheProviderProps {
    children: ReactNode;
}

export function SWRCacheProvider({ children }: SWRCacheProviderProps) {
    const provider = useMemo(() => createCacheProvider(), []);

    // 定期保存缓存（页面卸载或每 30 秒）
    useEffect(() => {
        const handleSave = () => saveCache(provider.cache);

        // 页面卸载时保存
        window.addEventListener('beforeunload', handleSave);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') handleSave();
        });

        // 定期保存
        const interval = setInterval(handleSave, 30000);

        return () => {
            window.removeEventListener('beforeunload', handleSave);
            clearInterval(interval);
            handleSave();
        };
    }, [provider.cache]);

    const cacheProvider = useCallback(() => provider, [provider]);

    return (
        <SWRConfig
            value={{
                provider: cacheProvider,
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                dedupingInterval: 5000,
            }}
        >
            {children}
        </SWRConfig>
    );
}

/**
 * 预加载历史记录数据（在页面加载时调用）
 */
export function preloadHistory(userId?: string, projectId?: string) {
    if (typeof window === 'undefined') return;

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
    const url = new URL(`${apiBase}/history`, window.location.origin);
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', '50');
    if (userId) url.searchParams.set('userId', userId);
    if (projectId) url.searchParams.set('projectId', projectId);

    // 使用 fetch 预加载，利用浏览器缓存
    fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
    }).catch(() => {
        // 预加载失败不影响主流程
    });
}
