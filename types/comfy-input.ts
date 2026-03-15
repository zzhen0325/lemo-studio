import type { IInput } from "@/types/input";

export interface IViewComfy {
    inputs: IInput[];
    textOutputEnabled?: boolean;
}

export interface IComfyInput {
    viewComfy: IViewComfy;
    workflow?: object;
}
