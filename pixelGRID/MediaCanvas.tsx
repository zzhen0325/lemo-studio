
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GridParams, PixelShape, ScaleMode, MediaType } from './types';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './constants';

interface MediaCanvasProps {
  mediaUrl: string;
  mediaType: MediaType;
  params: GridParams;
  onReady?: (canvas: HTMLCanvasElement) => void;
  renderWidth?: number;
  renderHeight?: number;
}

const MediaCanvas: React.FC<MediaCanvasProps> = ({ mediaUrl, mediaType, params, onReady, renderWidth, renderHeight }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = renderWidth || containerRef.current.clientWidth || 800;
    const height = renderHeight || containerRef.current.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false // Changed to false to prevent bleed through black
    });
    renderer.setPixelRatio(renderWidth && renderHeight ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        tDiffuse: { value: new THREE.Texture() },
        uTime: { value: 0 },
        uDensity: { value: params.gridDensity },
        uCluster: { value: params.clusterThreshold },
        uSizeScale: { value: params.sizeScale },
        uMinFilter: { value: params.minPixelFilter },
        uChaos: { value: params.rotationChaos },
        uNoiseIntensity: { value: params.redNoiseIntensity },
        uShape: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uMediaResolution: { value: new THREE.Vector2(16, 9) }, // Safer default ratio
        uScaleMode: { value: params.imageScaleMode === ScaleMode.FIT ? 0 : 1 }
      },
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = clock.getElapsedTime() * params.masterSpeed;

        if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
          if (materialRef.current.uniforms.tDiffuse.value) {
            materialRef.current.uniforms.tDiffuse.value.needsUpdate = true;
          }
        }
      }
      if (rendererRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, camera);
      }
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !materialRef.current) return;
      const w = renderWidth || containerRef.current.clientWidth;
      const h = renderHeight || containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      materialRef.current.uniforms.uResolution.value.set(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    onReady?.(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [onReady, renderHeight, renderWidth]);

  // Load Media
  useEffect(() => {
    if (!materialRef.current) return;

    if (mediaType === MediaType.VIDEO) {
      const video = document.createElement('video');
      video.src = mediaUrl;
      video.loop = true;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.playsInline = true;

      video.onloadedmetadata = () => {
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        materialRef.current!.uniforms.tDiffuse.value = texture;
        materialRef.current!.uniforms.uMediaResolution.value.set(video.videoWidth, video.videoHeight);
        videoRef.current = video;
        video.play().catch(e => console.warn("Autoplay blocked or failed", e));
      };
    } else {
      const loader = new THREE.TextureLoader();
      loader.load(mediaUrl, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        materialRef.current!.uniforms.tDiffuse.value = texture;
        materialRef.current!.uniforms.uMediaResolution.value.set(texture.image.width, texture.image.height);
        videoRef.current = null;
      }, undefined, (err) => {
        console.error("Texture loading failed", err);
      });
    }
  }, [mediaUrl, mediaType]);

  // Sync Params
  useEffect(() => {
    if (!materialRef.current) return;
    const m = materialRef.current;
    m.uniforms.uDensity.value = params.gridDensity;
    m.uniforms.uCluster.value = params.clusterThreshold;
    m.uniforms.uSizeScale.value = params.sizeScale;
    m.uniforms.uMinFilter.value = params.minPixelFilter;
    m.uniforms.uChaos.value = params.rotationChaos;
    m.uniforms.uNoiseIntensity.value = params.redNoiseIntensity;
    m.uniforms.uScaleMode.value = params.imageScaleMode === ScaleMode.FIT ? 0 : 1;

    let shapeVal = 0;
    if (params.pixelShape === PixelShape.CIRCLE) shapeVal = 1;
    if (params.pixelShape === PixelShape.TRIANGLE) shapeVal = 2;
    m.uniforms.uShape.value = shapeVal;

    if (videoRef.current) {
      // Limit playback rate to a reasonable range
      videoRef.current.playbackRate = Math.max(0.1, Math.min(params.masterSpeed, 4.0));
    }
  }, [params, params.gridDensity, params.clusterThreshold, params.sizeScale, params.minPixelFilter, params.rotationChaos, params.redNoiseIntensity, params.imageScaleMode, params.pixelShape, params.masterSpeed]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden flex items-center justify-center bg-[#050505]">
      <canvas ref={canvasRef} className="block shadow-[0_0_50px_rgba(0,0,0,1)]" />

      {/* HUD UI overlays */}
      <div className="absolute inset-0 pointer-events-none p-4">
        <div className="h-full border border-white/5 relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-500/30" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-500/30" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-500/30" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-500/30" />

          {/* Center Crosshair (Subtle) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10" />
            <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/10" />
          </div>

          {/* HUD Data */}
          <div className="absolute top-2 left-10 text-[8px] text-zinc-600 uppercase tracking-widest font-mono">
            <p>SYSTEM STATUS: {params.gridDensity > 150 ? 'OVERLOAD_WARNING' : 'NOMINAL'}</p>
            <p>SIGNAL: X-GRID_LINK_v2.1</p>
          </div>
          <div className="absolute bottom-2 right-10 text-[8px] text-zinc-600 uppercase tracking-widest font-mono text-right">
            <p>DENSITY: {params.gridDensity}PXL</p>
            <p>ANALYSIS: {Math.floor(params.clusterThreshold * 100)}% CLUSTER</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaCanvas;
