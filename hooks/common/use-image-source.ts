import { useMemo } from 'react';
import { formatImageUrl } from '@/lib/api-base';

export function useImageSource(url?: string, _localId?: string) {
    void _localId;

    return useMemo(() => {
        if (!url) {
            return undefined;
        }

        // 对于本地静态资源（以 / 开头）和对象存储路径，不启用代理
        // 只有外部 URL 才需要代理
        const needsProxy = url.startsWith('http://') || url.startsWith('https://');
        return formatImageUrl(url, needsProxy);
    }, [url]);
}
