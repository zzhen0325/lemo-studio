"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { ToolComponentProps } from "../tool-configs";

type Particle = {
  x: number;
  y: number;
  g: number;
  s: number;
  c: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string) {
  const raw = hex.trim().replace("#", "");
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
}

function rgba(hex: string, a01: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a01, 0, 1)})`;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function grad(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

class Perlin3D {
  private p: number[];

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  noise(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    const x1 = lerp(grad(this.p[AA], xf, yf, zf), grad(this.p[BA], xf - 1, yf, zf), u);
    const x2 = lerp(grad(this.p[AB], xf, yf - 1, zf), grad(this.p[BB], xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(grad(this.p[AA + 1], xf, yf, zf - 1), grad(this.p[BA + 1], xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad(this.p[AB + 1], xf, yf - 1, zf - 1), grad(this.p[BB + 1], xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);

    const res = lerp(y1, y2, w);
    return (res + 1) * 0.5;
  }
}

const ParticleStairsAdapter: React.FC<ToolComponentProps> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Array<Particle | undefined>>([]);
  const perlinRef = useRef<Perlin3D | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 1, h: 1, dpr: 1 });
  const groupsRef = useRef<
    Array<{ color: string; size: number; x: number[]; y: number[] }>
  >([]);
  const isPreview = Boolean((props as unknown as { isPreview?: boolean }).isPreview);

  const settingsRef = useRef({
    particleCount: 450 * 9,
    spawnRate: 9,
    particleColor: "#76BA99",
    backgroundColor: "#000000",
    trailAlpha: 20 / 255,
    blur: 1.25,
    usePalette: true,
    color1: "#76BA99",
    color2: "#ADCF9F",
    color3: "#CED89E",
    gravityAccel: 0.5,
    slowFallSpeed: 0.5,
    shrink: 0.998,
    noiseThreshold: 0.4,
    noiseYDiv: 5,
    driftMultiplier: 99,
    stairCount: 120,
    seed: 1337,
  });

  const settings = useMemo(() => {
    return {
      particleCount: clamp(Number(props.particleCount ?? 450 * 9), 0, 200000),
      spawnRate: clamp(Number(props.spawnRate ?? 9), 0, 100),
      particleColor: typeof props.particleColor === "string" ? props.particleColor : "#ffffff",
      backgroundColor: typeof props.backgroundColor === "string" ? props.backgroundColor : "#000000",
      trailAlpha: clamp(Number(props.trailAlpha ?? 20 / 255), 0, 1),
      blur: clamp(Number(props.blur ?? 1.25), 0, 20),
      usePalette: typeof props.usePalette === "boolean" ? props.usePalette : true,
      color1: typeof props.color1 === "string" ? props.color1 : "#76BA99",
      color2: typeof props.color2 === "string" ? props.color2 : "#ADCF9F",
      color3: typeof props.color3 === "string" ? props.color3 : "#CED89E",
      gravityAccel: clamp(Number(props.gravityAccel ?? 0.5), 0, 10),
      slowFallSpeed: clamp(Number(props.slowFallSpeed ?? 0.5), 0, 10),
      shrink: clamp(Number(props.shrink ?? 0.998), 0.9, 1),
      noiseThreshold: clamp(Number(props.noiseThreshold ?? 0.4), 0, 1),
      noiseYDiv: clamp(Number(props.noiseYDiv ?? 5), 0.5, 50),
      driftMultiplier: clamp(Number(props.driftMultiplier ?? 99), 0, 500),
      stairCount: clamp(Number(props.stairCount ?? 120), 10, 400),
      seed: clamp(Number(props.seed ?? 1337), 1, 1000000),
    };
  }, [
    props.particleCount,
    props.spawnRate,
    props.particleColor,
    props.backgroundColor,
    props.trailAlpha,
    props.blur,
    props.usePalette,
    props.color1,
    props.color2,
    props.color3,
    props.gravityAccel,
    props.slowFallSpeed,
    props.shrink,
    props.noiseThreshold,
    props.noiseYDiv,
    props.driftMultiplier,
    props.stairCount,
    props.seed,
  ]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const hasFixedRenderSize = typeof props.renderWidth === "number" && typeof props.renderHeight === "number";
      const dpr = hasFixedRenderSize ? 1 : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.max(2, Math.floor(hasFixedRenderSize ? props.renderWidth! : rect.width));
      const h = Math.max(2, Math.floor(hasFixedRenderSize ? props.renderHeight! : rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.max(2, Math.floor(w * dpr));
        canvas.height = Math.max(2, Math.floor(h * dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        sizeRef.current = { w, h, dpr };
      }
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    return () => {
      ro.disconnect();
    };
  }, [props.renderHeight, props.renderWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let mounted = true;
    lastTRef.current = performance.now();

    const tick = (t: number) => {
      if (!mounted) return;

      const {
        particleCount,
        spawnRate,
        backgroundColor,
        trailAlpha,
        blur,
        usePalette,
        color1,
        color2,
        color3,
        particleColor,
        gravityAccel,
        slowFallSpeed,
        shrink,
        noiseThreshold,
        noiseYDiv,
        driftMultiplier,
        stairCount,
        seed,
      } = settingsRef.current;

      const targetFps = isPreview ? 24 : 60;
      const prevT = lastTRef.current;
      const dtMs = t - prevT;
      if (dtMs > 0 && dtMs < 1000 / targetFps) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTRef.current = t;

      const dt = clamp(dtMs / 1000, 0, 1 / 20);
      const dtFactor = dt * 60;

      if (!perlinRef.current) perlinRef.current = new Perlin3D(seed);

      const { w, h, dpr } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const maxRuntimeParticles = isPreview ? 900 : 30000;
      const cap = clamp(Math.floor(particleCount), 1, maxRuntimeParticles);
      if (particlesRef.current.length !== cap) particlesRef.current = new Array(cap);

      const effectiveBlur = isPreview ? 0 : clamp(blur, 0, 6);
      const effectiveTrailAlpha = isPreview ? Math.max(trailAlpha, 0.1) : trailAlpha;
      ctx.fillStyle = rgba(backgroundColor, effectiveTrailAlpha);
      ctx.fillRect(0, 0, w, h);

      ctx.filter = effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : "none";

      const palette = usePalette ? [color1, color2, color3] : [particleColor];

      let localTime = timeRef.current;
      const effectiveSpawn = isPreview ? Math.min(Math.floor(spawnRate), 3) : Math.floor(spawnRate);
      for (let i = 0; i < effectiveSpawn; i++) {
        const index = localTime % cap;
        const px = (localTime * driftMultiplier) % w;
        const c = palette[Math.floor(mulberry32(seed + localTime)() * palette.length)] || palette[0];
        particlesRef.current[index] = { x: px, y: 0, g: 0, s: 2, c };
        localTime += 1;
      }
      timeRef.current = localTime;

      const stepSize = clamp(w / stairCount, 0.5, 30);

      const groups = groupsRef.current;
      if (groups.length === 0) {
        for (let ci = 0; ci < 3; ci++) {
          for (let si = 1; si <= 4; si++) {
            groups.push({ color: palette[Math.min(ci, palette.length - 1)] || palette[0], size: si, x: [], y: [] });
          }
        }
      }
      for (let ci = 0; ci < 3; ci++) {
        const color = palette[Math.min(ci, palette.length - 1)] || palette[0];
        for (let si = 1; si <= 4; si++) {
          const gi = ci * 4 + (si - 1);
          const g = groups[gi];
          if (g) {
            g.color = color;
            g.size = si;
          }
        }
      }
      for (const g of groups) {
        g.x.length = 0;
        g.y.length = 0;
      }

      for (let idx = 0; idx < particlesRef.current.length; idx++) {
        const p = particlesRef.current[idx];
        if (!p) continue;

        p.s *= shrink;
        if (p.s < 0.15 || p.y > h + 20) {
          particlesRef.current[idx] = undefined;
          continue;
        }

        const n = perlinRef.current.noise(p.x / w, p.y / noiseYDiv, localTime / w);

        if (n > noiseThreshold) {
          p.x += 0;
        } else {
          if ((n % 0.1) > 0.05) p.x += stepSize * dtFactor;
          else p.x -= stepSize * dtFactor;
          p.g = 0;
        }

        if (n > noiseThreshold) {
          p.g += gravityAccel * dtFactor;
          p.y += p.g * dtFactor;
        } else {
          p.y += slowFallSpeed * dtFactor;
        }

        if (p.x < 0) p.x += w;
        if (p.x > w) p.x -= w;

        const sizeBucket = clamp(Math.round(p.s), 1, 4);
        let colorIndex = 0;
        if (usePalette) {
          if (p.c === color2) colorIndex = 1;
          else if (p.c === color3) colorIndex = 2;
        }
        const gi = colorIndex * 4 + (sizeBucket - 1);
        const g = groups[gi] || groups[0];
        g.x.push(p.x);
        g.y.push(p.y);
      }

      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        if (g.x.length === 0) continue;
        ctx.fillStyle = g.color;
        const r = g.size * 0.5;
        ctx.beginPath();
        for (let i = 0; i < g.x.length; i++) {
          const x = g.x[i];
          const y = g.y[i];
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.filter = "none";

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPreview]);

  useEffect(() => {
    perlinRef.current = new Perlin3D(settings.seed);
    timeRef.current = 0;
  }, [settings.seed]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-black">
      <canvas ref={canvasRef} className="w-full h-full rounded-2xl" />
    </div>
  );
};

export default ParticleStairsAdapter;
