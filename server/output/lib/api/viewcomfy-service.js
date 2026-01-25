"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewComfyService = void 0;
const settings_service_1 = require("./settings-service");
const errors_1 = require("../../app/models/errors");
const settingsService = new settings_service_1.SettingsService();
class ViewComfyService {
    async getViewComfyApp(appId, token) {
        const response = await fetch(`${settingsService.getViewComfyCloudApiUrl()}/viewcomfy-app/app/${appId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 404) {
                const body = await response.json();
                const message = body.errorMsg || "ViewComfy app not found";
                const errors = body.errorDetails ? [body.errorDetails] : ["ViewComfy app not found"];
                const error = new errors_1.ErrorBase({
                    message: message,
                    errorType: errors_1.ErrorTypes.VIEW_MODE_MISSING_APP_ID,
                    errors: errors
                });
                console.error(error);
                throw error;
            }
            else {
                const error = new errors_1.ErrorBase({
                    message: 'Failed to fetch ViewComfy app',
                    errorType: errors_1.ErrorTypes.VIEW_MODE_MISSING_APP_ID,
                    errors: ['Failed to fetch ViewComfy app']
                });
                console.error(error);
                throw error;
            }
        }
        const viewComfyApp = await response.json();
        return viewComfyApp;
    }
    async getViewComfyAppSecrets(appId, token) {
        const response = await fetch(`${settingsService.getViewComfyCloudApiUrl()}/viewcomfy-app/secrets/${appId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const body = await response.json();
            const message = body.errorMsg || "Failed to fetch ViewComfy app secrets";
            const errors = body.errorDetails ? [body.errorDetails] : ["Failed to fetch ViewComfy app secrets"];
            const error = new errors_1.ErrorBase({
                message: message,
                errorType: errors_1.ErrorTypes.VIEW_MODE_MISSING_APP_ID,
                errors: errors
            });
            console.error(error);
            throw error;
        }
        const viewComfyAppSecrets = await response.json();
        return viewComfyAppSecrets;
    }
}
exports.ViewComfyService = ViewComfyService;
