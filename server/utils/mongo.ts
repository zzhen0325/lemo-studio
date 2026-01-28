
/**
 * Sanitize object keys for MongoDB.
 * Replaces dots ('.') with '_DOT_' to avoid BSON serialization errors.
 */
export function sanitizeMongoKeys(obj: any): any {
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

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const sanitizedKey = key.replace(/\./g, '_DOT_');
            result[sanitizedKey] = sanitizeMongoKeys(obj[key]);
        }
    }
    return result;
}

/**
 * Restore sanitized MongoDB keys.
 * Replaces '_DOT_' back with dots ('.').
 */
export function restoreMongoKeys(obj: any): any {
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

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const restoredKey = key.replace(/_DOT_/g, '.');
            result[restoredKey] = restoreMongoKeys(obj[key]);
        }
    }
    return result;
}
