import { extractErrorInfo } from "../error-message";

export class ErrorBase {
    public message: string;
    public errors: string[];
    public errorType: ErrorTypes;

    constructor(args: { message: string, errorType: ErrorTypes, errors?: string[] }) {
        this.message = args.message;
        this.errorType = args.errorType;
        this.errors = args.errors || [];
    }
}

export class ComfyWorkflowError extends ErrorBase {

    constructor(args: { message: string, errors: string[] }) {
        super({ message: args.message, errorType: ErrorTypes.COMFY_WORKFLOW, errors: args.errors });
    }
}

export class ComfyError extends ErrorBase {

    constructor(args: { message: string, errors: string[] }) {
        super({ message: args.message, errorType: ErrorTypes.COMFY, errors: args.errors });
    }
}



export class ResponseError extends Error {

    public errorMsg: string;
    public errorDetails: string | string[];
    public errorType: ErrorTypes;

    constructor(args: { errorMsg: string, error: string | string[], errorType: ErrorTypes }) {
        const detailText = Array.isArray(args.error)
            ? args.error.filter(Boolean).join("; ")
            : args.error;
        super(detailText && detailText !== args.errorMsg
            ? `${args.errorMsg}: ${detailText}`
            : args.errorMsg);
        Object.setPrototypeOf(this, ResponseError.prototype);
        this.name = "ResponseError";
        this.errorMsg = args.errorMsg;
        this.errorDetails = args.error;
        this.errorType = args.errorType;
    }
}

export class ErrorResponseFactory {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getErrorResponse(error: any): ResponseError {
        const info = extractErrorInfo(error, "Request failed");
        const details = info.details.length > 0 ? info.details : [];

        if (error.errorType) {
            return new ResponseError({
                errorMsg: info.message,
                error: details.length > 0 ? details : (error.errors || []),
                errorType: error.errorType
            });
        } else if (error.cause && error.cause.code) {
            // TODO: make proper error handling for ViewComfy API requests
            if (error.cause.code === "ERR_INVALID_URL") {
                return new ResponseError({
                    errorMsg: info.message,
                    error: details.length > 0 ? details : "Invalid API Endpoint",
                    errorType: error.cause.code
                });
            } else {
                return new ResponseError({
                    errorMsg: info.message,
                    error: details.length > 0 ? details : error.cause.message,
                    errorType: error.cause.code
                });
            }
        }

        return new ResponseError({
            errorMsg: info.message,
            error: details,
            errorType: ErrorTypes.UNKNOWN
        });
    }
}

export enum ErrorTypes {
    COMFY_WORKFLOW = "ComfyWorkflowError",
    COMFY = "ComfyError",
    UNKNOWN = "UnknownError",
    VIEW_MODE_MISSING_FILES = "ViewModeMissingFilesError",
    VIEW_MODE_MISSING_APP_ID = "ViewModeMissingAppIdError",
    VIEW_MODE_TIMEOUT = "ViewModeTimeoutError",
}
