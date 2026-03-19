
/**
 * Sanitize object keys for MongoDB.
 * Replaces dots ('.') with '_DOT_' to avoid BSON serialization errors.
 */
export function sanitizeMongoKeys(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object' || obj instanceof Date || obj instanceof RegExp) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeMongoKeys(item));
    }

    // Only recurse if it's a plain object (e.g. {}, new Object())
    // This prevents corruption of specialized objects like MongoDB's ObjectId
    if (obj.constructor !== Object) {
        return obj;
    }

    const result: Record<string, unknown> = {};
    const typedObj = obj as Record<string, unknown>;
    for (const key in typedObj) {
        if (Object.prototype.hasOwnProperty.call(typedObj, key)) {
            const sanitizedKey = key.replace(/\./g, '_DOT_');
            result[sanitizedKey] = sanitizeMongoKeys(typedObj[key]);
        }
    }
    return result;
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Restore sanitized MongoDB keys.
 * Replaces '_DOT_' back with dots ('.') and converts snake_case to camelCase.
 */
export function restoreMongoKeys(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object' || obj instanceof Date || obj instanceof RegExp) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => restoreMongoKeys(item));
    }

    // Only recurse if it's a plain object (e.g. {}, new Object())
    // This prevents corruption of specialized objects like MongoDB's ObjectId
    if (obj.constructor !== Object) {
        return obj;
    }

    const result: Record<string, unknown> = {};
    const typedObj = obj as Record<string, unknown>;
    for (const key in typedObj) {
        if (Object.prototype.hasOwnProperty.call(typedObj, key)) {
            // Restore _DOT_ to dot, and convert snake_case to camelCase
            const restoredKey = snakeToCamel(key.replace(/_DOT_/g, '.'));
            result[restoredKey] = restoreMongoKeys(typedObj[key]);
        }
    }
    return result;
}
