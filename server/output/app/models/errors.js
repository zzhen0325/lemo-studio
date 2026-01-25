"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorTypes = exports.ErrorResponseFactory = exports.ResponseError = exports.ComfyError = exports.ComfyWorkflowError = exports.ErrorBase = void 0;
class ErrorBase {
    message;
    errors;
    errorType;
    constructor(args) {
        this.message = args.message;
        this.errorType = args.errorType;
        this.errors = args.errors || [];
    }
}
exports.ErrorBase = ErrorBase;
class ComfyWorkflowError extends ErrorBase {
    constructor(args) {
        super({ message: args.message, errorType: ErrorTypes.COMFY_WORKFLOW, errors: args.errors });
    }
}
exports.ComfyWorkflowError = ComfyWorkflowError;
class ComfyError extends ErrorBase {
    constructor(args) {
        super({ message: args.message, errorType: ErrorTypes.COMFY, errors: args.errors });
    }
}
exports.ComfyError = ComfyError;
class ResponseError {
    errorMsg;
    errorDetails;
    errorType;
    constructor(args) {
        this.errorMsg = args.errorMsg;
        this.errorDetails = args.error;
        this.errorType = args.errorType;
    }
}
exports.ResponseError = ResponseError;
class ErrorResponseFactory {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getErrorResponse(error) {
        if (error.errorType) {
            return new ResponseError({
                errorMsg: error.message,
                error: error.errors,
                errorType: error.errorType
            });
        }
        else if (error.cause && error.cause.code) {
            // TODO: make proper error handling for ViewComfy API requests
            if (error.cause.code === "ERR_INVALID_URL") {
                return new ResponseError({
                    errorMsg: error.message,
                    error: "Invalid API Endpoint",
                    errorType: error.cause.code
                });
            }
            else {
                return new ResponseError({
                    errorMsg: error.message,
                    error: error.cause.message,
                    errorType: error.cause.code
                });
            }
        }
        return new ResponseError({
            errorMsg: "Something went wrong",
            error: error.message,
            errorType: ErrorTypes.UNKNOWN
        });
    }
}
exports.ErrorResponseFactory = ErrorResponseFactory;
var ErrorTypes;
(function (ErrorTypes) {
    ErrorTypes["COMFY_WORKFLOW"] = "ComfyWorkflowError";
    ErrorTypes["COMFY"] = "ComfyError";
    ErrorTypes["UNKNOWN"] = "UnknownError";
    ErrorTypes["VIEW_MODE_MISSING_FILES"] = "ViewModeMissingFilesError";
    ErrorTypes["VIEW_MODE_MISSING_APP_ID"] = "ViewModeMissingAppIdError";
    ErrorTypes["VIEW_MODE_TIMEOUT"] = "ViewModeTimeoutError";
})(ErrorTypes || (exports.ErrorTypes = ErrorTypes = {}));
