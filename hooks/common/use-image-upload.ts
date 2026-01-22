import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getApiBase } from '@/lib/api-base';
import { useToast } from '@/hooks/common/use-toast';
import { UploadedImage } from '@/components/features/playground-v2/types';

export interface UploadOptions {
    onLocalPreview?: (image: UploadedImage) => void;
    onSuccess?: (id: string, path: string) => void;
    onError?: (id: string, error: any) => void;
}

export function useImageUpload() {
    const { toast } = useToast();

    const uploadFile = useCallback(async (file: File, options?: UploadOptions) => {
        if (!file.type.startsWith('image/')) {
            toast({ title: "上传失败", description: "仅支持图片文件", variant: "destructive" });
            return null;
        }

        const tempId = uuidv4();

        try {
            // 1. 生成本地预览和 base64
            const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(String(e.target?.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const base64Data = dataUrl.split(',')[1];

            // 2. 获取图片尺寸
            const dimensions: { width: number; height: number } = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve({ width: 0, height: 0 });
                img.src = dataUrl;
            });

            // 3. 构建上传对象 (不再持久化到本地 IndexedDB)
            const uploadedImage: UploadedImage = {
                id: tempId,
                file,
                base64: base64Data,
                previewUrl: dataUrl,
                isUploading: true,
                width: dimensions.width,
                height: dimensions.height
            };

            // 4. 触发本地预览回调
            options?.onLocalPreview?.(uploadedImage);

            // 5. 挂起后台上传 (不阻塞)
            (async () => {
                try {
                    const form = new FormData();
                    form.append('file', file);

                    const resp = await fetch(`${getApiBase()}/upload`, { 
                        method: 'POST', 
                        body: form 
                    });
                    
                    if (!resp.ok) throw new Error(`Upload failed with status ${resp.status}`);
                    
                    const json = await resp.json();
                    const path = json?.path ? String(json.path) : undefined;

                    if (path) {
                        options?.onSuccess?.(tempId, path);
                    } else {
                        throw new Error('No path returned from server');
                    }
                } catch (err) {
                    console.error("Background upload failed:", err);
                    options?.onError?.(tempId, err);
                    toast({ 
                        title: "上传失败", 
                        description: "图片上传到 CDN 失败，生成时可能受限", 
                        variant: "destructive" 
                    });
                }
            })();

            return uploadedImage;
        } catch (err) {
            console.error("Local image processing failed:", err);
            toast({ title: "处理失败", description: "无法处理选中的图片", variant: "destructive" });
            return null;
        }
    }, [toast]);

    return { uploadFile };
}
