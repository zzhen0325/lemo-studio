"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTINGS_STORAGE_KEY = exports.UPLOAD_PREVIEW_IMAGES_PATH = exports.SEED_LIKE_INPUT_VALUES = exports.ComfyUIConnRefusedError = exports.missingViewComfyFileError = exports.viewComfyFileName = void 0;
exports.viewComfyFileName = process.env.VIEW_COMFY_FILE_NAME || "workflows/index.json";
exports.missingViewComfyFileError = `The workflow configuration is missing from your project. \nEnsure you have either a 'workflows' directory with index.json or a view_comfy.json file in the root, \nor set the VIEW_COMFY_FILE_NAME environment variable to the right path.`;
const ComfyUIConnRefusedError = (comfyUrl) => {
    return `Cannot connect to ComfyUI using ${comfyUrl}, make sure that you have a ComfyUI instance running and that the URL is correct \nor you can change the ComfyUI URL in the .env file using the variables COMFYUI_API_URL and if you're using SSL/TLS set COMFYUI_SECURE to true`;
};
exports.ComfyUIConnRefusedError = ComfyUIConnRefusedError;
exports.SEED_LIKE_INPUT_VALUES = ["seed", "noise_seed", "rand_seed"];
exports.UPLOAD_PREVIEW_IMAGES_PATH = "preview_images";
exports.SETTINGS_STORAGE_KEY = "playground-settings";
