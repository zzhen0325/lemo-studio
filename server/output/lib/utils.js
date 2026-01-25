"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.getComfyUIRandomSeed = getComfyUIRandomSeed;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
function getComfyUIRandomSeed() {
    const minCeiled = Math.ceil(0);
    const maxFloored = Math.floor(2 ** 32);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}
