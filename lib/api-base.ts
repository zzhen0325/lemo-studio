export function getApiBase(): string {
    return process.env.NEXT_PUBLIC_API_BASE || 'http://10.75.166.66:3000/api';
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
        const isLocal = resultUrl.startsWith(siteBase) ||
            resultUrl.includes('localhost') ||
            resultUrl.includes('127.0.0.1');

        if (!isLocal) {
            return `${apiBase}/proxy-image?url=${encodeURIComponent(resultUrl)}`;
        }
    }

    return resultUrl;
}
