import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

export interface SplitTextProps {
    text: string;
    className?: string;
    delay?: number;
    duration?: number;
    ease?: string | ((t: number) => number);
    splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
    from?: gsap.TweenVars;
    to?: gsap.TweenVars;
    animateOnHover?: boolean;
    hoverFrom?: gsap.TweenVars;
    hoverTo?: gsap.TweenVars;
    threshold?: number;
    rootMargin?: string;
    tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
    textAlign?: React.CSSProperties['textAlign'];
    onLetterAnimationComplete?: () => void;
}

const SplitText: React.FC<SplitTextProps> = ({
    text,
    className = '',
    delay = 100,
    duration = 0.6,
    ease = 'power3.out',
    splitType = 'chars',
    from = { opacity: 0, y: 40 },
    to = { opacity: 1, y: 0 },
    animateOnHover = true,
    hoverFrom = { y: -10, opacity: 0 },
    hoverTo = { y: 0, opacity: 1 },
    threshold = 0.1,
    rootMargin = '-100px',
    tag = 'p',
    textAlign = 'center',
    onLetterAnimationComplete
}) => {
    const ref = useRef<HTMLHeadingElement | HTMLParagraphElement | HTMLSpanElement>(null);
    const animationCompletedRef = useRef(false);
    const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);
    const [targets, setTargets] = useState<Element[]>([]);

    useEffect(() => {
        if (document.fonts.status === 'loaded') {
            setFontsLoaded(true);
        } else {
            document.fonts.ready.then(() => {
                setFontsLoaded(true);
            });
        }
    }, []);

    useGSAP(
        () => {
            if (!ref.current || !text || !fontsLoaded) return;
            const el = ref.current as HTMLElement & {
                _rbsplitInstance?: GSAPSplitText;
            };

            if (el._rbsplitInstance) {
                try {
                    el._rbsplitInstance.revert();
                } catch { }
                el._rbsplitInstance = undefined;
            }

            const startPct = (1 - threshold) * 100;
            const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
            const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
            const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
            const sign =
                marginValue === 0
                    ? ''
                    : marginValue < 0
                        ? `-=${Math.abs(marginValue)}${marginUnit}`
                        : `+=${marginValue}${marginUnit}`;
            const start = `top ${startPct}%${sign}`;

            const assignTargets = (self: GSAPSplitText) => {
                let localTargets: Element[] = [];
                if (splitType.includes('chars') && self.chars?.length) localTargets = self.chars;
                if (!localTargets.length && splitType.includes('words') && self.words.length) localTargets = self.words;
                if (!localTargets.length && splitType.includes('lines') && self.lines.length) localTargets = self.lines;
                if (!localTargets.length) localTargets = self.chars || self.words || self.lines;
                setTargets(localTargets);
                return localTargets;
            };

            const splitInstance = new GSAPSplitText(el, {
                type: splitType,
                smartWrap: true,
                autoSplit: splitType === 'lines',
                linesClass: 'split-line',
                wordsClass: 'split-word',
                charsClass: 'split-char',
                reduceWhiteSpace: false,
                onSplit: (self: GSAPSplitText) => {
                    const currentTargets = assignTargets(self);
                    return gsap.fromTo(
                        currentTargets,
                        { ...from },
                        {
                            ...to,
                            duration,
                            ease,
                            stagger: delay / 1000,
                            scrollTrigger: {
                                trigger: el,
                                start,
                                once: true,
                                fastScrollEnd: true,
                                anticipatePin: 0.4
                            },
                            onComplete: () => {
                                animationCompletedRef.current = true;
                                onLetterAnimationComplete?.();
                            },
                            willChange: 'transform, opacity',
                            force3D: true
                        }
                    );
                }
            });
            el._rbsplitInstance = splitInstance;
            return () => {
                ScrollTrigger.getAll().forEach(st => {
                    if (st.trigger === el) st.kill();
                });
                try {
                    splitInstance.revert();
                } catch { }
                el._rbsplitInstance = undefined;
            };
        },
        {
            dependencies: [
                text,
                delay,
                duration,
                ease,
                splitType,
                JSON.stringify(from),
                JSON.stringify(to),
                threshold,
                rootMargin,
                fontsLoaded,
                onLetterAnimationComplete
            ],
            scope: ref
        }
    );

    const handleMouseEnter = () => {
        if (!animateOnHover || !targets.length) return;

        gsap.fromTo(
            targets,
            { ...hoverFrom },
            {
                ...hoverTo,
                duration: duration * 0.8,
                ease: 'power2.out',
                stagger: (delay / 1000) * 0.5,
                overwrite: true
            }
        );
    };

    const renderTag = () => {
        const style: React.CSSProperties = {
            textAlign,
            wordWrap: 'break-word',
            willChange: 'transform, opacity'
        };
        const classes = `split-parent overflow-hidden inline-block whitespace-normal ${className}`;
        const props = {
            ref,
            style,
            className: classes,
            onMouseEnter: handleMouseEnter
        };

        const { ref: elementRef, ...otherProps } = props;

        switch (tag) {
            case 'h1':
                return <h1 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h1>;
            case 'h2':
                return <h2 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h2>;
            case 'h3':
                return <h3 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h3>;
            case 'h4':
                return <h4 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h4>;
            case 'h5':
                return <h5 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h5>;
            case 'h6':
                return <h6 ref={elementRef as React.RefObject<HTMLHeadingElement>} {...otherProps}>{text}</h6>;
            case 'span':
                return <span ref={elementRef as React.RefObject<HTMLSpanElement>} {...otherProps}>{text}</span>;
            default:
                return <p ref={elementRef as React.RefObject<HTMLParagraphElement>} {...otherProps}>{text}</p>;
        }
    };

    return renderTag();
};

export default SplitText;
