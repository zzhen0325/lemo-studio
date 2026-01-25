"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowAPItoViewComfy = workflowAPItoViewComfy;
const constants_1 = require("./constants");
function workflowAPItoViewComfy(source) {
    let basicInputs = [];
    let advancedInputs = [];
    for (const [key, value] of Object.entries(source)) {
        const inputs = [];
        for (const node of Object.entries(value.inputs)) {
            const input = parseInputField({ node: { key: node[0], value: node[1] }, path: [key, "inputs"] });
            if (input) {
                inputs.push(input);
            }
        }
        try {
            switch (value.class_type) {
                case 'CLIPTextEncode':
                    if (inputs.length > 0) {
                        const input = inputs[0];
                        input.valueType = "long-text";
                        input.title = getTitleFromValue(value.class_type, value);
                        input.placeholder = getTitleFromValue(value.class_type, value);
                        basicInputs.push({
                            title: getTitleFromValue(value.class_type, value),
                            inputs: inputs,
                            key: `${key}-${value.class_type}`
                        });
                    }
                    break;
                case "LoadImage":
                case "LoadImageMask":
                    const input = inputs[0];
                    input.valueType = "image";
                    input.title = getTitleFromValue(value.class_type, value);
                    input.placeholder = getTitleFromValue(value.class_type, value);
                    input.value = null;
                    basicInputs.push({
                        title: getTitleFromValue(value.class_type, value),
                        inputs: [input],
                        key: `${key}-${value.class_type}`
                    });
                    break;
                case "VHS_LoadVideo":
                    const uploadInputIndex = inputs.findIndex(input => input.title === "Video");
                    if (typeof uploadInputIndex !== "undefined") {
                        inputs[uploadInputIndex].valueType = "video";
                        inputs[uploadInputIndex].value = null;
                    }
                    basicInputs.push({
                        title: getTitleFromValue(value.class_type, value),
                        inputs: inputs,
                        key: `${key}-${value.class_type}`
                    });
                    break;
                default:
                    for (const input of inputs) {
                        if (constants_1.SEED_LIKE_INPUT_VALUES.includes(input.title.toLowerCase())) {
                            input.valueType = "seed";
                        }
                    }
                    if (inputs.length > 0) {
                        advancedInputs.push({
                            title: getTitleFromValue(value.class_type, value),
                            inputs: inputs,
                            key: `${key}-${value.class_type}`
                        });
                    }
                    break;
            }
        }
        catch (e) {
            console.log("Error", e);
        }
    }
    if (basicInputs.length === 0) {
        basicInputs = [...advancedInputs];
        advancedInputs = [];
    }
    return { inputs: basicInputs, advancedInputs, title: "", description: "", previewImages: [] };
}
// function getMin(value: string): number | undefined {
//     switch (value) {
//         case "风格强度":
//             return 0;
//         default:
//             return 0;
//     }
// }
// function getMax(value: string): number | undefined {
//     switch (value) {
//         case "风格强度":
//             return 1;
//         default:
//             return undefined;
//     }
// }
// function getStep(value: string): number | undefined {
//     switch (value) {
//         case "风格强度":
//             return 0.1;
//         default:
//             return 1;
//     }
// }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInputField(args) {
    const { node, path } = args;
    let input = undefined;
    if (Array.isArray(node.value)) {
        return undefined;
    }
    // TODO: Add error field to add errors like local urls for image inputs.
    try {
        if (node.value !== null && node.value !== undefined && typeof node.value !== 'object') {
            const workflowPath = [...path, node.key];
            input = {
                title: capitalize(node.key),
                placeholder: capitalize(node.key),
                value: node.value,
                workflowPath,
                helpText: "Helper Text",
                // min: getMin(node.value),
                // max: getMax(node.value),
                // step: getStep(node.value),
                valueType: parseValueType(node.value), // 这里会把input的类型写入
                validations: { required: true },
                key: workflowPath.join("-"),
            };
        }
        else if (typeof node.value === 'object' && node.value !== null) {
            // TODO: Handle nested objects
            console.log("Nested object", node.value);
        }
    }
    catch (e) {
        console.log("Error", e);
    }
    return input;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseValueType(value) {
    switch (typeof value) {
        case 'string':
            return 'string';
        case 'number':
            if (value.toString().indexOf('.') !== -1) {
                return 'float';
            }
            return 'number';
        case 'bigint':
            return 'bigint';
        case 'boolean':
            return 'boolean';
        default:
            return 'string';
    }
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function getTitleFromValue(class_type, value) {
    return value._meta?.title || class_type;
}
