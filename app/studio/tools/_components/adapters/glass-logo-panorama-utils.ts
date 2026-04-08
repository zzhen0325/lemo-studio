import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export const DEFAULT_BACKGROUND_URL = "/images/3334.png";
export const DEFAULT_SVG_ASSET_URL = "/images/1.svg";
export const DEFAULT_SVG = `<svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M666.667 533.333H400V800L133.333 533.333V266.667H400L666.667 533.333Z" fill="black"/>
  <path d="M666.334 266.667H399.667L133 0H666.334V266.667Z" fill="black"/>
</svg>`;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function disposeGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    child.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
      }
    });
    group.remove(child);
  }
}

export function createExtrudedLogoGroup(
  svgPaths: THREE.ShapePath[],
  material: THREE.MeshPhysicalMaterial,
  extrudeDepth: number,
  bevelThickness: number,
  bevelSize: number,
) {
  const nextGroup = new THREE.Group();
  const extrudeSettings = {
    depth: extrudeDepth,
    bevelEnabled: bevelThickness > 0 || bevelSize > 0,
    bevelSegments: 4,
    steps: 2,
    bevelSize,
    bevelThickness,
  };

  const allShapes: THREE.Shape[] = [];
  svgPaths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    if (shapes.length > 0) {
      allShapes.push(...shapes);
      return;
    }
    allShapes.push(...path.toShapes(true));
  });

  if (allShapes.length === 0) {
    return nextGroup;
  }

  try {
    const geometry = new THREE.ExtrudeGeometry(allShapes, extrudeSettings);
    nextGroup.add(new THREE.Mesh(geometry, material));
  } catch {
    const geometry = new THREE.ExtrudeGeometry(allShapes, {
      ...extrudeSettings,
      bevelEnabled: false,
    });
    nextGroup.add(new THREE.Mesh(geometry, material));
  }

  nextGroup.scale.set(0.6, -0.6, 0.6);
  nextGroup.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(nextGroup);
  const center = box.getCenter(new THREE.Vector3());
  nextGroup.position.set(-center.x, -center.y, -center.z);

  return nextGroup;
}

export function createFallbackPanoramaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#08111f");
  gradient.addColorStop(0.35, "#19385f");
  gradient.addColorStop(0.68, "#4f7baa");
  gradient.addColorStop(1, "#d9b08c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glowA = ctx.createRadialGradient(420, 260, 30, 420, 260, 440);
  glowA.addColorStop(0, "rgba(255,255,255,0.9)");
  glowA.addColorStop(0.25, "rgba(171,224,255,0.42)");
  glowA.addColorStop(1, "rgba(171,224,255,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glowB = ctx.createRadialGradient(1540, 760, 20, 1540, 760, 420);
  glowB.addColorStop(0, "rgba(255,214,172,0.7)");
  glowB.addColorStop(0.3, "rgba(255,170,138,0.22)");
  glowB.addColorStop(1, "rgba(255,170,138,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 120; i += 1) {
    const x = (i * 173) % canvas.width;
    const y = (i * 97) % canvas.height;
    const alpha = 0.03 + (i % 7) * 0.006;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
