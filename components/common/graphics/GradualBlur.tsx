import React, { CSSProperties, useEffect, useRef, useState, useMemo, PropsWithChildren } from 'react';
import * as math from 'mathjs';

import './GradualBlur.css';

type GradualBlurProps = {
  position?: 'top' | 'bottom' | 'left' | 'right' | 'around';
  strength?: number;
  height?: string;
  width?: string;
  divCount?: number;
  exponential?: boolean;
  zIndex?: number;
  animated?: boolean | 'scroll';
  duration?: string;
  easing?: string;
  opacity?: number;
  curve?: 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';
  responsive?: boolean;
  mobileHeight?: string;
  tabletHeight?: string;
  desktopHeight?: string;
  mobileWidth?: string;
  tabletWidth?: string;
  desktopWidth?: string;
  preset?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'around'
    | 'subtle'
    | 'intense'
    | 'smooth'
    | 'sharp'
    | 'header'
    | 'footer'
    | 'sidebar'
    | 'page-header'
    | 'page-footer';
  gpuOptimized?: boolean;
  hoverIntensity?: number;
  target?: 'parent' | 'page';
  onAnimationComplete?: () => void;
  className?: string;
  style?: CSSProperties;
  visibleColor?: string;
  borderRadius?: string | number;
  animate?: {
    type: 'scroll';
    targetRef: React.RefObject<HTMLElement | null>;
    startOffset?: number;
    endOffset?: number;
  };
};

const DEFAULT_CONFIG: Partial<GradualBlurProps> = {
  position: 'bottom',
  strength: 2,
  height: '6rem',
  divCount: 5,
  exponential: true,
  zIndex: 1000,
  animated: true,
  duration: '0.3s',
  easing: 'ease-out',
  opacity: 1,
  curve: 'linear',
  responsive: false,
  target: 'parent',
  className: '',
  style: {}
};

const PRESETS: Record<string, Partial<GradualBlurProps>> = {
  top: { position: 'top', height: '6rem' },
  bottom: { position: 'bottom', height: '6rem' },
  left: { position: 'left', height: '6rem' },
  right: { position: 'right', height: '6rem' },
  // 从四周到中心的径向模糊
  around: { position: 'around', height: '100%', width: '100%' },
  subtle: { height: '4rem', strength: 1, opacity: 0.8, divCount: 3 },
  intense: { height: '10rem', strength: 4, divCount: 8, exponential: true },
  smooth: { height: '8rem', curve: 'bezier', divCount: 10 },
  sharp: { height: '5rem', curve: 'linear', divCount: 4 },
  header: { position: 'top', height: '8rem', curve: 'ease-out' },
  footer: { position: 'bottom', height: '8rem', curve: 'ease-out' },
  sidebar: { position: 'left', height: '6rem', strength: 2.5 },
  'page-header': {
    position: 'top',
    height: '10rem',
    target: 'page',
    strength: 3
  },
  'page-footer': {
    position: 'bottom',
    height: '10rem',
    target: 'page',
    strength: 3
  }
};

const CURVE_FUNCTIONS: Record<string, (p: number) => number> = {
  linear: p => p,
  bezier: p => p * p * (3 - 2 * p),
  'ease-in': p => p * p,
  'ease-out': p => 1 - Math.pow(1 - p, 2),
  'ease-in-out': p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
};

const mergeConfigs = (...configs: Partial<GradualBlurProps>[]): Partial<GradualBlurProps> => {
  return configs.reduce((acc, config) => ({ ...acc, ...config }), {});
};

const getGradientDirection = (position: string): string => {
  const directions: Record<string, string> = {
    top: 'to top',
    bottom: 'to bottom',
    left: 'to left',
    right: 'to right'
  };
  // 非径向：返回线性方向；径向由调用方特殊处理
  return directions[position] || 'to bottom';
};

const debounce = <T extends (...a: unknown[]) => void>(fn: T, wait: number) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
};

type DimensionValue = string | number | undefined;

const useResponsiveDimension = (
  responsive: boolean | undefined,
  config: Partial<GradualBlurProps>,
  key: 'height' | 'width'
) => {
  const [val, setVal] = useState<DimensionValue>(config[key] as DimensionValue);
  useEffect(() => {
    if (!responsive) return;
    const calc = () => {
      const w = window.innerWidth;
      let v: DimensionValue = config[key] as DimensionValue;
      if (w <= 480) {
        v = key === 'height' ? (config.mobileHeight as DimensionValue) : (config.mobileWidth as DimensionValue);
      } else if (w <= 768) {
        v = key === 'height' ? (config.tabletHeight as DimensionValue) : (config.tabletWidth as DimensionValue);
      } else if (w <= 1024) {
        v = key === 'height' ? (config.desktopHeight as DimensionValue) : (config.desktopWidth as DimensionValue);
      }
      setVal(v);
    };
    const deb = debounce(calc, 100);
    calc();
    window.addEventListener('resize', deb);
    return () => window.removeEventListener('resize', deb);
  }, [responsive, config, key]);
  return responsive ? val : (config[key] as DimensionValue);
};

const useIntersectionObserver = (ref: React.RefObject<HTMLDivElement | null>, shouldObserve: boolean = false) => {
  const [isVisible, setIsVisible] = useState(!shouldObserve);

  useEffect(() => {
    if (!shouldObserve || !ref.current) return;

    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, shouldObserve]);

  return isVisible;
};

const GradualBlur: React.FC<PropsWithChildren<GradualBlurProps>> = props => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(props.animate?.type === 'scroll' ? 0 : 1);

  useEffect(() => {
    const target = props.animate?.targetRef?.current;
    if (props.animate?.type === 'scroll' && target) {
      const start = props.animate.startOffset ?? 0;
      const end = props.animate.endOffset ?? 50;

      const handleScroll = () => {
        const current = target.scrollTop;
        const progress = Math.min(Math.max((current - start) / (end - start), 0), 1);
        setScrollProgress(progress);
      };

      target.addEventListener('scroll', handleScroll);
      handleScroll(); // 初始执行一次
      return () => target.removeEventListener('scroll', handleScroll);
    }
  }, [props.animate?.type, props.animate?.targetRef?.current, props.animate?.startOffset, props.animate?.endOffset]);

  const config = useMemo(() => {
    const presetConfig = props.preset && PRESETS[props.preset] ? PRESETS[props.preset] : {};
    return mergeConfigs(DEFAULT_CONFIG, presetConfig, props) as Required<GradualBlurProps>;
  }, [props]);

  const responsiveHeight = useResponsiveDimension(config.responsive, config, 'height');
  const responsiveWidth = useResponsiveDimension(config.responsive, config, 'width');

  const isVisible = useIntersectionObserver(containerRef, config.animated === 'scroll');

  const blurDivs = useMemo(() => {
    const divs: React.ReactNode[] = [];
    const increment = 100 / config.divCount;
    const currentStrength =
      isHovered && config.hoverIntensity ? config.strength * config.hoverIntensity : config.strength;

    const curveFunc = CURVE_FUNCTIONS[config.curve] || CURVE_FUNCTIONS.linear;

    const isAround = config.position === 'around';

    for (let i = 1; i <= config.divCount; i++) {
      let progress = i / config.divCount;
      progress = curveFunc(progress);
      // 径向：从四周到中心，反向进度使外侧更强，内侧更弱
      const progressForBlur = isAround ? 1 - progress : progress;

      let blurValue: number;
      const baseStrength = currentStrength * scrollProgress;
      if (config.exponential) {
        blurValue = Number(math.pow(2, progressForBlur * 4)) * 0.0625 * baseStrength;
      } else {
        blurValue = 0.0625 * (progressForBlur * config.divCount + 1) * baseStrength;
      }

      const p1 = math.round((increment * i - increment) * 10) / 10;
      const p2 = math.round(increment * i * 10) / 10;
      const p3 = math.round((increment * i + increment) * 10) / 10;
      const p4 = math.round((increment * i + increment * 2) * 10) / 10;

      let gradient: string;
      if (isAround) {
        const q1 = Math.max(0, 100 - p4);
        const q2 = Math.max(0, 100 - p3);
        const q3 = Math.max(0, 100 - p2);
        const q4 = Math.max(0, 100 - p1);
        gradient = `transparent ${q1}%, white ${q2}%`;
        if (q3 <= 100) gradient += `, white ${q3}%`;
        if (q4 <= 100) gradient += `, transparent ${q4}%`;
      } else {
        gradient = `transparent ${p1}%, white ${p2}%`;
        if (p3 <= 100) gradient += `, white ${p3}%`;
        if (p4 <= 100) gradient += `, transparent ${p4}%`;
      }

      const direction = getGradientDirection(config.position);

      const divStyle: CSSProperties = {
        position: 'absolute',
        inset: '0',
        maskImage:
          isAround
            ? `radial-gradient(circle at center, ${gradient})`
            : `linear-gradient(${direction}, ${gradient})`,
        WebkitMaskImage:
          isAround
            ? `radial-gradient(circle at center, ${gradient})`
            : `linear-gradient(${direction}, ${gradient})`,
        backdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
        WebkitBackdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
        opacity: config.opacity * scrollProgress,
        borderRadius: props.borderRadius,
        transition:
          config.animated && config.animated !== 'scroll'
            ? `backdrop-filter ${config.duration} ${config.easing}`
            : undefined
      };

      divs.push(<div key={i} style={divStyle} />);
    }

    return divs;
  }, [config, isHovered, scrollProgress, props.borderRadius]);

  const containerStyle: CSSProperties = useMemo(() => {
    const isVertical = ['top', 'bottom'].includes(config.position);
    const isHorizontal = ['left', 'right'].includes(config.position);
    const isAround = config.position === 'around';
    const isPageTarget = config.target === 'page';

    const baseStyle: CSSProperties = {
      position: isPageTarget ? 'fixed' : 'absolute',
      pointerEvents: config.hoverIntensity ? 'auto' : 'none',
      opacity: isVisible ? 1 : 0,
      transition: config.animated ? `opacity ${config.duration} ${config.easing}` : undefined,
      zIndex: isPageTarget ? config.zIndex + 100 : config.zIndex,
      borderRadius: props.borderRadius,
      overflow: 'hidden',
      ...config.style
    };

    if (isVertical) {
      baseStyle.height = responsiveHeight;
      baseStyle.width = responsiveWidth || '100%';
      if (config.position === 'top') baseStyle.top = 0;
      else if (config.position === 'bottom') baseStyle.bottom = 0;
      baseStyle.left = 0;
      baseStyle.right = 0;
    } else if (isHorizontal) {
      baseStyle.width = responsiveWidth || responsiveHeight;
      baseStyle.height = '100%';
      if (config.position === 'left') baseStyle.left = 0;
      else if (config.position === 'right') baseStyle.right = 0;
      baseStyle.top = 0;
      baseStyle.bottom = 0;
    } else if (isAround) {
      // 覆盖整个容器，径向从四周到中心
      baseStyle.top = 0;
      baseStyle.left = 0;
      baseStyle.right = 0;
      baseStyle.bottom = 0;
      baseStyle.width = responsiveWidth || '100%';
      baseStyle.height = responsiveHeight || '100%';
    }

    return baseStyle;
  }, [config, responsiveHeight, responsiveWidth, isVisible]);

  const hoverIntensity = config.hoverIntensity;
  const animated = config.animated;
  const onAnimationComplete = config.onAnimationComplete;
  const duration = config.duration;
  useEffect(() => {
    if (isVisible && animated === 'scroll' && onAnimationComplete) {
      const t = setTimeout(() => onAnimationComplete(), parseFloat(duration ?? '0') * 1000);
      return () => clearTimeout(t);
    }
  }, [isVisible, animated, onAnimationComplete, duration]);

  return (
    <div
      ref={containerRef}
      className={`gradual-blur ${config.target === 'page' ? 'gradual-blur-page' : 'gradual-blur-parent'} ${config.className}`}
      style={containerStyle}
      onMouseEnter={hoverIntensity ? () => setIsHovered(true) : undefined}
      onMouseLeave={hoverIntensity ? () => setIsHovered(false) : undefined}
    >
      <div
        className="gradual-blur-inner"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%'
        }}
      >
        {blurDivs}
      </div>
    </div>
  );
};

type GradualBlurComponent = React.MemoExoticComponent<React.FC<PropsWithChildren<GradualBlurProps>>> & {
  PRESETS: typeof PRESETS;
  CURVE_FUNCTIONS: typeof CURVE_FUNCTIONS;
};

const GradualBlurMemo = React.memo(GradualBlur) as GradualBlurComponent;
GradualBlurMemo.displayName = 'GradualBlur';
GradualBlurMemo.PRESETS = PRESETS;
GradualBlurMemo.CURVE_FUNCTIONS = CURVE_FUNCTIONS;
export default GradualBlurMemo;

const injectStyles = () => {
  if (typeof document === 'undefined') return;
  const styleId = 'gradual-blur-styles';
  if (document.getElementById(styleId)) return;
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = `.gradual-blur{pointer-events:none;transition:opacity 0.3s ease-out}.gradual-blur-inner{pointer-events:none}`;
  document.head.appendChild(styleElement);
};

if (typeof document !== 'undefined') {
  injectStyles();
}
