"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ToolComponentProps } from "../tool-configs";

type Signal = {
  mesh: THREE.Line;
  laneIndex: number;
  speed: number;
  progress: number;
  history: THREE.Vector3[];
  assignedColor: THREE.Color;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const DataTunnelAdapter: React.FC<ToolComponentProps> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);

  const bgMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const signalMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const signalColor1Ref = useRef<THREE.Color | null>(null);
  const signalColor2Ref = useRef<THREE.Color | null>(null);
  const signalColor3Ref = useRef<THREE.Color | null>(null);
  const backgroundLinesRef = useRef<THREE.Line[]>([]);
  const signalsRef = useRef<Signal[]>([]);

  const segmentCount = useMemo(() => (props.isPreview ? 90 : 150), [props.isPreview]);
  const maxTrail = useMemo(() => (props.isPreview ? 110 : 200), [props.isPreview]);

  const settings = useMemo(() => {
    const curveLength = typeof props.curveLength === "number" ? props.curveLength : 50;
    const straightLength = typeof props.straightLength === "number" ? props.straightLength : 100;
    const lineCountRaw = typeof props.lineCount === "number" ? props.lineCount : 80;
    const signalCountRaw = typeof props.signalCount === "number" ? props.signalCount : 94;
    const trailLengthRaw = typeof props.trailLength === "number" ? props.trailLength : 3;

    const lineCount = props.isPreview ? clamp(Math.floor(lineCountRaw), 10, 50) : clamp(Math.floor(lineCountRaw), 1, 1000);
    const signalCount = props.isPreview ? clamp(Math.floor(signalCountRaw), 0, 60) : clamp(Math.floor(signalCountRaw), 0, 1000);
    const trailLength = props.isPreview ? clamp(Math.floor(trailLengthRaw), 0, 40) : clamp(Math.floor(trailLengthRaw), 0, 180);

    return {
      colorBg: typeof props.colorBg === "string" ? props.colorBg : "#080808",
      colorLine: typeof props.colorLine === "string" ? props.colorLine : "#373f48",
      colorSignal: typeof props.colorSignal === "string" ? props.colorSignal : "#8fc9ff",
      useColor2: typeof props.useColor2 === "boolean" ? props.useColor2 : false,
      colorSignal2: typeof props.colorSignal2 === "string" ? props.colorSignal2 : "#ff0055",
      useColor3: typeof props.useColor3 === "boolean" ? props.useColor3 : false,
      colorSignal3: typeof props.colorSignal3 === "string" ? props.colorSignal3 : "#ffcc00",
      lineCount,
      globalRotation: typeof props.globalRotation === "number" ? props.globalRotation : 0,
      positionX: typeof props.positionX === "number" ? props.positionX : (curveLength - straightLength) / 2,
      positionY: typeof props.positionY === "number" ? props.positionY : 0,
      spreadHeight: typeof props.spreadHeight === "number" ? props.spreadHeight : 30.33,
      spreadDepth: typeof props.spreadDepth === "number" ? props.spreadDepth : 0,
      curveLength,
      straightLength,
      curvePower: typeof props.curvePower === "number" ? props.curvePower : 0.8265,
      waveSpeed: typeof props.waveSpeed === "number" ? props.waveSpeed : 2.48,
      waveHeight: typeof props.waveHeight === "number" ? props.waveHeight : 0.145,
      lineOpacity: typeof props.lineOpacity === "number" ? props.lineOpacity : 0.557,
      signalCount,
      speedGlobal: typeof props.speedGlobal === "number" ? props.speedGlobal : 0.345,
      trailLength,
      bloomStrength: typeof props.bloomStrength === "number" ? props.bloomStrength : 3.0,
      bloomRadius: typeof props.bloomRadius === "number" ? props.bloomRadius : 0.5,
    };
  }, [
    props.isPreview,
    props.colorBg,
    props.colorLine,
    props.colorSignal,
    props.useColor2,
    props.colorSignal2,
    props.useColor3,
    props.colorSignal3,
    props.lineCount,
    props.globalRotation,
    props.positionX,
    props.positionY,
    props.spreadHeight,
    props.spreadDepth,
    props.curveLength,
    props.straightLength,
    props.curvePower,
    props.waveSpeed,
    props.waveHeight,
    props.lineOpacity,
    props.signalCount,
    props.speedGlobal,
    props.trailLength,
    props.bloomStrength,
    props.bloomRadius,
  ]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(settingsRef.current.colorBg);
    const fog = new THREE.FogExp2(bgColor, 0.002);
    scene.background = bgColor;
    scene.fog = fog;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
    camera.position.set(0, 0, 90);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    rendererRef.current = renderer;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPassRef.current = bloomPass;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const contentGroup = new THREE.Group();
    contentGroupRef.current = contentGroup;
    scene.add(contentGroup);

    const bgMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(settingsRef.current.colorLine),
      transparent: true,
      opacity: clamp(settingsRef.current.lineOpacity, 0, 1),
      depthWrite: false,
    });
    bgMaterialRef.current = bgMaterial;

    const signalMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    signalMaterialRef.current = signalMaterial;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const hasFixedRenderSize = typeof props.renderWidth === "number" && typeof props.renderHeight === "number";
      const dpr = hasFixedRenderSize ? 1 : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.max(2, Math.floor(hasFixedRenderSize ? props.renderWidth! : rect.width));
      const h = Math.max(2, Math.floor(hasFixedRenderSize ? props.renderHeight! : rect.height));
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      bloomPass.setSize(w, h);
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    const clock = new THREE.Clock();

    const signalColorObj1 = new THREE.Color(settingsRef.current.colorSignal);
    const signalColorObj2 = new THREE.Color(settingsRef.current.colorSignal2);
    const signalColorObj3 = new THREE.Color(settingsRef.current.colorSignal3);
    signalColor1Ref.current = signalColorObj1;
    signalColor2Ref.current = signalColorObj2;
    signalColor3Ref.current = signalColorObj3;

    const pickSignalColor = () => {
      const s = settingsRef.current;
      const choices = [signalColorObj1];
      if (s.useColor2) choices.push(signalColorObj2);
      if (s.useColor3) choices.push(signalColorObj3);
      return choices[Math.floor(Math.random() * choices.length)];
    };

    const cleanupLines = () => {
      const content = contentGroupRef.current;
      if (!content) return;
      backgroundLinesRef.current.forEach((l) => {
        content.remove(l);
        l.geometry.dispose();
      });
      backgroundLinesRef.current = [];
    };

    const cleanupSignals = () => {
      const content = contentGroupRef.current;
      if (!content) return;
      signalsRef.current.forEach((s) => {
        content.remove(s.mesh);
        s.mesh.geometry.dispose();
      });
      signalsRef.current = [];
    };

    const rebuildSignals = () => {
      const content = contentGroupRef.current;
      const sigMat = signalMaterialRef.current;
      if (!content || !sigMat) return;

      cleanupSignals();
      const s = settingsRef.current;
      for (let i = 0; i < s.signalCount; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxTrail * 3);
        const colors = new Float32Array(maxTrail * 3);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const mesh = new THREE.Line(geometry, sigMat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        content.add(mesh);

        signalsRef.current.push({
          mesh,
          laneIndex: Math.floor(Math.random() * Math.max(1, s.lineCount)),
          speed: 0.2 + Math.random() * 0.5,
          progress: Math.random(),
          history: [],
          assignedColor: pickSignalColor(),
        });
      }
    };

    const rebuildLines = () => {
      const content = contentGroupRef.current;
      const bgMat = bgMaterialRef.current;
      if (!content || !bgMat) return;

      cleanupLines();
      const s = settingsRef.current;
      for (let i = 0; i < s.lineCount; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(segmentCount * 3);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const line = new THREE.Line(geometry, bgMat);
        line.userData = { id: i };
        line.renderOrder = 0;
        content.add(line);
        backgroundLinesRef.current.push(line);
      }

      rebuildSignals();
    };

    const getPathPoint = (t: number, lineIndex: number, time: number) => {
      const s = settingsRef.current;
      const totalLen = s.curveLength + s.straightLength;
      const currentX = -s.curveLength + t * totalLen;

      let y = 0;
      let z = 0;
      const spreadFactor = (lineIndex / Math.max(1, s.lineCount) - 0.5) * 2;

      if (currentX < 0) {
        const ratio = (currentX + s.curveLength) / s.curveLength;
        let shapeFactor = (Math.cos(ratio * Math.PI) + 1) / 2;
        shapeFactor = Math.pow(shapeFactor, s.curvePower);

        y = spreadFactor * s.spreadHeight * shapeFactor;
        z = spreadFactor * s.spreadDepth * shapeFactor;

        const waveFactor = shapeFactor;
        const wave = Math.sin(time * s.waveSpeed + currentX * 0.1 + lineIndex) * s.waveHeight * waveFactor;
        y += wave;
      }

      return new THREE.Vector3(currentX, y, z);
    };

    rebuildLines();

    const tick = () => {
      const s = settingsRef.current;

      bgColor.set(s.colorBg);
      fog.color.copy(bgColor);

      const content = contentGroupRef.current;
      if (content) {
        content.position.set(s.positionX, s.positionY, 0);
        content.rotation.z = THREE.MathUtils.degToRad(s.globalRotation);
      }

      const bgMat = bgMaterialRef.current;
      if (bgMat) {
        bgMat.color.set(s.colorLine);
        bgMat.opacity = clamp(s.lineOpacity, 0, 1);
      }

      signalColorObj1.set(s.colorSignal);
      signalColorObj2.set(s.colorSignal2);
      signalColorObj3.set(s.colorSignal3);

      const bloomPassCurrent = bloomPassRef.current;
      if (bloomPassCurrent) {
        bloomPassCurrent.strength = s.bloomStrength;
        bloomPassCurrent.radius = s.bloomRadius;
      }

      const time = clock.getElapsedTime();

      backgroundLinesRef.current.forEach((line) => {
        const positions = (line.geometry.attributes.position.array as Float32Array) || new Float32Array();
        const lineId = typeof line.userData?.id === "number" ? (line.userData.id as number) : 0;
        for (let j = 0; j < segmentCount; j++) {
          const tt = j / (segmentCount - 1);
          const vec = getPathPoint(tt, lineId, time);
          positions[j * 3] = vec.x;
          positions[j * 3 + 1] = vec.y;
          positions[j * 3 + 2] = vec.z;
        }
        line.geometry.attributes.position.needsUpdate = true;
      });

      signalsRef.current.forEach((sig) => {
        sig.progress += sig.speed * 0.005 * s.speedGlobal;

        if (sig.progress > 1.0) {
          sig.progress = 0;
          sig.laneIndex = Math.floor(Math.random() * Math.max(1, s.lineCount));
          sig.history = [];
          sig.assignedColor = pickSignalColor();
        }

        const pos = getPathPoint(sig.progress, sig.laneIndex, time);
        sig.history.push(pos);
        if (sig.history.length > s.trailLength + 1) sig.history.shift();

        const positions = sig.mesh.geometry.attributes.position.array as Float32Array;
        const colors = sig.mesh.geometry.attributes.color.array as Float32Array;

        const drawCount = Math.max(1, s.trailLength);
        const currentLen = sig.history.length;

        for (let i = 0; i < drawCount; i++) {
          let index = currentLen - 1 - i;
          if (index < 0) index = 0;
          const p = sig.history[index] || new THREE.Vector3();

          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;

          let alpha = 1;
          if (s.trailLength > 0) alpha = Math.max(0, 1 - i / s.trailLength);

          colors[i * 3] = sig.assignedColor.r * alpha;
          colors[i * 3 + 1] = sig.assignedColor.g * alpha;
          colors[i * 3 + 2] = sig.assignedColor.b * alpha;
        }

        sig.mesh.geometry.setDrawRange(0, drawCount);
        sig.mesh.geometry.attributes.position.needsUpdate = true;
        sig.mesh.geometry.attributes.color.needsUpdate = true;
      });

      composer.render();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();

      cleanupSignals();
      cleanupLines();

      bgMaterial.dispose();
      signalMaterial.dispose();

      composer.dispose();
      renderer.dispose();

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      composerRef.current = null;
      bloomPassRef.current = null;
      contentGroupRef.current = null;
      bgMaterialRef.current = null;
      signalMaterialRef.current = null;
    };
  }, [maxTrail, props.renderHeight, props.renderWidth, segmentCount]);

  const prevLineCountRef = useRef<number | null>(null);
  const prevSignalCountRef = useRef<number | null>(null);

  useEffect(() => {
    const content = contentGroupRef.current;
    const bgMat = bgMaterialRef.current;
    const sigMat = signalMaterialRef.current;
    if (!content || !bgMat || !sigMat) return;

    const lc = settings.lineCount;
    const sc = settings.signalCount;

    if (prevLineCountRef.current === null) prevLineCountRef.current = lc;
    if (prevSignalCountRef.current === null) prevSignalCountRef.current = sc;

    const rebuildSignals = () => {
      signalsRef.current.forEach((s) => {
        content.remove(s.mesh);
        s.mesh.geometry.dispose();
      });
      signalsRef.current = [];

      if (!signalColor1Ref.current) signalColor1Ref.current = new THREE.Color(settingsRef.current.colorSignal);
      if (!signalColor2Ref.current) signalColor2Ref.current = new THREE.Color(settingsRef.current.colorSignal2);
      if (!signalColor3Ref.current) signalColor3Ref.current = new THREE.Color(settingsRef.current.colorSignal3);

      const colorObj1 = signalColor1Ref.current;
      const colorObj2 = signalColor2Ref.current;
      const colorObj3 = signalColor3Ref.current;
      if (!colorObj1 || !colorObj2 || !colorObj3) return;

      const pickSignalColor = () => {
        const s = settingsRef.current;
        const choices = [colorObj1];
        if (s.useColor2) choices.push(colorObj2);
        if (s.useColor3) choices.push(colorObj3);
        return choices[Math.floor(Math.random() * choices.length)];
      };

      for (let i = 0; i < sc; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxTrail * 3);
        const colors = new Float32Array(maxTrail * 3);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const mesh = new THREE.Line(geometry, sigMat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        content.add(mesh);

        signalsRef.current.push({
          mesh,
          laneIndex: Math.floor(Math.random() * Math.max(1, lc)),
          speed: 0.2 + Math.random() * 0.5,
          progress: Math.random(),
          history: [],
          assignedColor: pickSignalColor(),
        });
      }
    };

    const rebuildLines = () => {
      backgroundLinesRef.current.forEach((l) => {
        content.remove(l);
        l.geometry.dispose();
      });
      backgroundLinesRef.current = [];

      for (let i = 0; i < lc; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(segmentCount * 3);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const line = new THREE.Line(geometry, bgMat);
        line.userData = { id: i };
        line.renderOrder = 0;
        content.add(line);
        backgroundLinesRef.current.push(line);
      }

      rebuildSignals();
    };

    if (prevLineCountRef.current !== lc) {
      prevLineCountRef.current = lc;
      prevSignalCountRef.current = sc;
      rebuildLines();
      return;
    }

    if (prevSignalCountRef.current !== sc) {
      prevSignalCountRef.current = sc;
      rebuildSignals();
    }
  }, [settings.lineCount, settings.signalCount, segmentCount, maxTrail]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full bg-black overflow-hidden ${props.isPreview ? 'rounded-none border-0' : 'rounded-2xl border border-white/10'}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default DataTunnelAdapter;
