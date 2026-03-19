import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type ColorBendsGradientStop = {
  position: number;
  color: string;
};

type ColorBendsProps = {
  className?: string;
  style?: React.CSSProperties;
  rotation?: number;
  speed?: number;
  colors?: string[];
  transparent?: boolean;
  opacity?: number;
  autoRotate?: number;
  scale?: number;
  frequency?: number;
  warpStrength?: number;
  mouseInfluence?: number;
  parallax?: number;
  noise?: number;
  blur?: number;
  backgroundGradientStops?: ColorBendsGradientStop[];
  backgroundGradientRotation?: number;
  backgroundDistortion?: number;
  backgroundBlend?: number;
};

const MAX_COLORS = 8 as const;
const MAX_GRADIENT_STOPS = 8 as const;

const frag = `
#define MAX_COLORS ${MAX_COLORS}
#define MAX_GRADIENT_STOPS ${MAX_GRADIENT_STOPS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uGradientStopCount;
uniform vec3 uGradientColors[MAX_GRADIENT_STOPS];
uniform float uGradientPositions[MAX_GRADIENT_STOPS];
uniform vec2 uGradientDir;
uniform float uBackgroundDistortion;
uniform float uBackgroundBlend;
uniform int uTransparent;
uniform float uOpacity;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer; // in NDC [-1,1]
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
uniform float uSoftness;
varying vec2 vUv;

float projectGradient(vec2 uv) {
  vec2 dir = normalize(vec2(
    abs(uGradientDir.x) < 0.0001 && abs(uGradientDir.y) < 0.0001 ? 0.0 : uGradientDir.x,
    abs(uGradientDir.x) < 0.0001 && abs(uGradientDir.y) < 0.0001 ? 1.0 : uGradientDir.y
  ));
  return clamp(dot(uv - 0.5, dir) + 0.5, 0.0, 1.0);
}

vec3 sampleGradient(float t) {
  if (uGradientStopCount <= 0) {
    return vec3(0.0);
  }

  vec3 current = uGradientColors[0];
  float currentPos = uGradientPositions[0];

  for (int i = 1; i < MAX_GRADIENT_STOPS; ++i) {
    if (i >= uGradientStopCount) {
      break;
    }

    vec3 nextColor = uGradientColors[i];
    float nextPos = uGradientPositions[i];

    if (t <= nextPos || i == uGradientStopCount - 1) {
      float range = max(nextPos - currentPos, 0.0001);
      float localT = clamp((t - currentPos) / range, 0.0, 1.0);
      return mix(current, nextColor, localT);
    }

    current = nextColor;
    currentPos = nextPos;
  }

  return current;
}

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;
  vec2 flow = vec2(
    sin(q.y * uFrequency * 1.25 + t * 0.7) + cos(q.x * uFrequency * 1.6 - t * 0.45),
    cos(q.x * uFrequency * 1.15 - t * 0.65) - sin(q.y * uFrequency * 1.45 + t * 0.55)
  );
  flow += toward * (0.6 * uMouseInfluence);
  vec2 gradientUv = clamp(vUv + flow * (0.04 * uBackgroundDistortion), 0.0, 1.0);
  vec3 backgroundCol = sampleGradient(projectGradient(gradientUv));

    vec3 col = vec3(0.0);
    float a = 1.0;

    if (uColorCount > 0) {
      vec2 s = q;
      vec3 sumCol = vec3(0.0);
      float totalW = 0.0;
      float cover = 0.0;
      for (int i = 0; i < MAX_COLORS; ++i) {
            if (i >= uColorCount) break;
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float m = mix(m0, m1, kMix);
            float w = exp(-m * uSoftness);
            sumCol += uColors[i] * w;
            totalW += w;
            cover = max(cover, w);
      }
      col = sumCol / max(totalW, 0.0001);
      a = uTransparent > 0 ? cover : 1.0;
    } else {
        vec2 s = q;
        float totalW = 0.0;
        for (int k = 0; k < 3; ++k) {
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float m = mix(m0, m1, kMix);
            float w = exp(-m * uSoftness);
            col[k] = w;
            totalW += w;
        }
        col = col / max(totalW, 0.0001);
        a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
    }

    if (uNoise > 0.0001) {
      float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);
    }

    if (uGradientStopCount > 0) {
      float tintStrength = clamp(a * uOpacity * uBackgroundBlend, 0.0, 1.0);
      vec3 finalRgb = clamp(backgroundCol + col * tintStrength, 0.0, 1.0);
      gl_FragColor = vec4(finalRgb, 1.0);
      return;
    }

    vec3 rgb = (uTransparent > 0) ? col * a : col;
    float finalAlpha = a * uOpacity;
    gl_FragColor = vec4(rgb, finalAlpha);
}
`;

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export default function ColorBends({
  className,
  style,
  rotation = 45,
  speed = 0.2,
  colors = [],
  transparent = true,
  opacity = 1.0,
  autoRotate = 0,
  scale = 1,
  frequency = 1,
  warpStrength = 1,
  mouseInfluence = 1,
  parallax = 0.5,
  noise = 0.1,
  blur = 0,
  backgroundGradientStops = [],
  backgroundGradientRotation = 180,
  backgroundDistortion = 0,
  backgroundBlend = 0.18
}: ColorBendsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rotationRef = useRef<number>(rotation);
  const autoRotateRef = useRef<number>(autoRotate);
  const pointerTargetRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const pointerCurrentRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const pointerSmoothRef = useRef<number>(8);

  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));
    const uGradientColorsArray = Array.from({ length: MAX_GRADIENT_STOPS }, () => new THREE.Vector3(0, 0, 0));
    const uGradientPositionsArray = new Float32Array(MAX_GRADIENT_STOPS);
    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uCanvas: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uRot: { value: new THREE.Vector2(1, 0) },
        uColorCount: { value: 0 },
        uColors: { value: uColorsArray },
        uGradientStopCount: { value: 0 },
        uGradientColors: { value: uGradientColorsArray },
        uGradientPositions: { value: uGradientPositionsArray },
        uGradientDir: { value: new THREE.Vector2(0, 1) },
        uBackgroundDistortion: { value: backgroundDistortion },
        uBackgroundBlend: { value: backgroundBlend },
        uTransparent: { value: transparent ? 1 : 0 },
        uOpacity: { value: 1.0 },
        uScale: { value: scale },
        uFrequency: { value: frequency },
        uWarpStrength: { value: warpStrength },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: mouseInfluence },
        uParallax: { value: parallax },
        uNoise: { value: noise },
        uSoftness: { value: 1.5 - (blur || 0) * 1.1 }
      },
      premultipliedAlpha: true,
      transparent: true
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: true
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, transparent ? 0 : 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();

    const handleResize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      (material.uniforms.uCanvas.value as THREE.Vector2).set(w, h);
    };

    handleResize();

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(handleResize);
      ro.observe(container);
      resizeObserverRef.current = ro;
    } else {
      (window as Window).addEventListener('resize', handleResize);
    }

    const loop = () => {
      const dt = clock.getDelta();
      const elapsed = clock.elapsedTime;
      material.uniforms.uTime.value = elapsed;

      const deg = (rotationRef.current % 360) + autoRotateRef.current * elapsed;
      const rad = (deg * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      (material.uniforms.uRot.value as THREE.Vector2).set(c, s);

      const cur = pointerCurrentRef.current;
      const tgt = pointerTargetRef.current;
      const amt = Math.min(1, dt * pointerSmoothRef.current);
      cur.lerp(tgt, amt);
      (material.uniforms.uPointer.value as THREE.Vector2).copy(cur);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      else (window as Window).removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [speed, transparent, scale, frequency, warpStrength, mouseInfluence, parallax, noise, blur, backgroundDistortion, backgroundBlend]);

  useEffect(() => {
    const material = materialRef.current;
    const renderer = rendererRef.current;
    if (!material) return;

    rotationRef.current = rotation;
    autoRotateRef.current = autoRotate;
    material.uniforms.uSpeed.value = speed;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uScale.value = scale;
    material.uniforms.uFrequency.value = frequency;
    material.uniforms.uWarpStrength.value = warpStrength;
    material.uniforms.uMouseInfluence.value = mouseInfluence;
    material.uniforms.uParallax.value = parallax;
    material.uniforms.uNoise.value = noise;
    material.uniforms.uSoftness.value = 1.5 - (blur || 0) * 1.1;

    const toVec3 = (hex: string) => {
      const h = hex.replace('#', '').trim();
      const v =
        h.length === 3
          ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
          : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
    };

    const arr = (colors || []).filter(Boolean).slice(0, MAX_COLORS).map(toVec3);
    for (let i = 0; i < MAX_COLORS; i++) {
      const vec = (material.uniforms.uColors.value as THREE.Vector3[])[i];
      if (i < arr.length) vec.copy(arr[i]);
      else vec.set(0, 0, 0);
    }
    material.uniforms.uColorCount.value = arr.length;

    const gradientStops = (backgroundGradientStops || [])
      .filter((stop) => Number.isFinite(stop.position) && typeof stop.color === 'string' && stop.color.trim())
      .slice(0, MAX_GRADIENT_STOPS)
      .sort((a, b) => a.position - b.position);
    const gradientColors = gradientStops.map((stop) => toVec3(stop.color));
    const gradientPositions = material.uniforms.uGradientPositions.value as Float32Array;
    const gradientColorUniforms = material.uniforms.uGradientColors.value as THREE.Vector3[];

    for (let i = 0; i < MAX_GRADIENT_STOPS; i++) {
      gradientPositions[i] = i < gradientStops.length ? THREE.MathUtils.clamp(gradientStops[i].position, 0, 1) : 0;
      const vec = gradientColorUniforms[i];
      if (i < gradientColors.length) vec.copy(gradientColors[i]);
      else vec.set(0, 0, 0);
    }
    material.uniforms.uGradientStopCount.value = gradientStops.length;

    const gradientRad = ((backgroundGradientRotation - 90) * Math.PI) / 180;
    (material.uniforms.uGradientDir.value as THREE.Vector2).set(Math.cos(gradientRad), Math.sin(gradientRad));
    material.uniforms.uBackgroundDistortion.value = backgroundDistortion;
    material.uniforms.uBackgroundBlend.value = backgroundBlend;

    material.uniforms.uTransparent.value = transparent ? 1 : 0;
    if (renderer) renderer.setClearColor(0x000000, transparent ? 0 : 1);
  }, [
    rotation,
    autoRotate,
    speed,
    scale,
    frequency,
    warpStrength,
    mouseInfluence,
    parallax,
    noise,
    colors,
    transparent,
    opacity,
    blur,
    backgroundGradientStops,
    backgroundGradientRotation,
    backgroundDistortion,
    backgroundBlend
  ]);

  useEffect(() => {
    const material = materialRef.current;
    const container = containerRef.current;
    if (!material || !container) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
      const y = -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1);
      pointerTargetRef.current.set(x, y);
    };

    container.addEventListener('pointermove', handlePointerMove);
    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className ?? ''}`} style={style} />;
}
