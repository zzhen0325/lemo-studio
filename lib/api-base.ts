export function getApiBase(): string {
    return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';
}

export function formatImageUrl(url: string | undefined | null): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    // Handle CDN URLs that don't start with protocol (e.g. sf16-sg.tiktokcdn.com/...)
    const isCdnUrl = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\//.test(url);
    if (isCdnUrl) {
        return `https://${url}`;
    }

    // Handle relative paths
    const base = getApiBase().replace('/api', '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
