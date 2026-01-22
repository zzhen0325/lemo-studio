
import { useState, useEffect } from 'react';
import { formatImageUrl } from '@/lib/api-base';

export function useImageSource(url?: string, localId?: string) {
    const [source, setSource] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (url) {
            setSource(formatImageUrl(url));
        }
    }, [url]);

    return source;
}
