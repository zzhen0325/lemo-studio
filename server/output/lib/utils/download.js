"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadImage = downloadImage;
/**
 * 强制下载图片文件
 * 通过 fetch 获取图片 Blob 数据，确保浏览器直接下载而不是预览
 *
 * @param url 图片 URL
 * @param filename 建议的下载文件名
 */
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || `image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    }
    catch (error) {
        console.error('Download failed:', error);
        // 回退到普通下载方式
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `image-${Date.now()}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
