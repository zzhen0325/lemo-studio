import dynamic from 'next/dynamic';

const SpiralToolAdapter = dynamic(() => import('./adapters/SpiralToolAdapter'), { ssr: false });
const ParticleStairsAdapter = dynamic(() => import('./adapters/ParticleStairsAdapter'), { ssr: false });
const DataTunnelAdapter = dynamic(() => import('./adapters/DataTunnelAdapter'), { ssr: false });
const OrganicBackgroundAdapter = dynamic(() => import('./adapters/OrganicBackgroundAdapter'), { ssr: false });
const GlassLogoPanoramaAdapter = dynamic(() => import('./adapters/GlassLogoPanoramaAdapter'), { ssr: false });
const PrideClockAdapter = dynamic(() => import('./adapters/PrideClockAdapter'), { ssr: false });
const DitherAsciiToolAdapter = dynamic(() => import('./adapters/DitherAsciiToolAdapter'), { ssr: false });

export interface ToolComponentProps {
  onChange?: (id: string, value: number | string | boolean) => void;
  isPreview?: boolean;
  renderWidth?: number;
  renderHeight?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type ToolParamType = 'number' | 'color' | 'boolean' | 'image' | 'text';

export interface ToolParameter {
  id: string;
  name: string;
  type: ToolParamType;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: string | number | boolean;
  category?: string;
  accept?: string;
  placeholder?: string;
  options?: string[];
}

export interface ToolPreset {
  id: string;
  name: string;
  values: Record<string, number | string | boolean>;
  thumbnail?: string;
  timestamp: number;
}

export interface WebGLToolConfig {
  id: string;
  name: string;
  description: string;
  type: 'shader' | 'component';
  supportsCanvasExport?: boolean;
  thumbnail?: string;
  fragmentShader?: string;
  component?: React.ComponentType<ToolComponentProps>;
  parameters: ToolParameter[];
}

export const TOOLS_EXPORT_WIDTH = 3840;
export const TOOLS_EXPORT_HEIGHT = 2160;

export const WEBGL_TOOLS: WebGLToolConfig[] = [
  {
    id: 'dither-ascii-effect',
    name: 'Dither / ASCII Effect',
    description: 'Grid-based halftone/dither renderer with multiple algorithm modes and a shape library (supports custom SVG path).',
    type: 'component',
    supportsCanvasExport: true,
    component: DitherAsciiToolAdapter,
    parameters: [
      { id: 'sourceUrl', name: 'Source Image', type: 'image', defaultValue: '/images/3334.png', accept: 'image/*', category: 'Input' },
      { id: 'cover', name: 'Cover Fit', type: 'boolean', defaultValue: true, category: 'Input' },
      { id: 'customSvgUrl', name: 'Custom SVG', type: 'image', defaultValue: '', accept: '.svg,image/svg+xml', category: 'Input' },

      {
        id: 'mode',
        name: 'Mode',
        type: 'text',
        defaultValue: 'halftone',
        category: 'Algorithm Mode',
        options: [
          'flat',
          'stretch_v',
          'stretch_h',
          'checker',
          'glitch',
          'melt',
          'crosshatch',
          'rotation',
          'halftone',
          'inv_halftone',
          'random_size',
          'random_rot',
          'opacity',
          'inv_opacity',
          'threshold',
          'flow',
          'edges',
          'jitter',
          'posterize',
          'interference',
          'crt_scan',
          'bio',
          'eraser',
        ],
      },
      { id: 'baseScale', name: 'Scale Factor', type: 'number', min: 0.1, max: 3.0, step: 0.025, defaultValue: 0.9, category: 'Algorithm Mode' },
      { id: 'intensity', name: 'Effect Power', type: 'number', min: 0, max: 5.0, step: 0.05, defaultValue: 1.0, category: 'Algorithm Mode' },

      {
        id: 'shape',
        name: 'Shape',
        type: 'text',
        defaultValue: 'circle',
        category: 'Shape Geometry',
        options: [
          'custom',
          'circle',
          'rect',
          'triangle',
          'octagon',
          'star',
          'cross',
          'rect_v',
          'rect_h',
          'hex_v',
          'line_diag_r',
          'line_diag_l',
          'chevron',
          'trapezoid',
          'semi_top',
          'semi_bottom',
          'rect_hollow',
          'spiral',
          'concentric',
          'gear',
          'flower',
          'shuriken',
          'lightning',
          'diamond_hollow',
          'windmill',
          'leaf',
          'ghost',
        ],
      },

      { id: 'cellSize', name: 'Cell Size', type: 'number', min: 4, max: 40, step: 1, defaultValue: 10, category: 'Grid & Color Settings' },
      { id: 'gap', name: 'Gap', type: 'number', min: 0, max: 20, step: 0.25, defaultValue: 1, category: 'Grid & Color Settings' },
      { id: 'contrast', name: 'Contrast', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0, category: 'Grid & Color Settings' },
      { id: 'bgColor', name: 'Background', type: 'color', defaultValue: '#111111', category: 'Grid & Color Settings' },
      { id: 'useColor', name: 'Original Color', type: 'boolean', defaultValue: true, category: 'Grid & Color Settings' },
      { id: 'monoColor', name: 'Foreground Color', type: 'color', defaultValue: '#ffffff', category: 'Grid & Color Settings' },
    ]
  },
  {
    id: 'glass-logo-panorama',
    name: 'Glass Logo Panorama',
    description: 'An extruded glass SVG suspended inside a rotating panoramic environment.',
    type: 'component',
    supportsCanvasExport: false,
    component: GlassLogoPanoramaAdapter,
    parameters: [
      { id: 'backgroundUrl', name: 'Panorama Background', type: 'image', defaultValue: '/images/3334.png', accept: 'image/*', category: 'Input' },
      { id: 'svgAssetUrl', name: 'SVG Logo File', type: 'image', defaultValue: '/images/1.svg', accept: '.svg,image/svg+xml', category: 'Input' },
      { id: 'svgUrl', name: 'SVG URL Override', type: 'text', defaultValue: '', placeholder: 'https://example.com/logo.svg', category: 'Input' },

      { id: 'color', name: 'Glass Tint', type: 'color', defaultValue: '#ffffff', category: 'Glass' },
      { id: 'transmission', name: 'Transmission', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 1, category: 'Glass' },
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0.1, max: 1, step: 0.01, defaultValue: 1, category: 'Glass' },
      { id: 'metalness', name: 'Metalness', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.1, category: 'Glass' },
      { id: 'roughness', name: 'Roughness', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0, category: 'Glass' },
      { id: 'ior', name: 'Index of Refraction', type: 'number', min: 1, max: 2.33, step: 0.01, defaultValue: 2.33, category: 'Glass' },
      { id: 'thickness', name: 'Glass Thickness', type: 'number', min: 0, max: 100, step: 0.1, defaultValue: 90, category: 'Glass' },

      { id: 'extrudeDepth', name: 'Extrude Depth', type: 'number', min: 1, max: 500, step: 1, defaultValue: 1, category: 'Geometry' },
      { id: 'bevelThickness', name: 'Bevel Thickness', type: 'number', min: 0, max: 100, step: 0.1, defaultValue: 50, category: 'Geometry' },
      { id: 'bevelSize', name: 'Bevel Size', type: 'number', min: 0, max: 100, step: 0.1, defaultValue: 5, category: 'Geometry' },
      { id: 'logoSize', name: 'Logo Size', type: 'number', min: 0.01, max: 5, step: 0.01, defaultValue: 0.3, category: 'Geometry' },

      { id: 'bgScale', name: 'Background Scale', type: 'number', min: 0.1, max: 5, step: 0.01, defaultValue: 0.5, category: 'Environment' },
      { id: 'bgSpeed', name: 'Background Speed', type: 'number', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0.14, category: 'Environment' },
      { id: 'lightIntensity', name: 'Main Light', type: 'number', min: 0, max: 10, step: 0.1, defaultValue: 2, category: 'Lighting' },

      { id: 'autoRotate', name: 'Auto Rotate Logo', type: 'boolean', defaultValue: true, category: 'Motion' },
      { id: 'followCursor', name: 'Follow Cursor', type: 'boolean', defaultValue: true, category: 'Motion' },
      { id: 'cameraTiltFreedom', name: 'Camera Tilt Freedom', type: 'number', min: 0, max: 90, step: 1, defaultValue: 28, category: 'Motion' },
    ]
  },
  {
    id: 'pride-clock',
    name: 'Pride Clock',
    description: 'Apple-inspired pride clock with halftone contrast and rainbow radial overlay.',
    type: 'component',
    supportsCanvasExport: false,
    component: PrideClockAdapter,
    parameters: [
      { id: 'useSystemTime', name: 'Use System Time', type: 'boolean', defaultValue: false, category: 'Input' },
      { id: 'liveUpdate', name: 'Live Update', type: 'boolean', defaultValue: true, category: 'Input' },
      { id: 'use12Hour', name: '12-Hour Mode', type: 'boolean', defaultValue: false, category: 'Input' },
      { id: 'textTop', name: 'Text (Top)', type: 'text', defaultValue: 'Lemon8', category: 'Input' },
      { id: 'textBottom', name: 'Text (Bottom)', type: 'text', defaultValue: '', category: 'Input' },
      { id: 'hourOverride', name: 'Hour Override', type: 'number', min: 0, max: 23, step: 1, defaultValue: 9, category: 'Input' },
      { id: 'minuteOverride', name: 'Minute Override', type: 'number', min: 0, max: 59, step: 1, defaultValue: 41, category: 'Input' },

      { id: 'fontScale', name: 'Font Scale', type: 'number', min: 0.1, max: 0.9, step: 0.01, defaultValue: 0.45, category: 'Parameters' },
      { id: 'lineHeight', name: 'Line Height', type: 'number', min: 0.5, max: 1.2, step: 0.01, defaultValue: 0.8, category: 'Parameters' },
      { id: 'letterSpacingEm', name: 'Letter Spacing (em)', type: 'number', min: -0.2, max: 0.2, step: 0.001, defaultValue: -0.05, category: 'Parameters' },
      { id: 'italic', name: 'Italic', type: 'boolean', defaultValue: true, category: 'Parameters' },
      { id: 'fontWeight', name: 'Font Weight', type: 'number', min: 100, max: 1000, step: 10, defaultValue: 1000, category: 'Parameters' },

      { id: 'lineCount', name: 'Line Count', type: 'number', min: 0, max: 600, step: 1, defaultValue: 0, category: 'Parameters' },
      { id: 'lineThickness', name: 'Line Thickness', type: 'number', min: 0, max: 4, step: 0.05, defaultValue: 1, category: 'Parameters' },
      { id: 'densityEm', name: 'Density (em)', type: 'number', min: 0.005, max: 0.2, step: 0.001, defaultValue: 0.05, category: 'Parameters' },
      { id: 'contrastPct', name: 'Contrast (%)', type: 'number', min: 100, max: 4000, step: 50, defaultValue: 2000, category: 'Parameters' },
      { id: 'opacity', name: 'Numbers Opacity', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.46, category: 'Parameters' },

      { id: 'rotateDeg', name: 'Numbers Rotation (deg)', type: 'number', min: -45, max: 45, step: 0.1, defaultValue: 6, category: 'Motion' },

      { id: 'hourTranslateXEm', name: 'Hour X (em)', type: 'number', min: -1, max: 1, step: 0.01, defaultValue: 0.2, category: 'Geometry' },
      { id: 'minTranslateXEm', name: 'Minute X (em)', type: 'number', min: -1, max: 1, step: 0.01, defaultValue: -0.2, category: 'Geometry' },

      { id: 'originXPct', name: 'Radial Origin X (%)', type: 'number', min: -300, max: 300, step: 1, defaultValue: -150, category: 'Geometry' },
      { id: 'originYPct', name: 'Radial Origin Y (%)', type: 'number', min: -200, max: 200, step: 1, defaultValue: -25, category: 'Geometry' },

      { id: 'innerLight', name: 'Inner Light', type: 'color', defaultValue: '#ffffff', category: 'Palette' },
      { id: 'innerMid', name: 'Inner Mid', type: 'color', defaultValue: '#777777', category: 'Palette' },

      { id: 'color1', name: 'Color 1', type: 'color', defaultValue: '#f7b232', category: 'Palette' },
      { id: 'color2', name: 'Color 2', type: 'color', defaultValue: '#e12626', category: 'Palette' },
      { id: 'color3', name: 'Color 3', type: 'color', defaultValue: '#733d2c', category: 'Palette' },
      { id: 'color4', name: 'Color 4', type: 'color', defaultValue: '#2b1d1d', category: 'Palette' },
      { id: 'color5', name: 'Color 5', type: 'color', defaultValue: '#511c69', category: 'Palette' },
      { id: 'color6', name: 'Color 6', type: 'color', defaultValue: '#1c73c4', category: 'Palette' },
      { id: 'color7', name: 'Color 7', type: 'color', defaultValue: '#a0cdfb', category: 'Palette' },
      { id: 'color8', name: 'Color 8', type: 'color', defaultValue: '#69d6ad', category: 'Palette' },
      { id: 'color9', name: 'Color 9', type: 'color', defaultValue: '#ffcd04', category: 'Palette' },
      { id: 'color10', name: 'Color 10', type: 'color', defaultValue: '#fbaaaa', category: 'Palette' },
    ]
  },
  {
    id: 'organic-background',
    name: 'Organic Background',
    description: 'A soft, liquid organic shader surface with smooth lighting and gradient palette.',
    type: 'component',
    component: OrganicBackgroundAdapter,
    parameters: [
      { id: 'color1', name: 'Shadow (Valley)', type: 'color', defaultValue: '#000000', category: 'Gradient' },
      { id: 'color2', name: 'Mid Dark', type: 'color', defaultValue: '#0048ff', category: 'Gradient' },
      { id: 'color3', name: 'Mid Light', type: 'color', defaultValue: '#0088ff', category: 'Gradient' },
      { id: 'color4', name: 'Highlight (Peak)', type: 'color', defaultValue: '#ffffff', category: 'Gradient' },

      { id: 'speed', name: 'Flow Speed', type: 'number', min: 0, max: 0.4, step: 0.001, defaultValue: 0.1148, category: 'Fluid & Waves' },
      { id: 'angle', name: 'Flow Angle', type: 'number', min: -Math.PI, max: Math.PI, step: 0.01, defaultValue: 1.08699, category: 'Fluid & Waves' },
      { id: 'foldFrequency', name: 'Wave Scale', type: 'number', min: 0, max: 5, step: 0.001, defaultValue: 1.865, category: 'Fluid & Waves' },
      { id: 'warpAmount', name: 'Liquid Warp', type: 'number', min: 0, max: 4, step: 0.01, defaultValue: 4.0, category: 'Fluid & Waves' },
      { id: 'noiseScale', name: 'Noise Detail', type: 'number', min: 0, max: 3, step: 0.001, defaultValue: 0.714, category: 'Fluid & Waves' },
      { id: 'connections', name: 'Organic Connections', type: 'number', min: 0, max: 1.5, step: 0.001, defaultValue: 0.8715, category: 'Fluid & Waves' },

      { id: 'depth', name: 'Surface Softness', type: 'number', min: 0, max: 2.5, step: 0.01, defaultValue: 0.04, category: 'Lighting' },
      { id: 'shadowWidth', name: 'Shadow Width', type: 'number', min: 0.01, max: 0.4, step: 0.001, defaultValue: 0.01, category: 'Lighting' },
      { id: 'lightX', name: 'Light X', type: 'number', min: -2, max: 2, step: 0.001, defaultValue: 0.968, category: 'Lighting' },
      { id: 'lightY', name: 'Light Y', type: 'number', min: -2, max: 2, step: 0.001, defaultValue: -0.36, category: 'Lighting' },
    ]
  },
  {
    id: 'deep-sea-flow',
    name: 'Deep Sea Flow',
    description: 'A mesmerizing fluid simulation with deep navy and orange gradients.',
    type: 'shader',
    fragmentShader: `
    
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = 1.0 * fragCoord/iResolution.xy;
    
    for (int n = 1; n < 20; n++) {
        float i = float(n);
        uv += vec2(1.0 / i * sin(i * uv.y + iTime * flowSpeed * i ) + 0.8, 1.0 / i * sin(uv.x + iTime * flowSpeed * i) + 1.6);
    }
    
    float gradientValue = cos((uv.x + uv.y) * waveIntensity) * 0.5 + 0.5;
    
    vec3 deepNavy = vec3(0.05, 0.08, 0.15);
    vec3 darkBlue = vec3(0.1, 0.2, 0.35);
    vec3 mediumBlue = vec3(0.1, 0.3, 0.65);
    vec3 richBlue = vec3(0.24, 0.35, 0.67);
    vec3 tealBlue = vec3(0.47, 0.36, 0.66);
    vec3 deepOrange = vec3(0.8, 0.3, 0.2);
    vec3 brightOrange = vec3(0.98, 0.36, 0.29);
    vec3 warmYellow = vec3(1.0, 0.56, 0.28);
    
    vec3 color;
    if (gradientValue < 0.15) {
      color = mix(deepNavy, darkBlue, gradientValue * 6.667);
    } else if (gradientValue < 0.35) {
      color = mix(darkBlue, mediumBlue, (gradientValue - 0.15) * 5.0);
    } else if (gradientValue < 0.55) {
      color = mix(mediumBlue, richBlue, (gradientValue - 0.35) * 5.0);
    } else if (gradientValue < 0.7) {
      color = mix(richBlue, tealBlue, (gradientValue - 0.55) * 6.667);
    } else if (gradientValue < 0.82) {
      color = mix(tealBlue, deepOrange, (gradientValue - 0.7) * 8.333);
    } else if (gradientValue < 0.92) {
      color = mix(deepOrange, brightOrange, (gradientValue - 0.82) * 10.0);
    } else {
      color = mix(brightOrange, warmYellow, (gradientValue - 0.92) * 12.5);
    }
    
    fragColor = vec4(color, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
    `,
    parameters: [
      {
        id: 'flowSpeed',
        name: 'Flow Speed',
        type: 'number',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.1,
        category: 'Simulation'
      },
      {
        id: 'waveIntensity',
        name: 'Wave Intensity',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        defaultValue: 1.0,
        category: 'Simulation'
      }
    ]
  },
  {
    id: 'data-tunnel',
    name: 'Data Tunnel',
    description: 'A signal tunnel of flowing lines with bloom and color-layered trails.',
    type: 'component',
    component: DataTunnelAdapter,
    parameters: [
      { id: 'colorBg', name: 'Background', type: 'color', defaultValue: '#080808', category: 'Palette' },
      { id: 'colorLine', name: 'Lines', type: 'color', defaultValue: '#373f48', category: 'Palette' },
      { id: 'colorSignal', name: 'Signal 1', type: 'color', defaultValue: '#8fc9ff', category: 'Signal Colors' },
      { id: 'useColor2', name: 'Use Signal 2', type: 'boolean', defaultValue: false, category: 'Signal Colors' },
      { id: 'colorSignal2', name: 'Signal 2', type: 'color', defaultValue: '#ff0055', category: 'Signal Colors' },
      { id: 'useColor3', name: 'Use Signal 3', type: 'boolean', defaultValue: false, category: 'Signal Colors' },
      { id: 'colorSignal3', name: 'Signal 3', type: 'color', defaultValue: '#ffcc00', category: 'Signal Colors' },

      { id: 'lineCount', name: 'Line Count', type: 'number', min: 10, max: 300, step: 1, defaultValue: 80, category: 'General' },
      { id: 'globalRotation', name: 'Rotation (Deg)', type: 'number', min: -180, max: 180, step: 1, defaultValue: 0, category: 'General' },
      { id: 'positionX', name: 'Position X', type: 'number', min: -200, max: 200, step: 1, defaultValue: -25, category: 'General' },
      { id: 'positionY', name: 'Position Y', type: 'number', min: -100, max: 100, step: 1, defaultValue: 0, category: 'General' },

      { id: 'spreadHeight', name: 'Spread Height', type: 'number', min: 10, max: 100, step: 0.01, defaultValue: 30.33, category: 'Geometry' },
      { id: 'spreadDepth', name: 'Spread Depth', type: 'number', min: 0, max: 50, step: 0.01, defaultValue: 0, category: 'Geometry' },
      { id: 'curveLength', name: 'Curve Length', type: 'number', min: 20, max: 150, step: 1, defaultValue: 50, category: 'Geometry' },
      { id: 'straightLength', name: 'Straight Length', type: 'number', min: 20, max: 200, step: 1, defaultValue: 100, category: 'Geometry' },
      { id: 'curvePower', name: 'Curve Power', type: 'number', min: 0.1, max: 3.0, step: 0.01, defaultValue: 0.8265, category: 'Geometry' },

      { id: 'waveSpeed', name: 'Wave Speed', type: 'number', min: 0, max: 5, step: 0.01, defaultValue: 2.48, category: 'Lines' },
      { id: 'waveHeight', name: 'Wave Height', type: 'number', min: 0, max: 5, step: 0.01, defaultValue: 0.145, category: 'Lines' },
      { id: 'lineOpacity', name: 'Line Opacity', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.557, category: 'Lines' },

      { id: 'signalCount', name: 'Signal Count', type: 'number', min: 0, max: 200, step: 1, defaultValue: 94, category: 'Signals' },
      { id: 'speedGlobal', name: 'Speed', type: 'number', min: 0, max: 3, step: 0.01, defaultValue: 0.345, category: 'Signals' },
      { id: 'trailLength', name: 'Trail Length', type: 'number', min: 0, max: 100, step: 1, defaultValue: 3, category: 'Signals' },

      { id: 'bloomStrength', name: 'Bloom Strength', type: 'number', min: 0, max: 5, step: 0.01, defaultValue: 3.0, category: 'Bloom' },
      { id: 'bloomRadius', name: 'Bloom Radius', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.5, category: 'Bloom' },
    ]
  },
  {
    id: 'phyllotaxis-spiral',
    name: 'Phyllotaxis Spiral',
    description: 'A mathematical spiral pattern based on the golden angle, featuring animated dots.',
    type: 'component',
    component: SpiralToolAdapter,
    parameters: [
      { id: 'totalDots', name: 'Total Dots', type: 'number', min: 100, max: 2000, step: 10, defaultValue: 900, category: 'Geometry' },
      { id: 'dotRadius', name: 'Dot Radius', type: 'number', min: 0.5, max: 10, step: 0.1, defaultValue: 2, category: 'Geometry' },
      { id: 'margin', name: 'Margin', type: 'number', min: 0, max: 100, step: 1, defaultValue: 2, category: 'Geometry' },
      { id: 'duration', name: 'Animation Duration', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1, category: 'Simulation' },
      { id: 'minOpacity', name: 'Min Opacity', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: 0.3, category: 'Appearance' },
      { id: 'maxOpacity', name: 'Max Opacity', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: 1, category: 'Appearance' },
      { id: 'minScale', name: 'Min Scale', type: 'number', min: 0.1, max: 2, step: 0.1, defaultValue: 0.5, category: 'Appearance' },
      { id: 'maxScale', name: 'Max Scale', type: 'number', min: 0.1, max: 5, step: 0.1, defaultValue: 1.5, category: 'Appearance' },
      { id: 'useMultipleColors', name: 'Multi-Color Mode', type: 'boolean', defaultValue: false, category: 'Palette' },
      { id: 'dotColor', name: 'Base Dot Color', type: 'color', defaultValue: '#FFFFFF', category: 'Palette' },
      { id: 'backgroundColor', name: 'Background Color', type: 'color', defaultValue: '#000000', category: 'Palette' },
      { id: 'color1', name: 'Phase 1 Color', type: 'color', defaultValue: '#FF0000', category: 'Palette' },
      { id: 'color2', name: 'Phase 2 Color', type: 'color', defaultValue: '#00FF00', category: 'Palette' },
      { id: 'color3', name: 'Phase 3 Color', type: 'color', defaultValue: '#0000FF', category: 'Palette' },
    ]
  },
  {
    id: 'pixel-grid',
    name: 'Pixel Grid',
    description: 'A tactical pixel art generator that converts images/videos into a dynamic grid display.',
    type: 'component',
    component: dynamic(() => import('./adapters/PixelGridAdapter'), { ssr: false }),
    parameters: [
      { id: 'mediaUrl', name: 'Source Media', type: 'image', defaultValue: '', category: 'Input' },
      { id: 'masterSpeed', name: 'Master Speed', type: 'number', min: 0.1, max: 3.0, step: 0.1, defaultValue: 1.0, category: 'Simulation' },
      { id: 'gridDensity', name: 'Grid Density', type: 'number', min: 20, max: 200, step: 1, defaultValue: 80, category: 'Geometry' },
      { id: 'clusterThreshold', name: 'Cluster Threshold', type: 'number', min: 0.0, max: 1.0, step: 0.01, defaultValue: 0.5, category: 'Analysis' },
      { id: 'sizeScale', name: 'Size Scale', type: 'number', min: 0.5, max: 2.0, step: 0.05, defaultValue: 1.0, category: 'Geometry' },
      { id: 'minPixelFilter', name: 'Min Pixel Filter', type: 'number', min: 0.0, max: 0.8, step: 0.01, defaultValue: 0.1, category: 'Analysis' },
      { id: 'rotationChaos', name: 'Rotation Chaos', type: 'number', min: 0.0, max: 1.0, step: 0.01, defaultValue: 0.0, category: 'Simulation' },
      // Red Noise Intensity removed as per user request to hide effect
      // Use logic to map 0,1,2 to Square, Circle, Triangle if needed, or simplified as numbers
      // But typically sliders are better for continuous, and select for discrete. 
      // For now, let's map shape to a number slider 0-2 for simplicity or add a 'select' type if I had time, 
      // but since I'm restricted, I'll use number with step 1.
      { id: 'pixelShape', name: 'Pixel Shape (Sq/Cir/Tri)', type: 'number', min: 0, max: 2, step: 1, defaultValue: 0, category: 'Geometry' },
      { id: 'imageScaleMode', name: 'Scale Mode (0:Fit, 1:Fill)', type: 'number', min: 0, max: 1, step: 1, defaultValue: 0, category: 'Geometry' },
    ]
  },
  {
    id: 'particle-stairs',
    name: 'Particle Stairs',
    description: 'A Perlin-noise driven rainfall that forms staircase-like motion trails.',
    type: 'component',
    component: ParticleStairsAdapter,
    parameters: [
      { id: 'particleCount', name: 'Particle Count', type: 'number', min: 0, max: 200000, step: 50, defaultValue: 4050, category: 'Simulation' },
      { id: 'spawnRate', name: 'Spawn Rate', type: 'number', min: 0, max: 100, step: 1, defaultValue: 9, category: 'Simulation' },
      { id: 'gravityAccel', name: 'Gravity Speed', type: 'number', min: 0, max: 10, step: 0.1, defaultValue: 0.5, category: 'Simulation' },
      { id: 'stairCount', name: 'Stair Count', type: 'number', min: 10, max: 400, step: 1, defaultValue: 120, category: 'Geometry' },
      { id: 'particleColor', name: 'Particle Color', type: 'color', defaultValue: '#76BA99', category: 'Palette' },
      { id: 'usePalette', name: 'Use Palette', type: 'boolean', defaultValue: true, category: 'Palette' },
      { id: 'color1', name: 'Palette 1', type: 'color', defaultValue: '#76BA99', category: 'Palette' },
      { id: 'color2', name: 'Palette 2', type: 'color', defaultValue: '#ADCF9F', category: 'Palette' },
      { id: 'color3', name: 'Palette 3', type: 'color', defaultValue: '#CED89E', category: 'Palette' },
      { id: 'backgroundColor', name: 'Background Color', type: 'color', defaultValue: '#000000', category: 'Palette' },
      { id: 'trailAlpha', name: 'Trail Fade', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.078, category: 'Appearance' },
      { id: 'blur', name: 'Blur', type: 'number', min: 0, max: 20, step: 0.1, defaultValue: 1.25, category: 'Appearance' },
      { id: 'seed', name: 'Seed', type: 'number', min: 1, max: 1000000, step: 1, defaultValue: 1337, category: 'Simulation' },
      { id: 'noiseThreshold', name: 'Noise Threshold', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.4, category: 'Simulation' },
    ]
  }
];
