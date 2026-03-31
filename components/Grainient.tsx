import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

interface GrainientProps {
  timeSpeed?: number;
  colorBalance?: number;
  warpStrength?: number;
  warpFrequency?: number;
  warpSpeed?: number;
  warpAmplitude?: number;
  blendAngle?: number;
  blendSoftness?: number;
  rotationAmount?: number;
  noiseScale?: number;
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  centerX?: number;
  centerY?: number;
  zoom?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} 
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} 
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

const Grainient: React.FC<GrainientProps> = ({
  timeSpeed = 0.25,
  colorBalance = 0.0,
  warpStrength = 1.0,
  warpFrequency = 5.0,
  warpSpeed = 2.0,
  warpAmplitude = 50.0,
  blendAngle = 0.0,
  blendSoftness = 0.05,
  rotationAmount = 500.0,
  noiseScale = 2.0,
  grainAmount = 0.1,
  grainScale = 2.0,
  grainAnimated = false,
  contrast = 1.5,
  gamma = 1.0,
  saturation = 1.0,
  centerX = 0.0,
  centerY = 0.0,
  zoom = 0.9,
  color1 = '#FF9FFC',
  color2 = '#5227FF',
  color3 = '#B19EEF',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uniformsRef = useRef<Record<string, { value: number | Float32Array }> | null>(null);
  const speedTargetRef = useRef(Math.max(0, timeSpeed));
  const speedCurrentRef = useRef(Math.max(0, timeSpeed));
  const flowTimeRef = useRef(0);
  const previousFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    speedTargetRef.current = Math.max(0, timeSpeed);
  }, [timeSpeed]);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });

    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const container = containerRef.current;
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uColorBalance: { value: 0.0 },
        uWarpStrength: { value: 1.0 },
        uWarpFrequency: { value: 5.0 },
        uWarpSpeed: { value: 2.0 },
        uWarpAmplitude: { value: 50.0 },
        uBlendAngle: { value: 0.0 },
        uBlendSoftness: { value: 0.05 },
        uRotationAmount: { value: 500.0 },
        uNoiseScale: { value: 2.0 },
        uGrainAmount: { value: 0.1 },
        uGrainScale: { value: 2.0 },
        uGrainAnimated: { value: 0.0 },
        uContrast: { value: 1.5 },
        uGamma: { value: 1.0 },
        uSaturation: { value: 1.0 },
        uCenterOffset: { value: new Float32Array([0, 0]) },
        uZoom: { value: 0.9 },
        uColor1: { value: new Float32Array(hexToRgb('#FF9FFC')) },
        uColor2: { value: new Float32Array(hexToRgb('#5227FF')) },
        uColor3: { value: new Float32Array(hexToRgb('#B19EEF')) }
      }
    });
    uniformsRef.current = program.uniforms as Record<string, { value: number | Float32Array }>;

    const mesh = new Mesh(gl, { geometry, program });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height);
      const res = (program.uniforms.iResolution as { value: Float32Array }).value;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    let raf = 0;
    const loop = (t: number) => {
      const now = t * 0.001;
      const previous = previousFrameTimeRef.current;
      const delta = previous == null ? 0 : Math.max(0, Math.min(0.08, now - previous));
      previousFrameTimeRef.current = now;

      const smoothing = 1 - Math.exp(-10 * delta);
      speedCurrentRef.current += (speedTargetRef.current - speedCurrentRef.current) * smoothing;
      flowTimeRef.current += delta * speedCurrentRef.current;
      (program.uniforms.iTime as { value: number }).value = flowTimeRef.current;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      uniformsRef.current = null;
      previousFrameTimeRef.current = null;
      try {
        container.removeChild(canvas);
      } catch {
        // Ignore
      }
    };
  }, []);

  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) {
      return;
    }

    (uniforms.uColorBalance as { value: number }).value = colorBalance;
    (uniforms.uWarpStrength as { value: number }).value = warpStrength;
    (uniforms.uWarpFrequency as { value: number }).value = warpFrequency;
    (uniforms.uWarpSpeed as { value: number }).value = warpSpeed;
    (uniforms.uWarpAmplitude as { value: number }).value = warpAmplitude;
    (uniforms.uBlendAngle as { value: number }).value = blendAngle;
    (uniforms.uBlendSoftness as { value: number }).value = blendSoftness;
    (uniforms.uRotationAmount as { value: number }).value = rotationAmount;
    (uniforms.uNoiseScale as { value: number }).value = noiseScale;
    (uniforms.uGrainAmount as { value: number }).value = grainAmount;
    (uniforms.uGrainScale as { value: number }).value = grainScale;
    (uniforms.uGrainAnimated as { value: number }).value = grainAnimated ? 1.0 : 0.0;
    (uniforms.uContrast as { value: number }).value = contrast;
    (uniforms.uGamma as { value: number }).value = gamma;
    (uniforms.uSaturation as { value: number }).value = saturation;
    (uniforms.uZoom as { value: number }).value = zoom;

    const center = (uniforms.uCenterOffset as { value: Float32Array }).value;
    center[0] = centerX;
    center[1] = centerY;

    const color1Value = hexToRgb(color1);
    const color2Value = hexToRgb(color2);
    const color3Value = hexToRgb(color3);
    const color1Uniform = (uniforms.uColor1 as { value: Float32Array }).value;
    const color2Uniform = (uniforms.uColor2 as { value: Float32Array }).value;
    const color3Uniform = (uniforms.uColor3 as { value: Float32Array }).value;
    color1Uniform[0] = color1Value[0];
    color1Uniform[1] = color1Value[1];
    color1Uniform[2] = color1Value[2];
    color2Uniform[0] = color2Value[0];
    color2Uniform[1] = color2Value[1];
    color2Uniform[2] = color2Value[2];
    color3Uniform[0] = color3Value[0];
    color3Uniform[1] = color3Value[1];
    color3Uniform[2] = color3Value[2];
  }, [
    colorBalance,
    warpStrength,
    warpFrequency,
    warpSpeed,
    warpAmplitude,
    blendAngle,
    blendSoftness,
    rotationAmount,
    noiseScale,
    grainAmount,
    grainScale,
    grainAnimated,
    contrast,
    gamma,
    saturation,
    centerX,
    centerY,
    zoom,
    color1,
    color2,
    color3,
  ]);

  return <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className}`.trim()} />;
};

export default Grainient;
