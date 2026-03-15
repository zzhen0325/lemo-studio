export class SettingsService {

    public getViewComfyCloudApiUrl(): string {
        if (!process.env.VIEWCOMFY_CLOUD_API_URL) {
            throw new Error("VIEWCOMFY_CLOUD_API_URL is not set");
        }
        return process.env.VIEWCOMFY_CLOUD_API_URL;
    }

    public getViewComfyCloudApiClientId(): string {
        return process.env.VIEWCOMFY_CLIENT_ID || "";
    }

    public getViewComfyCloudApiClientSecret(): string {
        return process.env.VIEWCOMFY_CLIENT_SECRET || "";
    }
}
