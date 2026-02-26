export function getApiBase(): string {
    const envBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
    if (envBase) {
        return envBase.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol || 'http:';
        const hostname = window.location.hostname || '127.0.0.1';
        return `${protocol}//${hostname}:3000/api`;
    }

    return 'http://127.0.0.1:3000/api';
}

export function formatImageUrl(url: string | undefined | null, useProxy = false): string {
    if (!url) return '';

    // Handle local storage IDs (starting with local:)
    if (url.startsWith('local:')) {
        // Return as is, let the UI component handle it or use a separate hook
        return url;
    }

    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    let resultUrl = url;
    const apiBase = getApiBase();
    const siteBase = apiBase.replace('/api', '');

    if (!url.startsWith('http')) {
        // Handle CDN URLs that don't start with protocol (e.g. sf16-sg.tiktokcdn.com/...)
        const isCdnUrl = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\//.test(url);
        if (isCdnUrl) {
            resultUrl = `https://${url}`;
        } else {
            // Handle relative paths
            resultUrl = `${siteBase}${url.startsWith('/') ? '' : '/'}${url}`;
        }
    }

    // 如果启用代理且是外部 URL，则包装代理
    if (useProxy && resultUrl.startsWith('http')) {
        let isSameOrigin = false;
        try {
            if (typeof window !== 'undefined') {
                const url = new URL(resultUrl, window.location.origin);
                const current = new URL(window.location.origin);
                // 只有协议、域名、端口全等才不需要代理
                isSameOrigin = (url.protocol === current.protocol &&
                    url.hostname === current.hostname &&
                    url.port === current.port);
            }
        } catch {
            // fallback to proxying if URL parsing fails
        }

        if (!isSameOrigin) {
            return `${apiBase}/proxy-image?url=${encodeURIComponent(resultUrl)}`;
        }
    }

    return resultUrl;
}
