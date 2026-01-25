"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cdn_1 = require("./utils/cdn");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function testUpload() {
    console.log('--- Starting CDN Upload Test (No Proxy) ---');
    // 修正环境加载逻辑：定位到项目根目录的 .env.local
    const rootDir = path_1.default.resolve(__dirname, '..');
    const envPath = path_1.default.join(rootDir, '.env.local');
    if (fs_1.default.existsSync(envPath)) {
        console.log('Loading environment from:', envPath);
        const content = fs_1.default.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const idx = trimmed.indexOf('=');
                if (idx !== -1) {
                    const key = trimmed.substring(0, idx).trim();
                    const val = trimmed.substring(idx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
                    process.env[key] = val;
                }
            }
        });
    }
    else {
        console.warn('.env.local not found at:', envPath);
    }
    console.log('CDN_BASE_URL:', process.env.CDN_BASE_URL);
    try {
        const testContent = Buffer.from('Hello, this is a test for CDN upload (No Proxy) ' + new Date().toISOString());
        console.log('Uploading file...');
        const result = await (0, cdn_1.uploadBufferToCdn)(testContent, {
            fileName: `test_no_proxy_${Date.now()}.txt`,
            dir: 'test_uploads',
            mimeType: 'text/plain'
        });
        console.log('Upload Result:', JSON.stringify(result, null, 2));
        console.log('Success! File URL:', result.url);
    }
    catch (error) {
        console.error('Upload Failed!');
        console.error('Error Message:', error.message);
    }
}
testUpload();
