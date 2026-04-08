"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { ToolComponentProps } from "../tool-configs";
import {
  clamp,
  createExtrudedLogoGroup,
  createFallbackPanoramaTexture,
  DEFAULT_BACKGROUND_URL,
  DEFAULT_SVG,
  DEFAULT_SVG_ASSET_URL,
  disposeGroup,
} from "./glass-logo-panorama-utils";

type Props = ToolComponentProps & {
  backgroundUrl?: string;
  svgAssetUrl?: string;
  svgUrl?: string;
  color?: string;
  transmission?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  ior?: number;
  thickness?: number;
  extrudeDepth?: number;
  bevelThickness?: number;
  bevelSize?: number;
  logoSize?: number;
  bgScale?: number;
  bgSpeed?: number;
  autoRotate?: boolean;
  followCursor?: boolean;
  cameraTiltFreedom?: number;
  lightIntensity?: number;
  isPreview?: boolean;
};

const GlassLogoPanoramaAdapter: React.FC<Props> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const logoWrapperRef = useRef<THREE.Group | null>(null);
  const bgSphereRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const svgPathsRef = useRef<THREE.ShapePath[] | null>(null);
  const envTextureRef = useRef<THREE.Texture | null>(null);
  const bgTextureRef = useRef<THREE.Texture | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);

  const settings = useMemo(() => ({
    backgroundUrl: typeof props.backgroundUrl === "string" && props.backgroundUrl.trim() ? props.backgroundUrl.trim() : DEFAULT_BACKGROUND_URL,
    svgSrc: typeof props.svgUrl === "string" && props.svgUrl.trim()
      ? props.svgUrl.trim()
      : typeof props.svgAssetUrl === "string" && props.svgAssetUrl.trim()
        ? props.svgAssetUrl.trim()
        : DEFAULT_SVG_ASSET_URL,
    color: typeof props.color === "string" ? props.color : "#ffffff",
    transmission: clamp(Number(props.transmission ?? 1), 0, 1),
    opacity: clamp(Number(props.opacity ?? 1), 0.15, 1),
    metalness: clamp(Number(props.metalness ?? 0.1), 0, 1),
    roughness: clamp(Number(props.roughness ?? 0), 0, 1),
    ior: clamp(Number(props.ior ?? 2.33), 1, 2.33),
    thickness: clamp(Number(props.thickness ?? 90), 0, 100),
    extrudeDepth: clamp(Number(props.extrudeDepth ?? 150), 1, 500),
    bevelThickness: clamp(Number(props.bevelThickness ?? 50), 0, 100),
    bevelSize: clamp(Number(props.bevelSize ?? 6.5), 0, 100),
    logoSize: clamp(Number(props.logoSize ?? 0.1), 0.01, 5),
    bgScale: clamp(Number(props.bgScale ?? 0.5), 0.2, 5),
    bgSpeed: clamp(Number(props.bgSpeed ?? 0.14), -0.5, 0.5),
    autoRotate: typeof props.autoRotate === "boolean" ? props.autoRotate : true,
    followCursor: typeof props.followCursor === "boolean" ? props.followCursor : true,
    cameraTiltFreedom: clamp(Number(props.cameraTiltFreedom ?? 28), 0, 90),
    lightIntensity: clamp(Number(props.lightIntensity ?? 2), 0, 10),
    isPreview: Boolean(props.isPreview),
    renderWidth: typeof props.renderWidth === "number" ? props.renderWidth : undefined,
    renderHeight: typeof props.renderHeight === "number" ? props.renderHeight : undefined,
  }), [
    props.autoRotate,
    props.backgroundUrl,
    props.bevelSize,
    props.bevelThickness,
    props.bgScale,
    props.bgSpeed,
    props.cameraTiltFreedom,
    props.color,
    props.extrudeDepth,
    props.followCursor,
    props.ior,
    props.isPreview,
    props.lightIntensity,
    props.logoSize,
    props.metalness,
    props.opacity,
    props.roughness,
    props.svgAssetUrl,
    props.svgUrl,
    props.thickness,
    props.transmission,
    props.renderHeight,
    props.renderWidth,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 5000);
    camera.position.set(0, 0, 250);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(settings.renderWidth && settings.renderHeight ? 1 : Math.min(window.devicePixelRatio || 1, settings.isPreview ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const dirLight = new THREE.DirectionalLight(0xffffff, settings.lightIntensity);
    dirLight.position.set(50, 50, 50);
    const pointLight = new THREE.PointLight(0xabcdef, Math.max(0, settings.lightIntensity * 2.5), 500);
    pointLight.position.set(-50, -50, 50);
    scene.add(ambientLight, dirLight, pointLight);

    const sphereGeometry = new THREE.SphereGeometry(1500, 60, 40);
    const sphereMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xffffff });
    const bgSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(bgSphere);

    const logoWrapper = new THREE.Group();
    scene.add(logoWrapper);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(settings.color),
      metalness: settings.metalness,
      roughness: settings.roughness,
      transmission: settings.transmission,
      ior: settings.ior,
      thickness: settings.thickness,
      transparent: true,
      opacity: settings.opacity,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    clockRef.current = new THREE.Clock();
    logoWrapperRef.current = logoWrapper;
    bgSphereRef.current = bgSphere;
    materialRef.current = glassMaterial;
    dirLightRef.current = dirLight;
    pointLightRef.current = pointLight;

    const resize = (width: number, height: number) => {
      const safeWidth = Math.max(1, Math.floor(width));
      const safeHeight = Math.max(1, Math.floor(height));
      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
    };

    if (settings.renderWidth && settings.renderHeight) {
      resize(settings.renderWidth, settings.renderHeight);
    } else {
      resize(container.clientWidth || 1, container.clientHeight || 1);
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        resize(width, height);
      });
      ro.observe(container);
      resizeObserverRef.current = ro;
    }

    const textureLoader = new THREE.TextureLoader();
    const svgLoader = new SVGLoader();

    const applyPanoramaTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const envTex = texture.clone();
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = envTex;
      envTextureRef.current = envTex;

      const visTex = texture.clone();
      visTex.mapping = THREE.UVMapping;
      visTex.wrapS = THREE.RepeatWrapping;
      visTex.wrapT = THREE.ClampToEdgeWrapping;
      visTex.minFilter = THREE.LinearFilter;
      visTex.magFilter = THREE.LinearFilter;
      visTex.generateMipmaps = false;
      visTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const material = bgSphere.material as THREE.MeshBasicMaterial;
      if (material.map) material.map.dispose();
      material.map = visTex;
      material.needsUpdate = true;
      bgTextureRef.current = visTex;
    };

    const updateBgScale = () => {
      const material = bgSphere.material as THREE.MeshBasicMaterial;
      const map = material.map;
      if (!map) return;
      const scale = Math.max(0.001, settings.bgScale);
      map.repeat.set(1 / scale, 1 / scale);
      map.offset.set((1 - 1 / scale) / 2, (1 - 1 / scale) / 2);
      map.needsUpdate = true;
    };

    const loadBackground = (url: string) => {
      textureLoader.load(
        url,
        (texture) => {
          applyPanoramaTexture(texture);
          updateBgScale();
        },
        undefined,
        () => {
          const fallback = createFallbackPanoramaTexture();
          applyPanoramaTexture(fallback);
          updateBgScale();
        },
      );
    };

    const generateLogoGeometry = () => {
      const paths = svgPathsRef.current;
      const material = materialRef.current;
      const wrapper = logoWrapperRef.current;
      if (!paths || !material || !wrapper) return;
      disposeGroup(wrapper);
      const logoGroup = createExtrudedLogoGroup(paths, material, settings.extrudeDepth, settings.bevelThickness, settings.bevelSize);
      wrapper.add(logoGroup);
      wrapper.scale.setScalar(settings.logoSize);
    };

    const loadSvgText = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load SVG: ${res.status}`);
      return res.text();
    };

    const loadSvg = async (url: string) => {
      try {
        let data: { paths: THREE.ShapePath[] };
        if (url.startsWith("blob:")) {
          data = await new Promise<{ paths: THREE.ShapePath[] }>((resolve, reject) => {
            svgLoader.load(url, resolve, undefined, reject);
          });
        } else {
          const text = await loadSvgText(url);
          data = svgLoader.parse(text);
        }
        svgPathsRef.current = data.paths;
        generateLogoGeometry();
      } catch {
        const data = svgLoader.parse(DEFAULT_SVG);
        svgPathsRef.current = data.paths;
        generateLogoGeometry();
      }
    };

    loadBackground(settings.backgroundUrl || DEFAULT_BACKGROUND_URL);
    loadSvg(settings.svgSrc || DEFAULT_SVG_ASSET_URL);

    const cameraOffset = new THREE.Vector2();
    const targetOffset = new THREE.Vector2();

    const animate = () => {
      const clock = clockRef.current;
      const delta = clock ? clock.getDelta() : 0.016;
      const elapsed = clock ? clock.getElapsedTime() : 0;

      if (settings.autoRotate && logoWrapper) {
        logoWrapper.rotation.y += 0.3 * delta;
        logoWrapper.rotation.x = Math.sin(elapsed * 0.5) * 0.2;
      }

      if (bgSphere) {
        bgSphere.rotation.y += settings.bgSpeed * delta;
        const sceneWithRotation = scene as unknown as { environmentRotation?: THREE.Euler };
        if (sceneWithRotation.environmentRotation) {
          sceneWithRotation.environmentRotation.y = bgSphere.rotation.y;
        }
      }

      if (settings.followCursor) {
        const freedom = settings.cameraTiltFreedom / 90;
        targetOffset.x = pointerRef.current.x * -20 * freedom;
        targetOffset.y = pointerRef.current.y * -20 * freedom;
      } else {
        targetOffset.set(0, 0);
      }

      cameraOffset.lerp(targetOffset, 0.05);
      const originalPos = camera.position.clone();
      const originalQuat = camera.quaternion.clone();

      if (cameraOffset.lengthSq() > 0.0001) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        camera.position.addScaledVector(right, cameraOffset.x);
        camera.position.addScaledVector(up, cameraOffset.y);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      camera.position.copy(originalPos);
      camera.quaternion.copy(originalQuat);

      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (logoWrapperRef.current) {
        disposeGroup(logoWrapperRef.current);
        logoWrapperRef.current.clear();
        logoWrapperRef.current = null;
      }
      if (bgSphereRef.current) {
        const sphere = bgSphereRef.current;
        (sphere.geometry as THREE.BufferGeometry).dispose();
        const mat = sphere.material as THREE.MeshBasicMaterial;
        if (mat.map) mat.map.dispose();
        mat.dispose();
        scene.remove(sphere);
        bgSphereRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
      if (envTextureRef.current) {
        envTextureRef.current.dispose();
        envTextureRef.current = null;
      }
      if (bgTextureRef.current) {
        bgTextureRef.current.dispose();
        bgTextureRef.current = null;
      }
      dirLightRef.current = null;
      pointLightRef.current = null;
      svgPathsRef.current = null;

      if (rendererRef.current) {
        const nextRenderer = rendererRef.current;
        rendererRef.current = null;
        if (nextRenderer.domElement.parentElement) {
          nextRenderer.domElement.parentElement.removeChild(nextRenderer.domElement);
        }
        nextRenderer.dispose();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      clockRef.current = null;
    };
  }, []);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.color.set(settings.color);
    material.metalness = settings.metalness;
    material.roughness = settings.roughness;
    material.transmission = settings.transmission;
    material.ior = settings.ior;
    material.thickness = settings.thickness;
    material.opacity = settings.opacity;
    material.needsUpdate = true;
  }, [
    settings.color,
    settings.ior,
    settings.metalness,
    settings.opacity,
    settings.roughness,
    settings.thickness,
    settings.transmission,
  ]);

  useEffect(() => {
    const dirLight = dirLightRef.current;
    const pointLight = pointLightRef.current;
    if (dirLight) dirLight.intensity = settings.lightIntensity;
    if (pointLight) pointLight.intensity = Math.max(0, settings.lightIntensity * 2.5);
  }, [settings.lightIntensity]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const bgSphere = bgSphereRef.current;
    if (!scene || !renderer || !bgSphere) return;
    const textureLoader = new THREE.TextureLoader();

    const applyPanoramaTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const envTex = texture.clone();
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      if (envTextureRef.current) envTextureRef.current.dispose();
      scene.environment = envTex;
      envTextureRef.current = envTex;

      const visTex = texture.clone();
      visTex.mapping = THREE.UVMapping;
      visTex.wrapS = THREE.RepeatWrapping;
      visTex.wrapT = THREE.ClampToEdgeWrapping;
      visTex.minFilter = THREE.LinearFilter;
      visTex.magFilter = THREE.LinearFilter;
      visTex.generateMipmaps = false;
      visTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const material = bgSphere.material as THREE.MeshBasicMaterial;
      if (material.map) material.map.dispose();
      material.map = visTex;
      material.needsUpdate = true;
      if (bgTextureRef.current) bgTextureRef.current.dispose();
      bgTextureRef.current = visTex;
    };

    const updateBgScale = () => {
      const material = bgSphere.material as THREE.MeshBasicMaterial;
      const map = material.map;
      if (!map) return;
      const scale = Math.max(0.001, settings.bgScale);
      map.repeat.set(1 / scale, 1 / scale);
      map.offset.set((1 - 1 / scale) / 2, (1 - 1 / scale) / 2);
      map.needsUpdate = true;
    };

    textureLoader.load(
      settings.backgroundUrl || DEFAULT_BACKGROUND_URL,
      (texture) => {
        applyPanoramaTexture(texture);
        updateBgScale();
      },
      undefined,
      () => {
        const fallback = createFallbackPanoramaTexture();
        applyPanoramaTexture(fallback);
        updateBgScale();
      },
    );
  }, [settings.backgroundUrl, settings.bgScale]);

  useEffect(() => {
    const wrapper = logoWrapperRef.current;
    if (wrapper) wrapper.scale.setScalar(settings.logoSize);
  }, [settings.logoSize]);

  useEffect(() => {
    const paths = svgPathsRef.current;
    const material = materialRef.current;
    const wrapper = logoWrapperRef.current;
    if (!paths || !material || !wrapper) return;
    disposeGroup(wrapper);
    const logoGroup = createExtrudedLogoGroup(paths, material, settings.extrudeDepth, settings.bevelThickness, settings.bevelSize);
    wrapper.add(logoGroup);
  }, [settings.bevelSize, settings.bevelThickness, settings.extrudeDepth]);

  useEffect(() => {
    const wrapper = logoWrapperRef.current;
    const material = materialRef.current;
    if (!wrapper || !material) return;
    const svgLoader = new SVGLoader();

    const generateLogoGeometry = () => {
      const paths = svgPathsRef.current;
      if (!paths) return;
      disposeGroup(wrapper);
      const logoGroup = createExtrudedLogoGroup(paths, material, settings.extrudeDepth, settings.bevelThickness, settings.bevelSize);
      wrapper.add(logoGroup);
      wrapper.scale.setScalar(settings.logoSize);
    };

    const loadSvgText = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load SVG: ${res.status}`);
      return res.text();
    };

    const load = async () => {
      try {
        let data: { paths: THREE.ShapePath[] };
        const url = settings.svgSrc || DEFAULT_SVG_ASSET_URL;
        if (url.startsWith("blob:")) {
          data = await new Promise<{ paths: THREE.ShapePath[] }>((resolve, reject) => {
            svgLoader.load(url, resolve, undefined, reject);
          });
        } else {
          const text = await loadSvgText(url);
          data = svgLoader.parse(text);
        }
        svgPathsRef.current = data.paths;
        generateLogoGeometry();
      } catch {
        const data = svgLoader.parse(DEFAULT_SVG);
        svgPathsRef.current = data.paths;
        generateLogoGeometry();
      }
    };

    void load();
  }, [settings.svgSrc, settings.bevelSize, settings.bevelThickness, settings.extrudeDepth, settings.logoSize]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!settings.followCursor || settings.isPreview) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 2 - 1 : 0;
    const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 2 - 1 : 0;
    pointerRef.current = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  };

  const handlePointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-[inherit] bg-[#05070c]"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
    </div>
  );
};

export default GlassLogoPanoramaAdapter;
