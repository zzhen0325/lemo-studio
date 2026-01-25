"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
class HttpError extends Error {
    status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.HttpError = HttpError;
