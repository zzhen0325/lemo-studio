"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolComponentProps } from '../tool-configs';

type SvgViewBox = { x: number; y: number; w: number; h: number };

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

const drawFittedImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, cover: boolean) => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = cover ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
};

const drawPoly = (ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, sides: number, offset: number) => {
    const step = (Math.PI * 2) / sides;
    for (let i = 0; i < sides; i++) {
        const ang = i * step + offset;
        const px = x + Math.cos(ang) * rad;
        const py = y + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
};

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outer: number, inner: number) => {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outer;
        let y = cy + Math.sin(rot) * outer;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * inner;
        y = cy + Math.sin(rot) * inner;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outer);
    ctx.closePath();
};

const drawShape = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: string,
    svgPath: Path2D | null,
    svgViewBox: SvgViewBox,
) => {
    const r = size / 2;

    if (type === 'custom') {
        if (svgPath) {
            const maxDim = Math.max(svgViewBox.w || 1, svgViewBox.h || 1);
            const scale = size / maxDim;
            ctx.save();
            ctx.scale(scale, scale);
            ctx.translate(-svgViewBox.w / 2, -svgViewBox.h / 2);
            ctx.translate(-svgViewBox.x, -svgViewBox.y);
            ctx.fill(svgPath);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.rect(x - r, y - r, size, size);
            ctx.fill();
        }
        return;
    }

    ctx.beginPath();
    switch (type) {
        case 'circle':
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'rect':
            ctx.rect(x - r, y - r, size, size);
            ctx.fill();
            break;
        case 'triangle':
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y + r);
            ctx.lineTo(x - r, y + r);
            ctx.closePath();
            ctx.fill();
            break;
        case 'octagon':
            drawPoly(ctx, x, y, r, 8, Math.PI / 8);
            ctx.fill();
            break;
        case 'star':
            drawStar(ctx, x, y, 5, r, r * 0.4);
            ctx.fill();
            break;
        case 'cross': {
            const w = r / 3;
            ctx.rect(x - w, y - r, w * 2, size);
            ctx.rect(x - r, y - w, size, w * 2);
            ctx.fill();
            break;
        }
        case 'rect_v':
            ctx.rect(x - r * 0.3, y - r, size * 0.3, size);
            ctx.fill();
            break;
        case 'rect_h':
            ctx.rect(x - r, y - r * 0.3, size, size * 0.3);
            ctx.fill();
            break;
        case 'hex_v':
            drawPoly(ctx, x, y, r, 6, Math.PI / 6);
            ctx.fill();
            break;
        case 'line_diag_r':
            ctx.moveTo(x - r, y + r);
            ctx.lineTo(x - r + size * 0.2, y + r);
            ctx.lineTo(x + r, y - r);
            ctx.lineTo(x + r - size * 0.2, y - r);
            ctx.closePath();
            ctx.fill();
            break;
        case 'line_diag_l':
            ctx.moveTo(x - r, y - r);
            ctx.lineTo(x - r + size * 0.2, y - r);
            ctx.lineTo(x + r, y + r);
            ctx.lineTo(x + r - size * 0.2, y + r);
            ctx.closePath();
            ctx.fill();
            break;
        case 'chevron': {
            const chW = r * 0.4;
            ctx.moveTo(x - r, y + r * 0.5);
            ctx.lineTo(x, y - r * 0.5);
            ctx.lineTo(x + r, y + r * 0.5);
            ctx.lineTo(x + r, y + r * 0.5 - chW);
            ctx.lineTo(x, y - r * 0.5 - chW);
            ctx.lineTo(x - r, y + r * 0.5 - chW);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'trapezoid':
            ctx.moveTo(x - r * 0.6, y - r);
            ctx.lineTo(x + r * 0.6, y - r);
            ctx.lineTo(x + r, y + r);
            ctx.lineTo(x - r, y + r);
            ctx.closePath();
            ctx.fill();
            break;
        case 'semi_top':
            ctx.arc(x, y + r * 0.1, r, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
            break;
        case 'semi_bottom':
            ctx.arc(x, y - r * 0.1, r, 0, Math.PI);
            ctx.closePath();
            ctx.fill();
            break;
        case 'rect_hollow':
            ctx.rect(x - r, y - r, size, size);
            ctx.rect(x + r * 0.5, y - r * 0.5, -size * 0.5, size * 0.5);
            ctx.fill();
            break;
        case 'spiral': {
            ctx.lineWidth = size * 0.15;
            ctx.lineCap = 'round';
            const loops = 2;
            const increment = r / (loops * 10);
            ctx.moveTo(x, y);
            for (let i = 0; i < loops * 20; i++) {
                const ang = 0.5 * i;
                const dist = increment * i;
                ctx.lineTo(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist);
            }
            ctx.stroke();
            break;
        }
        case 'concentric':
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.arc(x, y, r * 0.7, 0, Math.PI * 2, true);
            ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
            ctx.arc(x, y, r * 0.15, 0, Math.PI * 2, true);
            ctx.fill();
            break;
        case 'gear': {
            const teeth = 8;
            const outerR = r;
            const innerR = r * 0.7;
            const holeR = r * 0.3;
            for (let i = 0; i < teeth * 2; i++) {
                const a = (Math.PI * 2 * i) / (teeth * 2);
                const rad = i % 2 === 0 ? outerR : innerR;
                const px = x + Math.cos(a) * rad;
                const py = y + Math.sin(a) * rad;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.moveTo(x + holeR, y);
            ctx.arc(x, y, holeR, 0, Math.PI * 2, true);
            ctx.fill();
            break;
        }
        case 'flower':
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 * i) / 5;
                const px = x + Math.cos(a) * (r * 0.6);
                const py = y + Math.sin(a) * (r * 0.6);
                ctx.moveTo(x, y);
                ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
            }
            ctx.fill();
            break;
        case 'shuriken': {
            const spikes = 4;
            const outer = r;
            const inner = r * 0.2;
            ctx.moveTo(x, y - outer);
            for (let i = 0; i < spikes; i++) {
                const rot = (Math.PI / 2) * i;
                ctx.quadraticCurveTo(
                    x + Math.cos(rot + Math.PI / 4) * r * 0.5,
                    y + Math.sin(rot + Math.PI / 4) * r * 0.5,
                    x + Math.cos(rot + Math.PI / 2) * outer,
                    y + Math.sin(rot + Math.PI / 2) * outer,
                );
                ctx.lineTo(
                    x + Math.cos(rot + Math.PI / 2 + Math.PI / 4) * inner,
                    y + Math.sin(rot + Math.PI / 2 + Math.PI / 4) * inner,
                );
            }
            ctx.fill();
            break;
        }
        case 'lightning': {
            const w2 = r * 0.6;
            ctx.moveTo(x + w2, y - r);
            ctx.lineTo(x - w2 * 0.2, y - r * 0.1);
            ctx.lineTo(x + w2, y - r * 0.1);
            ctx.lineTo(x - w2, y + r);
            ctx.lineTo(x + w2 * 0.2, y + r * 0.1);
            ctx.lineTo(x - w2, y + r * 0.1);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'diamond_hollow': {
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
            const hr = r * 0.5;
            ctx.moveTo(x - hr, y);
            ctx.lineTo(x, y + hr);
            ctx.lineTo(x + hr, y);
            ctx.lineTo(x, y - hr);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'windmill':
            for (let i = 0; i < 4; i++) {
                const ang = (Math.PI / 2) * i;
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(ang) * r * 0.2, y + Math.sin(ang) * r * 0.2);
                ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
                ctx.lineTo(x + Math.cos(ang + 0.5) * r, y + Math.sin(ang + 0.5) * r);
                ctx.closePath();
            }
            ctx.fill();
            break;
        case 'leaf':
            ctx.moveTo(x, y - r);
            ctx.quadraticCurveTo(x + r, y - r * 0.5, x + r, y);
            ctx.quadraticCurveTo(x + r, y + r * 0.5, x, y + r);
            ctx.quadraticCurveTo(x - r, y + r * 0.5, x - r, y);
            ctx.quadraticCurveTo(x - r, y - r * 0.5, x, y - r);
            ctx.rect(x - size * 0.05, y - r, size * 0.1, size * 1.8);
            ctx.fill();
            break;
        case 'ghost':
            ctx.arc(x, y - r * 0.2, r * 0.8, Math.PI, 0);
            ctx.lineTo(x + r * 0.8, y + r);
            ctx.lineTo(x + r * 0.4, y + r * 0.7);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r * 0.4, y + r * 0.7);
            ctx.lineTo(x - r * 0.8, y + r);
            ctx.closePath();
            ctx.moveTo(x - r * 0.3, y - r * 0.2);
            ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2);
            ctx.moveTo(x + r * 0.3, y - r * 0.2);
            ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2);
            ctx.fill();
            break;
        default:
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
};

const DitherAsciiToolAdapter: React.FC<ToolComponentProps> = (props) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [customSvgPath, setCustomSvgPath] = useState<Path2D | null>(null);
    const [customSvgViewBox, setCustomSvgViewBox] = useState<SvgViewBox>({ x: 0, y: 0, w: 100, h: 100 });

    const targetWidth = typeof props.renderWidth === 'number' ? props.renderWidth : props.isPreview ? 400 : 1280;
    const targetHeight = typeof props.renderHeight === 'number' ? props.renderHeight : props.isPreview ? 225 : 720;

    const sourceUrl = typeof props.sourceUrl === 'string' ? props.sourceUrl : '';
    const customSvgUrl = typeof props.customSvgUrl === 'string' ? props.customSvgUrl : '';

    const mode = typeof props.mode === 'string' ? props.mode : 'halftone';
    const shape = typeof props.shape === 'string' ? props.shape : 'circle';
    const cellSize = typeof props.cellSize === 'number' ? props.cellSize : 10;
    const baseScale = typeof props.baseScale === 'number' ? props.baseScale : 0.9;
    const gap = typeof props.gap === 'number' ? props.gap : 1;
    const bgColor = typeof props.bgColor === 'string' ? props.bgColor : '#111111';
    const useColor = typeof props.useColor === 'boolean' ? props.useColor : true;
    const monoColor = typeof props.monoColor === 'string' ? props.monoColor : '#ffffff';
    const contrast = typeof props.contrast === 'number' ? props.contrast : 0;
    const intensity = typeof props.intensity === 'number' ? props.intensity : 1.0;
    const cover = typeof props.cover === 'boolean' ? props.cover : true;

    const monoRgb = useMemo(() => {
        const v = monoColor.trim();
        const m = /^#?([0-9a-f]{6})$/i.exec(v);
        if (!m) return { r: 255, g: 255, b: 255 };
        const n = parseInt(m[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }, [monoColor]);

    const contrastFactor = useMemo(() => {
        const c = Math.max(-100, Math.min(100, contrast));
        return (259 * (c + 255)) / (255 * (259 - c));
    }, [contrast]);

    useEffect(() => {
        if (!sourceUrl) {
            setImageEl(null);
            return;
        }
        const img = new Image();
        if (/^https?:\/\//i.test(sourceUrl)) img.crossOrigin = 'anonymous';
        img.onload = () => setImageEl(img);
        img.onerror = () => setImageEl(null);
        img.src = sourceUrl;
    }, [sourceUrl]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!customSvgUrl) {
                setCustomSvgPath(null);
                return;
            }
            try {
                const res = await fetch(customSvgUrl);
                const text = await res.text();
                if (cancelled) return;
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'image/svg+xml');
                const pathElem = doc.querySelector('path');
                const svgElem = doc.querySelector('svg');
                if (!pathElem) {
                    setCustomSvgPath(null);
                    return;
                }
                const d = pathElem.getAttribute('d') ?? '';
                const p = new Path2D(d);
                setCustomSvgPath(p);

                if (svgElem) {
                    const viewBox = svgElem.getAttribute('viewBox');
                    if (viewBox) {
                        const parts = viewBox.split(/\s+|,/).map((n) => parseFloat(n));
                        if (parts.length >= 4 && parts.every((n) => Number.isFinite(n))) {
                            setCustomSvgViewBox({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
                            return;
                        }
                    }
                    const w = parseFloat(svgElem.getAttribute('width') ?? '') || 100;
                    const h = parseFloat(svgElem.getAttribute('height') ?? '') || 100;
                    setCustomSvgViewBox({ x: 0, y: 0, w, h });
                }
            } catch {
                if (!cancelled) setCustomSvgPath(null);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [customSvgUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.max(1, Math.floor(targetWidth));
        canvas.height = Math.max(1, Math.floor(targetHeight));
    }, [targetWidth, targetHeight]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;

        const workCanvas = workCanvasRef.current ?? document.createElement('canvas');
        workCanvasRef.current = workCanvas;
        const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
        if (!workCtx) return;

        const render = () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, w, h);

            if (!imageEl) return;

            workCanvas.width = w;
            workCanvas.height = h;
            workCtx.setTransform(1, 0, 0, 1, 0, 0);
            workCtx.clearRect(0, 0, w, h);
            workCtx.imageSmoothingEnabled = true;
            drawFittedImage(workCtx, imageEl, w, h, cover);

            const imgData = workCtx.getImageData(0, 0, w, h).data;
            const step = Math.max(1, Math.floor(cellSize));
            const size = Math.max(0, step - gap);

            for (let y = 0; y < h; y += step) {
                for (let x = 0; x < w; x += step) {
                    const sx = x + Math.floor(step / 2);
                    const sy = y + Math.floor(step / 2);
                    if (sx >= w || sy >= h) continue;
                    const pIdx = (sy * w + sx) * 4;
                    if (pIdx >= imgData.length) continue;

                    let r = imgData[pIdx];
                    let g = imgData[pIdx + 1];
                    let b = imgData[pIdx + 2];
                    const a = imgData[pIdx + 3];
                    if (a < 20) continue;

                    r = clamp255(contrastFactor * (r - 128) + 128);
                    g = clamp255(contrastFactor * (g - 128) + 128);
                    b = clamp255(contrastFactor * (b - 128) + 128);

                    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

                    let scX = baseScale;
                    let scY = baseScale;
                    let rot = 0;
                    let offX = 0;
                    let offY = 0;
                    let alpha = 1.0;

                    switch (mode) {
                        case 'flat':
                            break;
                        case 'halftone':
                            scX = scY = luma * baseScale * 1.5;
                            break;
                        case 'inv_halftone':
                            scX = scY = (1.0 - luma) * baseScale * 1.5;
                            break;
                        case 'rotation':
                            rot = luma * Math.PI;
                            break;
                        case 'random_size':
                            scX = scY = Math.random() * baseScale;
                            break;
                        case 'random_rot':
                            rot = Math.random() * Math.PI * 2;
                            break;
                        case 'glitch':
                            offX = (luma - 0.5) * step * 1.5 * intensity;
                            break;
                        case 'opacity':
                            alpha = luma;
                            break;
                        case 'inv_opacity':
                            alpha = 1.0 - luma;
                            break;
                        case 'threshold':
                            if (luma < 0.5) scX = scY = 0;
                            break;
                        case 'crosshatch':
                            rot = luma > 0.5 ? Math.PI / 4 : -Math.PI / 4;
                            scY = baseScale * 1.5;
                            scX = baseScale * 0.2;
                            break;
                        case 'stretch_v':
                            scX = baseScale * 0.5;
                            scY = luma * baseScale * 3;
                            break;
                        case 'stretch_h':
                            scX = luma * baseScale * 3;
                            scY = baseScale * 0.5;
                            break;
                        case 'flow': {
                            const iR = pIdx + step * 4;
                            const iB = pIdx + w * step * 4;
                            const rR = imgData[iR] || 0;
                            const gR = imgData[iR + 1] || 0;
                            const bR = imgData[iR + 2] || 0;
                            const rB = imgData[iB] || 0;
                            const gB = imgData[iB + 1] || 0;
                            const bB = imgData[iB + 2] || 0;
                            const lR = (0.299 * rR + 0.587 * gR + 0.114 * bR) / 255;
                            const lB = (0.299 * rB + 0.587 * gB + 0.114 * bB) / 255;
                            const l0 = (0.299 * imgData[pIdx] + 0.587 * imgData[pIdx + 1] + 0.114 * imgData[pIdx + 2]) / 255;
                            const dx = lR - l0;
                            const dy = lB - l0;
                            rot = Math.atan2(dy, dx) * intensity;
                            scX = scY = luma * baseScale * 1.2;
                            break;
                        }
                        case 'edges': {
                            const idxNext = pIdx + step * 4;
                            let rN = imgData[idxNext] || 0;
                            let gN = imgData[idxNext + 1] || 0;
                            let bN = imgData[idxNext + 2] || 0;
                            rN = clamp255(contrastFactor * (rN - 128) + 128);
                            gN = clamp255(contrastFactor * (gN - 128) + 128);
                            bN = clamp255(contrastFactor * (bN - 128) + 128);
                            const lumaN = (0.299 * rN + 0.587 * gN + 0.114 * bN) / 255;
                            const diff = Math.abs(luma - lumaN);
                            scX = scY = diff * 5 * baseScale * intensity;
                            break;
                        }
                        case 'melt':
                            offY = luma * step * 2 * intensity;
                            scX = scY = luma * baseScale;
                            break;
                        case 'jitter': {
                            const jit = (Math.random() - 0.5) * step * 2;
                            if (luma > 0.5) {
                                offX = jit * intensity;
                                offY = jit * intensity;
                            }
                            scX = scY = luma * baseScale;
                            break;
                        }
                        case 'checker': {
                            const gridX = Math.floor(x / step);
                            const gridY = Math.floor(y / step);
                            if ((gridX + gridY) % 2 === 0) scX = scY = luma * baseScale * 1.5;
                            else scX = scY = (1.0 - luma) * baseScale * 1.5;
                            break;
                        }
                        case 'posterize': {
                            let level = 0.2;
                            if (luma > 0.3) level = 0.5;
                            if (luma > 0.6) level = 0.8;
                            if (luma > 0.8) level = 1.0;
                            scX = scY = level * baseScale;
                            break;
                        }
                        case 'interference': {
                            const pattern = Math.sin(x * y * 0.0001 * intensity);
                            scX = scY = (luma + pattern) * 0.5 * baseScale * 1.5;
                            break;
                        }
                        case 'crt_scan': {
                            const line = Math.floor(y / step);
                            if (line % 2 === 0) {
                                scX = baseScale * 1.2;
                                scY = baseScale * 0.2;
                                offX = 2 * intensity;
                            } else {
                                scX = luma * baseScale;
                                scY = baseScale * 0.8;
                            }
                            break;
                        }
                        case 'bio':
                            rot = Math.sin(luma * Math.PI * 2) + Math.random() * 0.5;
                            scX = scY = (luma + 0.2) * baseScale;
                            break;
                        case 'eraser':
                            if (Math.random() > luma * intensity) scX = scY = 0;
                            break;
                    }

                    ctx.save();
                    const cx = x + step / 2 + offX;
                    const cy = y + step / 2 + offY;
                    ctx.translate(cx, cy);
                    ctx.rotate(rot);
                    ctx.scale(scX, scY);

                    if (useColor) {
                        ctx.fillStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${alpha})`;
                        ctx.strokeStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${alpha})`;
                    } else {
                        ctx.fillStyle = `rgba(${monoRgb.r},${monoRgb.g},${monoRgb.b},${alpha})`;
                        ctx.strokeStyle = `rgba(${monoRgb.r},${monoRgb.g},${monoRgb.b},${alpha})`;
                    }

                    drawShape(ctx, 0, 0, size, shape, customSvgPath, customSvgViewBox);
                    ctx.restore();
                }
            }
        };

        const raf = window.requestAnimationFrame(render);
        return () => window.cancelAnimationFrame(raf);
    }, [
        imageEl,
        customSvgPath,
        customSvgViewBox,
        targetWidth,
        targetHeight,
        mode,
        shape,
        cellSize,
        baseScale,
        gap,
        bgColor,
        useColor,
        monoRgb,
        contrastFactor,
        intensity,
        cover,
    ]);

    return (
        <div className="w-full h-full bg-black relative">
            <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
    );
};

export default DitherAsciiToolAdapter;
