"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useModelText = useModelText;
exports.useModelDescribe = useModelDescribe;
const react_1 = require("react");
const client_1 = require("./client");
function useModelText() {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [data, setData] = (0, react_1.useState)(null);
    const generate = (0, react_1.useCallback)(async (params) => {
        setLoading(true);
        setError(null);
        try {
            const result = await (0, client_1.generateText)(params);
            setData(result.text);
            return result.text;
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    }, []);
    return { loading, error, generate, data };
}
function useModelDescribe() {
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [data, setData] = (0, react_1.useState)(null);
    const describe = (0, react_1.useCallback)(async (params) => {
        setLoading(true);
        setError(null);
        try {
            const result = await (0, client_1.describeImage)(params);
            setData(result.text);
            return result.text;
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    }, []);
    return { loading, error, describe, data };
}
