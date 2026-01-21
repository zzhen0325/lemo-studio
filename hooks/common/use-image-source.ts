
import { useState, useEffect } from 'react';
import { localImageStorage } from '@/lib/local-image-storage';
import { formatImageUrl } from '@/lib/api-base';

export function useImageSource(url?: string, localId?: string) {
    const [source, setSource] = useState<string | undefined>(undefined);

    useEffect(() => {
        let isMounted = true;
        let objectUrl: string | null = null;

        async function resolveSource() {
            // 1. Priority: Local IndexedDB via localId
            if (localId) {
                const blob = await localImageStorage.getImage(localId);
                if (blob && isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setSource(objectUrl);
                    return;
                }
            }

            // 2. Secondary: Local IndexedDB via local: prefix in url
            if (url?.startsWith('local:')) {
                const id = url.slice(6);
                const blob = await localImageStorage.getImage(id);
                if (blob && isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setSource(objectUrl);
                    return;
                }
            }

            // 3. Third: Server path (if not local/blob/data)
            if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('local:')) {
                if (isMounted) setSource(formatImageUrl(url));
                return;
            }

            // 4. Last resort: Original URL (blob/base64)
            if (isMounted) setSource(formatImageUrl(url));
        }

        resolveSource();

        return () => {
            isMounted = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url, localId]);

    return source;
}
