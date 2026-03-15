import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent } from 'undici';

export function sha1(message: string): string {
    return crypto.createHash('sha1').update(message).digest('hex');
}

export function generateSign(nonce: string, timestamp: string, secretKey: string): string {
    const stringList = [nonce, timestamp, secretKey];
    stringList.sort();
    const concatenatedString = stringList.join('');
    return sha1(concatenatedString);
}

export function generateNonce(): string {
    return Math.floor(Math.random() * 2147483647).toString();
}

export function generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
}


export function getProxyAgent() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

export function getUndiciDispatcher() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
}
