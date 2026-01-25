"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyErrorHandler = void 0;
const errors_1 = require("../app/models/errors");
class ComfyErrorHandler {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tryToParseWorkflowError(error) {
        try {
            if (error.node_errors) {
                return new errors_1.ComfyWorkflowError({
                    message: error.message,
                    errors: this.extractErrors(error.node_errors)
                });
            }
            return new errors_1.ComfyWorkflowError({
                message: "Error running workflow",
                errors: this.extractErrors(error.message)
            });
        }
        catch (error) {
            console.error("Error parsing JSON. The extracted string might not be valid JSON.", error);
            return undefined;
        }
    }
    extractErrors(errorDict) {
        const errorMessages = [];
        for (const [, nodeError] of Object.entries(errorDict)) {
            let errorMsgs = "";
            for (const error of nodeError.errors) {
                errorMsgs += `${error.details}: ${error.message}, `;
            }
            errorMessages.push(`${nodeError.class_type}: ${errorMsgs}`);
        }
        return errorMessages;
    }
}
exports.ComfyErrorHandler = ComfyErrorHandler;
