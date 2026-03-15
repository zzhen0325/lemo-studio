import { useState, useCallback } from 'react';
import { generateText, describeImage, ClientGenerationParams, ClientDescribeParams } from './client';

interface UseModelTextResult {
    loading: boolean;
    error: Error | null;
    generate: (params: ClientGenerationParams) => Promise<string>;
    data: string | null;
}

export function useModelText(): UseModelTextResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<string | null>(null);

    const generate = useCallback(async (params: ClientGenerationParams) => {
        setLoading(true);
        setError(null);
        try {
            const result = await generateText(params);
            setData(result.text);
            return result.text;
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, error, generate, data };
}

interface UseModelDescribeResult {
    loading: boolean;
    error: Error | null;
    describe: (params: ClientDescribeParams) => Promise<string>;
    data: string | null;
}

export function useModelDescribe(): UseModelDescribeResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<string | null>(null);

    const describe = useCallback(async (params: ClientDescribeParams) => {
        setLoading(true);
        setError(null);
        try {
            const result = await describeImage(params);
            setData(result.text);
            return result.text;
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, error, describe, data };
}
