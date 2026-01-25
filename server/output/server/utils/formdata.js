"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFileLike = toFileLike;
exports.buildFormDataLike = buildFormDataLike;
const fs_1 = require("fs");
function toFileLike(file) {
    const f = Array.isArray(file) ? file[0] : file;
    if (!f)
        return null;
    const filepath = f.filepath || f.path;
    if (!filepath)
        return null;
    const name = f.originalFilename || f.newFilename || f.name || 'file';
    const type = f.mimetype || f.type || 'application/octet-stream';
    return {
        name,
        type,
        size: f.size,
        arrayBuffer: async () => {
            const buffer = await fs_1.promises.readFile(filepath);
            const arr = new Uint8Array(buffer.length);
            arr.set(buffer);
            return arr.buffer;
        },
    };
}
function buildFormDataLike(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
fields, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
files) {
    return {
        get(key) {
            if (files && key in files) {
                const fileLike = toFileLike(files[key]);
                if (fileLike)
                    return fileLike;
            }
            if (!fields || !(key in fields))
                return null;
            return fields[key];
        },
    };
}
