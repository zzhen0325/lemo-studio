import type { IMultiValueInput } from './workflow-api-parser';

export interface IViewComfyBase {
    title: string;
    description: string;
    textOutputEnabled?: boolean;
    viewcomfyEndpoint?: string;
    coverImage?: string;
    previewImages: string[];
    inputs: IMultiValueInput[];
    advancedInputs: IMultiValueInput[];
    mappingConfig?: {
        components: unknown[];
    };
}

export interface IViewComfyDraft {
    viewComfyJSON: IViewComfyBase;
    workflowApiJSON?: object | undefined;
    file?: File | undefined;
}

export interface IViewComfyWorkflow extends IViewComfyBase {
    id: string;
}

export interface IViewComfyJSON {
    appTitle?: string;
    appImg?: string;
    file_type?: string;
    file_version?: string;
    version?: string;
    viewComfys: IViewComfy[];
}

export interface IViewComfy {
    viewComfyJSON: IViewComfyWorkflow;
    workflowApiJSON?: object | undefined;
    file?: File | undefined;
}

export interface IViewComfyState {
    appTitle?: string;
    appImg?: string;
    viewComfys: IViewComfy[];
    viewComfyDraft: IViewComfyDraft | undefined;
    currentViewComfy: IViewComfy | undefined;
}
