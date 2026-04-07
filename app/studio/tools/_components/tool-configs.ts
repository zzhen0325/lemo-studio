import dynamic from 'next/dynamic';

const SpiralToolAdapter = dynamic(() => import('./adapters/SpiralToolAdapter'), { ssr: false });
const ParticleStairsAdapter = dynamic(() => import('./adapters/ParticleStairsAdapter'), { ssr: false });
const DataTunnelAdapter = dynamic(() => import('./adapters/DataTunnelAdapter'), { ssr: false });
const OrganicBackgroundAdapter = dynamic(() => import('./adapters/OrganicBackgroundAdapter'), { ssr: false });

export interface ToolComponentProps {
  onChange?: (id: string, value: number | string | boolean) => void;
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type ToolParamType = 'number' | 'color' | 'boolean' | 'image';

export interface ToolParameter {
  id: string;
  name: string;
  type: ToolParamType;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: string | number | boolean;
  category?: string;
  // For image/select types
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
  thumbnail?: string;
  fragmentShader?: string;
  component?: React.ComponentType<ToolComponentProps>;
  parameters: ToolParameter[];
}

export const WEBGL_TOOLS: WebGLToolConfig[] = [
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
