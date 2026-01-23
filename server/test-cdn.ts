
import { uploadBufferToCdn } from './utils/cdn';
import fs from 'fs';
import path from 'path';

async function testUpload() {
    console.log('--- Starting CDN Upload Test (No Proxy) ---');

    // 修正环境加载逻辑：定位到项目根目录的 .env.local
    const rootDir = path.resolve(__dirname, '..');
    const envPath = path.join(rootDir, '.env.local');

    if (fs.existsSync(envPath)) {
        console.log('Loading environment from:', envPath);
        const content = fs.readFileSync(envPath, 'utf8');
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
    } else {
        console.warn('.env.local not found at:', envPath);
    }

    console.log('CDN_BASE_URL:', process.env.CDN_BASE_URL);

    try {
        const testContent = Buffer.from('Hello, this is a test for CDN upload (No Proxy) ' + new Date().toISOString());

        console.log('Uploading file...');
        const result = await uploadBufferToCdn(testContent, {
            fileName: `test_no_proxy_${Date.now()}.txt`,
            dir: 'test_uploads',
            mimeType: 'text/plain'
        });

        console.log('Upload Result:', JSON.stringify(result, null, 2));
        console.log('Success! File URL:', result.url);
    } catch (error: any) {
        console.error('Upload Failed!');
        console.error('Error Message:', error.message);
    }
}

testUpload();
