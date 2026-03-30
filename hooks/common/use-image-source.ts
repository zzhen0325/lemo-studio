
import { useState, useEffect } from 'react';
import { formatImageUrl } from '@/lib/api-base';

export function useImageSource(url?: string, _localId?: string) {
    const [source, setSource] = useState<string | undefined>(undefined);
    void _localId;

    useEffect(() => {
        if (url) {
            // 对于本地静态资源（以 / 开头）和对象存储路径，不启用代理
            // 只有外部 URL 才需要代理
            const needsProxy = url.startsWith('http://') || url.startsWith('https://');
            setSource(formatImageUrl(url, needsProxy));
        }
    }, [url]);

    return source;
}
