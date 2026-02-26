/**
 * Aspect Ratio 配置常量
 * 定义了各种宽高比在不同分辨率下的具体尺寸
 */

export type ImageSize = '1K' | '2K' | '4K';

export interface SizeDimensions {
    w: number;
    h: number;
}

export type AspectRatioMap = Record<string, Record<ImageSize, SizeDimensions>>;

export const AR_MAP: AspectRatioMap = {
    '1:1': { '1K': { w: 1024, h: 1024 }, '2K': { w: 2048, h: 2048 }, '4K': { w: 4096, h: 4096 } },
    '2:3': { '1K': { w: 848, h: 1264 }, '2K': { w: 1696, h: 2528 }, '4K': { w: 3392, h: 5056 } },
    '3:2': { '1K': { w: 1264, h: 848 }, '2K': { w: 2528, h: 1696 }, '4K': { w: 5056, h: 3392 } },
    '3:4': { '1K': { w: 896, h: 1200 }, '2K': { w: 1792, h: 2400 }, '4K': { w: 3584, h: 4800 } },
    '4:3': { '1K': { w: 1200, h: 896 }, '2K': { w: 2400, h: 1792 }, '4K': { w: 4800, h: 3584 } },
    '4:5': { '1K': { w: 928, h: 1152 }, '2K': { w: 1856, h: 2304 }, '4K': { w: 3712, h: 4608 } },
    '5:4': { '1K': { w: 1152, h: 928 }, '2K': { w: 2304, h: 1856 }, '4K': { w: 4608, h: 3712 } },
    '9:16': { '1K': { w: 768, h: 1376 }, '2K': { w: 1536, h: 2752 }, '4K': { w: 3072, h: 5504 } },
    '16:9': { '1K': { w: 1376, h: 768 }, '2K': { w: 2752, h: 1536 }, '4K': { w: 5504, h: 3072 } },
    '21:9': { '1K': { w: 1584, h: 672 }, '2K': { w: 3168, h: 1344 }, '4K': { w: 6336, h: 2688 } },
};

export interface AspectRatioPreset {
    name: string;
    width: number;
    height: number;
}

/**
 * 获取所有宽高比预设列表（使用 1K 分辨率作为默认尺寸）
 */
export const getAspectRatioPresets = (): AspectRatioPreset[] => {
    return Object.keys(AR_MAP).map(name => ({
        name,
        width: AR_MAP[name]['1K'].w,
        height: AR_MAP[name]['1K'].h
    }));
};

/**
 * 根据当前宽高获取对应的宽高比名称
 */
export const getAspectRatioByDimensions = (width: number, height: number): string => {
    const sizeKeys: ImageSize[] = ['1K', '2K', '4K'];
    for (const [ar, sizes] of Object.entries(AR_MAP)) {
        for (const size of sizeKeys) {
            if (sizes[size].w === width && sizes[size].h === height) return ar;
        }
    }
    return "16:9"; // 默认值
};

/**
 * 根据宽高比和图片尺寸获取具体大小
 */
export const getDimensionsByAspectRatio = (
    aspectRatio: string,
    imageSize: ImageSize = '1K'
): SizeDimensions | undefined => {
    return AR_MAP[aspectRatio]?.[imageSize];
};
