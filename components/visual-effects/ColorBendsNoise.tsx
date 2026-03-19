import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type ColorBendsNoiseProps = {
  className?: string;
  style?: React.CSSProperties;
  opacity?: number;
  noise?: number;
  speed?: number;
  scale?: number;
};

const frag = `
uniform float uTime;
uniform float uOpacity;
uniform float uNoise;
uniform float uScale;
uniform float uSpeed;
varying vec2 vUv;

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 grid = gl_FragCoord.xy / max(uScale, 0.0001);
  float t = uTime * (20.0 * uSpeed);

  float n0 = grain(grid + vec2(t, t * 0.37));
  float n1 = grain(grid * 1.97 + vec2(-t * 0.53, t * 0.21));
  float n2 = grain(grid * 0.61 + vec2(t * 0.11, -t * 0.17));

  float n = (n0 * 0.6 + n1 * 0.3 + n2 * 0.1);
  float centered = (n - 0.5) * 2.0;
  float grainValue = 0.5 + centered * clamp(uNoise, 0.0, 1.0) * 0.5;
  float alpha = clamp(uOpacity, 0.0, 1.0) * (0.55 + abs(centered) * 0.45);

  gl_FragColor = vec4(vec3(grainValue), alpha);
}
`;

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export default function ColorBendsNoise({
  className,
  style,
  opacity = 0.06,
  noise = 0.35,
  speed = 0.08,
  scale = 1.25,
}: ColorBendsNoiseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uNoise: { value: noise },
        uScale: { value: scale },
        uSpeed: { value: speed },
      },
      transparent: true,
      premultipliedAlpha: true,
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const handleResize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
    };

    handleResize();

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(handleResize);
      ro.observe(container);
      resizeObserverRef.current = ro;
    } else {
      window.addEventListener('resize', handleResize);
    }

    const clock = new THREE.Clock();
    const loop = () => {
      material.uniforms.uTime.value = clock.elapsedTime;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      else window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [opacity, noise, scale, speed]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uNoise.value = noise;
    material.uniforms.uScale.value = scale;
    material.uniforms.uSpeed.value = speed;
  }, [opacity, noise, scale, speed]);

  return <div ref={containerRef} className={`h-full w-full overflow-hidden ${className ?? ''}`} style={style} />;
}
