
import { useState, useEffect } from 'react';
import { formatImageUrl } from '@/lib/api-base';

export function useImageSource(url?: string, _localId?: string) {
    const [source, setSource] = useState<string | undefined>(undefined);
    void _localId;

    useEffect(() => {
        if (url) {
            setSource(formatImageUrl(url, true));
        }
    }, [url]);

    return source;
}
