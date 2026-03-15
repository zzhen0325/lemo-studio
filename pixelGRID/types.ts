export enum PixelShape {
    SQUARE = 'SQUARE',
    CIRCLE = 'CIRCLE',
    TRIANGLE = 'TRIANGLE'
}

export enum ScaleMode {
    FIT = 'FIT',
    FILL = 'FILL'
}

export enum MediaType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO'
}

export interface GridParams {
    masterSpeed: number;
    gridDensity: number;
    clusterThreshold: number;
    sizeScale: number;
    minPixelFilter: number;
    rotationChaos: number;
    redNoiseIntensity: number;
    pixelShape: PixelShape;
    imageScaleMode: ScaleMode;
    colorPalette?: string[];
    backgroundColor?: string;
    [key: string]: any;
}
