/**
 * 强制下载图片文件
 * 通过 fetch 获取图片 Blob 数据，确保浏览器直接下载而不是预览
 * 
 * @param url 图片 URL
 * @param filename 建议的下载文件名
 */
export async function downloadImage(url: string, filename?: string) {
    const fallback = () => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `image-${Date.now()}.png`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    try {
        // 如果是 base64 数据，直接通过 Blob 下载
        if (url.startsWith('data:')) {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || `image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            return;
        }

        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');

        const blob = await response.blob();
        // 确保 blob 是有效的图像类型，如果不是则触发 fallback
        if (blob.size === 0 || !blob.type.startsWith('image/')) {
            console.warn('Downloaded blob is empty or not an image:', blob.type);
            fallback();
            return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || `image-${Date.now()}.png`;

        document.body.appendChild(link);
        link.click();

        // 延迟清理，确保点击生效
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
        console.error('Download via fetch failed, using fallback:', error);
        fallback();
    }
}
