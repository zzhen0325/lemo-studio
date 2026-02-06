import { ComfyWorkflowError } from "../app/models/errors";

interface ErrorInfo {
    message: string;
    details: string;
}

interface WorkflowNodeError {
    errors: ErrorInfo[];
    class_type: string;
}

type ErrorDict = Record<string, WorkflowNodeError>;

export class ComfyErrorHandler {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public tryToParseWorkflowError(error: any): ComfyWorkflowError | undefined {
        try {
            if (error.node_errors) {
                return new ComfyWorkflowError({
                    message: error.message,
                    errors: this.extractErrors(error.node_errors)
                });
            }
            return new ComfyWorkflowError({
                message: "Error running workflow",
                errors: this.extractErrors(error.message)
            });
        } catch (error) {
            console.error("Error parsing JSON. The extracted string might not be valid JSON.", error);
            return undefined;
        }
    }

    private extractErrors(errorDict: unknown): string[] {
        if (!errorDict || typeof errorDict !== "object") {
            return [String(errorDict ?? "Unknown error")];
        }

        const errorMessages: string[] = [];
        for (const [, nodeError] of Object.entries(errorDict as ErrorDict)) {
            if (!nodeError || typeof nodeError !== "object") {
                errorMessages.push(String(nodeError));
                continue;
            }
            const errors = Array.isArray(nodeError.errors) ? nodeError.errors : [];
            let errorMsgs = "";
            for (const error of errors) {
                errorMsgs += `${error.details}: ${error.message}, `;
            }
            const classType = nodeError.class_type ? nodeError.class_type : "UnknownNode";
            if (errorMsgs) {
                errorMessages.push(`${classType}: ${errorMsgs}`);
            } else if ("message" in nodeError && typeof (nodeError as { message?: unknown }).message === "string") {
                errorMessages.push(`${classType}: ${(nodeError as { message: string }).message}`);
            } else {
                errorMessages.push(classType);
            }
        }

        return errorMessages.length > 0 ? errorMessages : [String(errorDict)];
    }
}
