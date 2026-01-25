"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveImageService = void 0;
const zod_1 = require("zod");
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const cdn_1 = require("../utils/cdn");
const db_1 = require("../db");
const BodySchema = zod_1.z.object({
    imageBase64: zod_1.z.string(),
    ext: zod_1.z.string().optional().default('png'),
    subdir: zod_1.z.string().optional().default('outputs'),
    metadata: zod_1.z.any().optional(),
});
function extractBase64(data) {
    const match = data.match(/^data:(.*?);base64,(.*)$/);
    if (match) {
        return { base64: match[2], mime: match[1] };
    }
    return { base64: data };
}
function normalizeExt(ext) {
    return ext === 'jpeg' ? 'jpg' : ext;
}
function getExtFromMime(mime) {
    if (!mime)
        return undefined;
    const m = mime.toLowerCase();
    if (m.includes('jpeg') || m.includes('jpg'))
        return 'jpg';
    if (m.includes('png'))
        return 'png';
    if (m.includes('webp'))
        return 'webp';
    if (m.includes('gif'))
        return 'gif';
    return undefined;
}
function tryExtractImageUrlFromHtml(html) {
    const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
    if (og && /^https?:\/\//i.test(og))
        return og;
    const metaRefresh = html.match(/http-equiv=["']refresh["'][^>]*content=["']([^"']*url=)?([^"'>\s]+)["']/i);
    const nextUrl = metaRefresh ? (metaRefresh[2] || metaRefresh[1]) : null;
    if (nextUrl && /^https?:\/\//i.test(nextUrl))
        return nextUrl;
    const direct = html.match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/i)?.[0];
    if (direct)
        return direct;
    const imgTag = html.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1];
    if (imgTag && /^https?:\/\//i.test(imgTag))
        return imgTag;
    return null;
}
async function fetchImageBuffer(url, depth = 0) {
    const resp = await fetch(url, {
        headers: {
            accept: 'image/*,*/*;q=0.8',
        },
    });
    if (!resp.ok) {
        const snippet = await resp.text().catch(() => '');
        throw new Error(`Failed to download image: status=${resp.status} url=${url} body=${snippet.slice(0, 200)}`);
    }
    const contentType = resp.headers.get('content-type');
    const mime = contentType?.split(';')[0]?.trim();
    if (mime?.startsWith('image/')) {
        const arrayBuffer = await resp.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), mime };
    }
    const text = await resp.text().catch(() => '');
    if (depth < 1) {
        const nextUrl = tryExtractImageUrlFromHtml(text);
        if (nextUrl) {
            return fetchImageBuffer(nextUrl, depth + 1);
        }
    }
    throw new Error(`Downloaded content is not an image: mime=${mime || 'unknown'} url=${url} body=${text.slice(0, 500)}`);
}
let SaveImageService = class SaveImageService {
    imageAssetModel;
    async save(body) {
        console.log('[SaveImageService] request body keys:', typeof body === 'object' && body ? Object.keys(body) : 'none');
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            console.error('[SaveImageService] validation failed:', parsed.error.flatten());
            throw new http_error_1.HttpError(400, 'Invalid payload', parsed.error.flatten());
        }
        const { imageBase64, subdir } = parsed.data;
        let ext = normalizeExt(parsed.data.ext);
        let inferredMime;
        let imageBuffer;
        if (imageBase64.startsWith('http')) {
            console.log('[SaveImageService] fetching URL:', imageBase64);
            const downloaded = await fetchImageBuffer(imageBase64);
            console.log('[SaveImageService] downloaded size:', downloaded.buffer.length, 'mime:', downloaded.mime);
            const inferred = getExtFromMime(downloaded.mime);
            if (inferred)
                ext = inferred;
            imageBuffer = downloaded.buffer;
            inferredMime = downloaded.mime;
        }
        else {
            console.log('[SaveImageService] processing base64');
            const { base64, mime } = extractBase64(imageBase64);
            const inferred = getExtFromMime(mime);
            if (inferred)
                ext = inferred;
            imageBuffer = Buffer.from(base64, 'base64');
            inferredMime = mime;
            console.log('[SaveImageService] base64 size:', imageBuffer.length, 'mime:', mime);
        }
        const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/${subdir}`;
        console.log('[SaveImageService] uploading to CDN:', { filename, dir, inferredMime });
        const cdnRes = await (0, cdn_1.uploadBufferToCdn)(imageBuffer, {
            fileName: filename,
            dir,
            region: 'SG',
            mimeType: inferredMime
        });
        console.log('[SaveImageService] upload success:', cdnRes.url);
        await this.imageAssetModel.create({
            url: cdnRes.url,
            dir: cdnRes.dir,
            fileName: cdnRes.fileName,
            region: 'SG',
            type: subdir === 'outputs' ? 'generation' : 'upload',
            meta: parsed.data.metadata ?? undefined,
        });
        return { path: cdnRes.url };
    }
};
exports.SaveImageService = SaveImageService;
__decorate([
    (0, gulux_1.Inject)(db_1.ImageAsset),
    __metadata("design:type", Object)
], SaveImageService.prototype, "imageAssetModel", void 0);
exports.SaveImageService = SaveImageService = __decorate([
    (0, gulux_1.Injectable)()
], SaveImageService);
