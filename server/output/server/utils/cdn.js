"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBufferToCdn = uploadBufferToCdn;
exports.buildCdnPath = buildCdnPath;
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const undici_1 = require("undici");
const CDN_BASE = process.env.NODE_ENV === 'development' ? 'https://ife-cdn.tiktok-row.net' : 'https://ife-cdn.byteintl.net';
const DEFAULT_DIR = process.env.CDN_DIR || 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design';
const DEFAULT_REGION = process.env.CDN_REGION || 'SG';
const DEFAULT_EMAIL = process.env.CDN_EMAIL || 'zzhen.0325@bytedance.com';
function buildUrl(dir, fileName) {
    return `${CDN_BASE}/${dir}/${fileName}`;
}
async function postForm(pathName, form) {
    const url = `${'https://ife-cdn.tiktok-row.net'}${pathName}`;
    let res;
    try {
        res = await (0, undici_1.fetch)(url, {
            method: 'POST',
            body: form,
            // undici fetch options
            // @ts-expect-error connectTimeout is supported by undici but not in standard fetch types
            connectTimeout: 5000,
        });
    }
    catch (err) {
        const error = err;
        console.error('[CDN Fetch Error]', { url, error: error.message, code: error.code });
        throw new Error(`[cdn] Failed to fetch ${url}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
    }
    let data = null;
    const text = await res.text().catch(() => '');
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        data = text || {};
    }
    const code = typeof data === 'object' && data !== null ? data.code : undefined;
    const message = (typeof data === 'object' && data !== null && data.message) ||
        (typeof data === 'string' && data) ||
        `CDN request failed: ${res.status}`;
    const success = res.ok && (code === 0 || code === undefined || code === 200);
    if (!success) {
        console.error('[CDN Error Detail]', { url, status: res.status, code, data, text: text.slice(0, 500) });
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        const detail = text ? ` body=${text}` : '';
        throw new Error(`[cdn ${res.status}] ${msg}${detail}`);
    }
    return data;
}
function makeFileName(name) {
    if (name)
        return name;
    const stamp = Date.now();
    return `img_${stamp}_${(0, crypto_1.randomUUID)().slice(0, 6)}.png`;
}
async function uploadBufferToCdn(buffer, opts = {}) {
    const fileName = makeFileName(opts.fileName);
    const dir = opts.dir || DEFAULT_DIR;
    const region = opts.region || DEFAULT_REGION;
    const email = opts.email || DEFAULT_EMAIL;
    const form = new undici_1.FormData();
    form.set('dir', dir);
    form.set('region', region);
    form.set('fileName', fileName);
    form.set('email', email);
    form.set('file', new undici_1.File([buffer], fileName, { type: opts.mimeType || 'image/png' }));
    const resp = await postForm('/cdn/upload', form);
    const finalFileName = resp.fileName || resp.files?.[0] || fileName;
    let finalUrl = resp.cdnUrl;
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl.replace(/^\/\//, '')}`;
    }
    if (!finalUrl || !/^https?:\/\//i.test(finalUrl)) {
        throw new Error(`[cdn] Invalid response: missing or malformed cdnUrl. resp=${JSON.stringify(resp)}`);
    }
    console.log('[cdn-upload]', { dir, region, email, finalFileName, cdnUrl: finalUrl });
    return {
        url: finalUrl,
        dir,
        fileName: finalFileName,
    };
}
function buildCdnPath(subdir, fileName, region = DEFAULT_REGION) {
    const dir = path_1.default.posix.join(DEFAULT_DIR, subdir).replace(/\\/g, '/');
    // 当前域名未体现 region，保留参数便于未来切换
    void region;
    return buildUrl(dir, fileName);
}
