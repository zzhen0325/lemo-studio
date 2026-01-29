"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha1 = sha1;
exports.generateSign = generateSign;
exports.generateNonce = generateNonce;
exports.generateTimestamp = generateTimestamp;
exports.getProxyAgent = getProxyAgent;
exports.getUndiciDispatcher = getUndiciDispatcher;
const crypto_1 = __importDefault(require("crypto"));
const https_proxy_agent_1 = require("https-proxy-agent");
const undici_1 = require("undici");
function sha1(message) {
    return crypto_1.default.createHash('sha1').update(message).digest('hex');
}
function generateSign(nonce, timestamp, secretKey) {
    const stringList = [nonce, timestamp, secretKey];
    stringList.sort();
    const concatenatedString = stringList.join('');
    return sha1(concatenatedString);
}
function generateNonce() {
    return Math.floor(Math.random() * 2147483647).toString();
}
function generateTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
}
function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new https_proxy_agent_1.HttpsProxyAgent(proxyUrl) : undefined;
}
function getUndiciDispatcher() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new undici_1.ProxyAgent(proxyUrl) : undefined;
}
