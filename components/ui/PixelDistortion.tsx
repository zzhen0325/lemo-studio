"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 st = vUv;
    
    // 像素化效果
    float blocks = 120.0;
    vec2 gridId = floor(st * blocks);
    vec2 gridUv = fract(st * blocks);
    
    // 动态位移
    float noise = random(gridId + floor(uTime * 2.0));
    
    // 颜色偏移
    vec3 color = vec3(0.08, 0.16, 0.34); // 基础深蓝色 #ffffffff
    
    if (noise > 0.8) {
      color += vec3(0.05, 0.1, 0.05) * sin(uTime + noise * 10.0);
    }
    
    // 增加噪点/颗粒感
    color += (random(st + uTime) - 0.5) * 0.05;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function Scene() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime();
      material.uniforms.uResolution.value.set(viewport.width, viewport.height);
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export default function PixelDistortion() {
  return (
    <div className="absolute inset-0 z0 overflow-hidden pointer-events-none">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <Scene />
      </Canvas>
    </div>
  );
}
