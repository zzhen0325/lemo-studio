import { getPublicApiBase } from "./env/public";

function normalizeHttpApiBase(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }

    const withoutTrailingSlash = trimmed.replace(/\/$/, '');
    if (withoutTrailingSlash === '/api' || withoutTrailingSlash.endsWith('/api')) {
        return withoutTrailingSlash;
    }

    try {
        const url = trimmed.startsWith('/')
            ? new URL(trimmed, 'http://placeholder.local')
            : new URL(trimmed);
        const pathname = url.pathname.replace(/\/$/, '');

        if (!pathname) {
            url.pathname = '/api';
        } else if (pathname === '/') {
            url.pathname = '/api';
        } else {
            return withoutTrailingSlash;
        }

        if (trimmed.startsWith('/')) {
            return `${url.pathname}${url.search}${url.hash}`.replace(/\/$/, '');
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        return withoutTrailingSlash;
    }
}

export function normalizeConfiguredApiBase(value: string | undefined | null): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    return normalizeHttpApiBase(trimmed);
}

let loggedClientApiBase = false;
let loggedServerApiBase = false;

function logResolvedApiBase(scope: "client" | "server", apiBase: string, source: string) {
    if (scope === "client") {
        if (loggedClientApiBase || typeof window === "undefined") return;
        loggedClientApiBase = true;
        console.info("[API Base] client_resolved", {
            apiBase,
            source,
            pageOrigin: window.location.origin,
        });
        return;
    }

    if (loggedServerApiBase) return;
    loggedServerApiBase = true;
    console.info("[API Base] server_resolved", {
        apiBase,
        source,
    });
}

export function getApiBase(): string {
    if (typeof window !== 'undefined') {
        const envBase = normalizeConfiguredApiBase(getPublicApiBase());
        if (envBase) {
            logResolvedApiBase("client", envBase, "runtime-public-env");
            return envBase;
        }
        logResolvedApiBase("client", "/api", "same-origin");
        return '/api';
    }

    const envBase = normalizeConfiguredApiBase(getPublicApiBase());
    if (envBase) {
        logResolvedApiBase("server", envBase, "runtime-public-env");
        return envBase;
    }

    const port = (process.env.PORT || process.env.NEXT_PUBLIC_APP_PORT || '3001').trim();
    const internalBase = `http://127.0.0.1:${port}/api`;
    logResolvedApiBase("server", internalBase, "local-next-server");
    return internalBase;
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

    // Handle storage key format (e.g. ljhwZthlaukjlkulzlp/...)
    // Return API path that will generate presigned URL and redirect
    if (url.startsWith('ljhwZthlaukjlkulzlp/')) {
        const apiBase = getApiBase();
        return `${apiBase}/storage/image?key=${encodeURIComponent(url)}`;
    }

    let resultUrl = url;
    const apiBase = getApiBase();
    const siteBase = apiBase.replace('/api', '');

    if (!url.startsWith('http')) {
        // Handle CDN URLs that don't start with protocol (e.g. sf16-sg.tiktokcdn.com/...)
        const isCdnUrl = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\//.test(url);
        if (isCdnUrl) {
            resultUrl = `https://${url}`;
        } else if (url.startsWith('/')) {
            // 对于以 / 开头的本地静态资源，直接返回原始路径，避免 SSR/CSR hydration mismatch
            resultUrl = url;
        } else {
            // Handle other relative paths
            resultUrl = `/${url}`;
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
