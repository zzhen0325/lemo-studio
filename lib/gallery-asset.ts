/**
 * Gallery 图片解析工具
 * 
 * 解析优先级：
 * 1. 如果值是 storageKey（ljhwZthlaukjlkulzlp/...），转成 /storage/image?key=...
 * 2. 如果值是对象存储的 presigned URL，先提取 storageKey，再转成 /storage/image?key=...
 * 3. 如果值是普通第三方外链，直接使用原始 URL
 * 
 * 禁止走 /api/proxy-image?url=...，因为线上 403 已证明服务端代抓不稳定
 */

import { getApiBase } from './api-base';

/**
 * 对象存储 presigned URL 的域名模式
 */
const STORAGE_DOMAINS = [
  'coze-coding-project.tos.coze.site',
  'tos.coze.site',
];

/**
 * 对象存储路径前缀（storageKey 开头）
 */
const STORAGE_KEY_PREFIX = 'ljhwZthlaukjlkulzlp/';

/**
 * 从对象存储 presigned URL 中提取 storageKey
 * 
 * 示例 URL:
 * https://coze-coding-project.tos.coze.site/coze_storage_xxx/ljhwZthlaukjlkulzlp/Lemon8_Activity/...?sign=...
 * 
 * 提取结果:
 * ljhwZthlaukjlkulzlp/Lemon8_Activity/...
 */
function extractStorageKeyFromPresignedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // 检查是否是对象存储域名
    const isStorageDomain = STORAGE_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
    
    if (!isStorageDomain) {
      return null;
    }
    
    // 从路径中提取 storageKey
    // 路径格式: /coze_storage_xxx/ljhwZthlaukjlkulzlp/...?sign=...
    const pathParts = parsed.pathname.split('/');
    
    // 查找 storageKey 开始的位置
    const storageKeyIndex = pathParts.findIndex(part => part === 'ljhwZthlaukjlkulzlp');
    
    if (storageKeyIndex === -1) {
      return null;
    }
    
    // 提取从 storageKey 开始的完整路径（不含查询参数）
    const storageKey = pathParts.slice(storageKeyIndex).join('/');
    
    return storageKey || null;
  } catch {
    return null;
  }
}

/**
 * Gallery 专用图片解析函数
 * 
 * @param url - 原始图片 URL（可能是 storageKey、presigned URL 或普通外链）
 * @returns 解析后的图片 URL
 */
export function resolveGalleryImageUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }
  
  // 1. 处理本地存储 ID
  if (url.startsWith('local:')) {
    return url;
  }
  
  // 2. 处理 data: 和 blob: URL
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // 3. 处理 storageKey 格式（ljhwZthlaukjlkulzlp/...）
  if (url.startsWith(STORAGE_KEY_PREFIX)) {
    const apiBase = getApiBase();
    return `${apiBase}/storage/image?key=${encodeURIComponent(url)}`;
  }
  
  // 4. 处理本地静态资源（以 / 开头）
  if (url.startsWith('/')) {
    return url;
  }
  
  // 5. 处理 HTTP(S) URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // 尝试从 presigned URL 中提取 storageKey
    const storageKey = extractStorageKeyFromPresignedUrl(url);
    
    if (storageKey) {
      // 成功提取 storageKey，转换为 /storage/image
      const apiBase = getApiBase();
      return `${apiBase}/storage/image?key=${encodeURIComponent(storageKey)}`;
    }
    
    // 6. 普通第三方外链，直接返回原始 URL
    return url;
  }
  
  // 7. 其他情况，返回原始值
  return url;
}

/**
 * 批量解析图片 URL
 */
export function resolveGalleryImageUrls(urls: (string | undefined | null)[]): string[] {
  return urls
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map(resolveGalleryImageUrl);
}
