"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolComponentProps } from '../tool-configs';

type Props = ToolComponentProps & {
  useSystemTime?: boolean;
  liveUpdate?: boolean;
  use12Hour?: boolean;
  textTop?: string;
  textBottom?: string;
  hourOverride?: number;
  minuteOverride?: number;

  fontScale?: number;
  lineHeight?: number;
  letterSpacingEm?: number;
  italic?: boolean;
  fontWeight?: number;

  lineCount?: number;
  lineThickness?: number;
  densityEm?: number;
  contrastPct?: number;
  opacity?: number;
  rotateDeg?: number;
  hourTranslateXEm?: number;
  minTranslateXEm?: number;

  originXPct?: number;
  originYPct?: number;
  innerLight?: string;
  innerMid?: string;

  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
  color6?: string;
  color7?: string;
  color8?: string;
  color9?: string;
  color10?: string;
};

const overlayGradient = `
repeating-radial-gradient(
  circle at var(--origin),
  var(--c1) calc(var(--density) * 0),
  var(--c1) calc(var(--density) * 1),
  var(--c2) calc(var(--density) * 1),
  var(--c2) calc(var(--density) * 2),
  var(--c3) calc(var(--density) * 2),
  var(--c3) calc(var(--density) * 3),
  var(--c4) calc(var(--density) * 3),
  var(--c4) calc(var(--density) * 4),
  var(--c5) calc(var(--density) * 4),
  var(--c5) calc(var(--density) * 5),
  var(--c6) calc(var(--density) * 5),
  var(--c6) calc(var(--density) * 6),
  var(--c7) calc(var(--density) * 6),
  var(--c7) calc(var(--density) * 7),
  var(--c8) calc(var(--density) * 7),
  var(--c8) calc(var(--density) * 8),
  var(--c9) calc(var(--density) * 8),
  var(--c9) calc(var(--density) * 9),
  var(--c10) calc(var(--density) * 9),
  var(--c10) calc(var(--density) * 10)
)`.trim();

const innerGradient = `
repeating-radial-gradient(
  circle at var(--origin),
  var(--innerLight),
  var(--innerMid) calc(var(--density) / 2),
  var(--innerLight) var(--density)
)`.trim();

function pad2(v: number) {
  return String(v).padStart(2, '0');
}

function clampNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const PrideClockAdapter: React.FC<Props> = ({
  onChange,
  isPreview,
  useSystemTime = true,
  liveUpdate = true,
  use12Hour = false,
  textTop = 'Lemon8',
  textBottom = '',
  hourOverride = 9,
  minuteOverride = 41,

  fontScale = 0.45,
  lineHeight = 0.8,
  letterSpacingEm = -0.05,
  italic = true,
  fontWeight = 1000,

  lineCount,
  lineThickness = 1,
  densityEm = 0.05,
  contrastPct = 2000,
  opacity = 0.46,
  rotateDeg = 6,
  hourTranslateXEm = 0.2,
  minTranslateXEm = -0.2,

  originXPct = -150,
  originYPct = -25,
  innerLight = '#ffffff',
  innerMid = '#777777',

  color1 = '#f7b232',
  color2 = '#e12626',
  color3 = '#733d2c',
  color4 = '#2b1d1d',
  color5 = '#511c69',
  color6 = '#1c73c4',
  color7 = '#a0cdfb',
  color8 = '#69d6ad',
  color9 = '#ffcd04',
  color10 = '#fbaaaa',
}) => {
  const [tick, setTick] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hourRef = useRef<HTMLDivElement | null>(null);
  const minRef = useRef<HTMLDivElement | null>(null);
  const [minDimPx, setMinDimPx] = useState<number | null>(null);

  useEffect(() => {
    if (!useSystemTime) return;
    if (!liveUpdate) {
      setTick((v) => v + 1);
      return;
    }
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [useSystemTime, liveUpdate]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setMinDimPx(Math.max(1, Math.min(rect.width, rect.height)));
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { hourText, minuteText, isCustomTextMode } = useMemo(() => {
    const top = typeof textTop === 'string' ? textTop : '';
    const bottom = typeof textBottom === 'string' ? textBottom : '';
    const customMode = !useSystemTime && (top.length > 0 || bottom.length > 0);
    if (customMode) {
      return { hourText: top, minuteText: bottom, isCustomTextMode: true };
    }

    let h = clampNumber(hourOverride, 0);
    let m = clampNumber(minuteOverride, 0);

    if (useSystemTime) {
      const t = new Date();
      h = t.getHours();
      m = t.getMinutes();
    }

    if (use12Hour) {
      const hh = h % 12;
      h = hh === 0 ? 12 : hh;
    }

    return {
      hourText: String(h),
      minuteText: pad2(Math.max(0, Math.min(59, Math.floor(m)))),
      isCustomTextMode: false,
    };
  }, [hourOverride, minuteOverride, textBottom, textTop, use12Hour, useSystemTime, tick]);

  const safeBlurFactor = useMemo(() => {
    const t = typeof lineThickness === 'number' && Number.isFinite(lineThickness) ? lineThickness : 1;
    return Math.max(0, Math.min(4, t));
  }, [lineThickness]);

  const densityPx = useMemo(() => {
    if (typeof minDimPx !== 'number') return 16;
    if (typeof lineCount === 'number' && Number.isFinite(lineCount) && lineCount > 0) {
      return Math.max(0.5, minDimPx / lineCount);
    }
    const fontSizePx = minDimPx * fontScale;
    return Math.max(0.5, densityEm * fontSizePx);
  }, [densityEm, fontScale, lineCount, minDimPx]);

  useEffect(() => {
    const hEl = hourRef.current;
    const mEl = minRef.current;
    if (!hEl || !mEl) return;

    if (document.activeElement !== hEl) hEl.textContent = hourText;
    if (document.activeElement !== mEl) mEl.textContent = minuteText;
  }, [hourText, minuteText]);

  const styleVars = {
    ['--density' as string]: `${densityPx}px`,
    ['--thickness' as string]: safeBlurFactor,
    ['--origin' as string]: `${originXPct}% ${originYPct}%`,
    ['--fontScale' as string]: fontScale,
    ['--lh' as string]: lineHeight,
    ['--ls' as string]: `${letterSpacingEm}em`,
    ['--opacity' as string]: opacity,
    ['--rot' as string]: `${rotateDeg}deg`,
    ['--hourX' as string]: `${hourTranslateXEm}em`,
    ['--minX' as string]: `${minTranslateXEm}em`,
    ['--contrast' as string]: `${contrastPct}%`,
    ['--innerLight' as string]: innerLight,
    ['--innerMid' as string]: innerMid,
    ['--c1' as string]: color1,
    ['--c2' as string]: color2,
    ['--c3' as string]: color3,
    ['--c4' as string]: color4,
    ['--c5' as string]: color5,
    ['--c6' as string]: color6,
    ['--c7' as string]: color7,
    ['--c8' as string]: color8,
    ['--c9' as string]: color9,
    ['--c10' as string]: color10,
    ['--fw' as string]: fontWeight,
  } as React.CSSProperties;

  return (
    <div ref={rootRef} className="root" style={styleVars}>
      <div className="clock">
        <div className="clockInner" style={{ backgroundImage: innerGradient }}>
          <div
            className={`numbers${minuteText ? '' : ' oneLine'}`}
            style={{ transform: `rotate(${rotateDeg}deg)` }}
          >
            <div
              className="hour"
              contentEditable={!isPreview}
              ref={hourRef}
              suppressContentEditableWarning
              onInput={(e) => {
                const raw = (e.currentTarget.textContent || '').trim();
                if (!onChange) return;
                if (isCustomTextMode) {
                  onChange('textTop', raw);
                  onChange('useSystemTime', false);
                  return;
                }
                const parsed = Number.parseInt(raw, 10);
                if (!Number.isNaN(parsed)) {
                  onChange('hourOverride', parsed);
                  onChange('useSystemTime', false);
                }
              }}
            />
            <div
              className="min"
              contentEditable={!isPreview}
              ref={minRef}
              suppressContentEditableWarning
              onInput={(e) => {
                const raw = (e.currentTarget.textContent || '').trim();
                if (!onChange) return;
                if (isCustomTextMode) {
                  onChange('textBottom', raw);
                  onChange('useSystemTime', false);
                  return;
                }
                const parsed = Number.parseInt(raw, 10);
                if (!Number.isNaN(parsed)) {
                  onChange('minuteOverride', Math.max(0, Math.min(59, parsed)));
                  onChange('useSystemTime', false);
                }
              }}
            />
          </div>
        </div>
        <div className="clockOverlay" style={{ backgroundImage: overlayGradient }} />
      </div>
      <style jsx>{`
        .root {
          width: 100%;
          height: 100%;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica,
            Ubuntu, roboto, noto, arial, sans-serif;
          container-type: size;
        }

        .clock {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-variant-numeric: tabular-nums;
        }

        .clockInner {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          filter: contrast(var(--contrast));
        }

        .numbers {
          font-size: calc(min(100cqw, 100cqh) * var(--fontScale));
          line-height: var(--lh);
          font-style: ${italic ? 'italic' : 'normal'};
          font-weight: var(--fw);
          letter-spacing: var(--ls);
          filter: blur(calc(var(--density) / 4 * (0.25 + var(--thickness))));
          opacity: var(--opacity);
          transform: rotate(var(--rot));
          color: #000;
          caret-color: rgba(0, 0, 0, 0.8);
          user-select: text;
        }

        .hour {
          transform: translateX(var(--hourX));
        }

        .min {
          transform: translateX(var(--minX));
        }

        .oneLine .min {
          display: none;
        }

        .clockOverlay {
          position: absolute;
          inset: 0;
          mix-blend-mode: lighten;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default PrideClockAdapter;
