"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo, useEffect } from "react"
import * as THREE from "three"

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 iResolution;
  uniform float iTime;
  uniform vec4 uColor1;
  uniform vec4 uColor2;
  uniform vec4 uColor3;
  
  varying vec2 vUv;

  #define PI 3.14159265359

  // Animation & Visual Controls
  const int ZOOM = 10;                            // Iteration count / detail complexity
  const float ANIMATION_SPEED = 2.0;              // Overall animation speed 
  const float WARP_INTENSITY = 1.25;              // Distortion strength

  // Custom palette interpolation
  vec4 customPalette(float t) {
      // Map 0.0-1.0 to segments:
      // 0.0 - 0.5: c1 -> c2
      // 0.5 - 1.0: c2 -> c3
      
      float t1 = clamp(t * 2.0, 0.0, 1.0);
      float t2 = clamp((t - 0.5) * 2.0, 0.0, 1.0);
      
      if (t < 0.5) {
          return mix(uColor1, uColor2, t * 2.0);
      } else {
          return mix(uColor2, uColor3, (t - 0.5) * 2.0);
      }
  }

  // Helper function for smooth parameter oscillation
  float cosRange(float amt, float range, float minimum) {
      return (((1.0 + cos(radians(amt))) * 0.5) * range) + minimum;
  }

  void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      float time = iTime * ANIMATION_SPEED;
      
      vec2 uv = fragCoord.xy / iResolution.xy;
      vec2 p = (2.0*fragCoord.xy - iResolution.xy) / max(iResolution.x, iResolution.y);

      // Animation Parameters
      float ct = cosRange(time*5.0, 3.0, 1.1);
      float xBoost = cosRange(time*0.2, 5.0, 5.0);
      float yBoost = cosRange(time*0.1, 10.0, 5.0);
      float fScale = cosRange(time*15.5, 1.25, 0.5);

      // Displacement Loop (iterative domain warping)
      for(int i = 1; i < ZOOM; i++) {
          float _i = float(i);
          vec2 newp = p;
          newp.x += 0.25/_i * sin(_i*p.y + time*cos(ct)*0.5/20.0 + 0.005*_i) * fScale * WARP_INTENSITY + xBoost;
          newp.y += 0.25/_i * sin(_i*p.x + time*ct*0.3/40.0 + 0.03*float(i+15)) * fScale * WARP_INTENSITY + yBoost;
          p = newp;
      }

      // Generate color using custom palette
      float gradientInput = (sin(p.x * 3.0) + sin(p.y * 3.0) + sin((p.x + p.y) * 2.0)) * 0.25 + 0.5;
      
      vec4 col = customPalette(gradientInput);

      gl_FragColor = col;
  }
`

interface WarpFlowCardProps {
    color1?: string;
    color2?: string;
    color3?: string;
}

const WarpFlowCard = ({
    color1 = "#3f8fffff", // Bright Purple
    color2 = "#dba2ffff", // Violet
    color3 = "#74d6c6ff"  // Pink
}: WarpFlowCardProps) => {
    const mesh = useRef<THREE.Mesh>(null)
    const { viewport } = useThree()

    // Helper to parse hex8 (RRGGBBAA) or hex6 (RRGGBB) to vec4
    const parseColor = (hex: string) => {
        const c = new THREE.Color(hex);
        return new THREE.Vector4(c.r, c.g, c.b, 1.0);
    }

    const uniforms = useMemo(
        () => ({
            iTime: { value: 0.0 },
            iResolution: { value: new THREE.Vector3() },
            uColor1: { value: parseColor(color1) },
            uColor2: { value: parseColor(color2) },
            uColor3: { value: parseColor(color3) },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    )

    // Update uniforms when props change
    useEffect(() => {
        uniforms.uColor1.value = parseColor(color1);
        uniforms.uColor2.value = parseColor(color2);
        uniforms.uColor3.value = parseColor(color3);
    }, [color1, color2, color3, uniforms]);

    useFrame((state) => {
        if (mesh.current) {
            uniforms.iTime.value = state.clock.getElapsedTime()
            uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1)
        }
    })

    return (
        <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent={true}
            />
        </mesh>
    )
}

export default WarpFlowCard
