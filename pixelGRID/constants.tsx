
export const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uDensity;
  uniform float uCluster;
  uniform float uSizeScale;
  uniform float uMinFilter;
  uniform float uChaos;
  uniform float uNoiseIntensity;
  uniform int uShape; // 0: Square, 1: Circle, 2: Triangle
  uniform vec2 uResolution;
  uniform vec2 uMediaResolution;
  uniform int uScaleMode; // 0: Fit, 1: Fill
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  float sdEquilateralTriangle(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
  }

  void main() {
    // Media aspect ratio correction with safety check
    vec2 mediaUv = vUv;
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    float mediaAspect = uMediaResolution.x / max(uMediaResolution.y, 1.0);
    if (mediaAspect <= 0.0) mediaAspect = 1.0;

    if (uScaleMode == 0) { // FIT
      if (screenAspect > mediaAspect) {
        float s = mediaAspect / screenAspect;
        mediaUv.x = (vUv.x - 0.5) / s + 0.5;
        if (mediaUv.x < 0.0 || mediaUv.x > 1.0) { discard; }
      } else {
        float s = screenAspect / mediaAspect;
        mediaUv.y = (vUv.y - 0.5) / s + 0.5;
        if (mediaUv.y < 0.0 || mediaUv.y > 1.0) { discard; }
      }
    } else { // FILL
       if (screenAspect > mediaAspect) {
        float s = screenAspect / mediaAspect;
        mediaUv.y = (vUv.y - 0.5) / s + 0.5;
      } else {
        float s = mediaAspect / screenAspect;
        mediaUv.x = (vUv.x - 0.5) / s + 0.5;
      }
    }

    // Grid Logic
    vec2 gridCount = vec2(uDensity, uDensity / mediaAspect);
    vec2 gridUv = floor(mediaUv * gridCount) / gridCount;
    // Clamp sampling to avoid edge artifacts
    gridUv = clamp(gridUv, 0.001, 0.999);
    
    vec2 localUv = fract(mediaUv * gridCount) * 2.0 - 1.0;

    // Sample source
    vec4 texel = texture2D(tDiffuse, gridUv);
    float brightness = dot(texel.rgb, vec3(0.299, 0.587, 0.114));

    // Base background color (very dark tactical grey)
    vec3 bgColor = vec3(0.015, 0.015, 0.018);
    
    // Threshold & Filter - instead of discard, use fallback color
    bool isFiltered = brightness < uMinFilter;
    
    // Rotation Chaos
    float angle = random(gridUv) * uChaos * 6.28 + uTime * 0.1 * uChaos;
    localUv = rotate2d(angle) * localUv;

    // Pixel Shaping
    float shapeMask = 0.0;
    // Size is relative to brightness and size scale
    float size = clamp(brightness * uSizeScale, 0.0, 2.0);
    
    if (uShape == 0) { // Square
      shapeMask = (abs(localUv.x) < size && abs(localUv.y) < size) ? 1.0 : 0.0;
    } else if (uShape == 1) { // Circle
      shapeMask = length(localUv) < size ? 1.0 : 0.0;
    } else if (uShape == 2) { // Triangle
      shapeMask = sdEquilateralTriangle(localUv, size) < 0.0 ? 1.0 : 0.0;
    }

    // Final color calculation
    vec3 finalColor = bgColor;
    
    if (!isFiltered && shapeMask > 0.0) {
      // Tactical Greyscale output
      finalColor = vec3(brightness);
      
      // Red Noise (Random cluster analysis simulation)
      float noise = random(gridUv + uTime * 0.01);
      if (noise < uNoiseIntensity * brightness) {
        finalColor = vec3(0.9, 0.1, 0.1);
      }

      // Contrast Enhancement / Cluster Logic
      finalColor *= (brightness > uCluster) ? 1.4 : 0.7;
      // Add a slight blueprint tint
      finalColor += vec3(0.0, 0.02, 0.04) * brightness;
    } else {
      // Background pattern: tiny dots to show grid is alive
      float dotPattern = (length(localUv) < 0.05) ? 0.05 : 0.0;
      finalColor += vec3(dotPattern);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
