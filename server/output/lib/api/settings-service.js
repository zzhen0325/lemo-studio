"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
class SettingsService {
    getViewComfyCloudApiUrl() {
        if (!process.env.VIEWCOMFY_CLOUD_API_URL) {
            throw new Error("VIEWCOMFY_CLOUD_API_URL is not set");
        }
        return process.env.VIEWCOMFY_CLOUD_API_URL;
    }
    getViewComfyCloudApiClientId() {
        return process.env.VIEWCOMFY_CLIENT_ID || "";
    }
    getViewComfyCloudApiClientSecret() {
        return process.env.VIEWCOMFY_CLIENT_SECRET || "";
    }
}
exports.SettingsService = SettingsService;
