'use client';

import React, { useEffect } from 'react';
import { StyleStackCard } from './StyleStackCard';
import { usePlaygroundStore } from '@/lib/store/playground-store';

interface StylesMarqueeProps {
    className?: string;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = () => {
    const styles = usePlaygroundStore(s => s.styles);
    const initStyles = usePlaygroundStore(s => s.initStyles);

    useEffect(() => {
        if (styles.length === 0) {
            initStyles();
        }
    }, [styles.length, initStyles]);

    if (styles.length === 0) return null;

    // To create an infinite loop, we duplicate the list
    // We need enough items to fill the screen width twice
    const duplicatedStyles = [...styles, ...styles, ...styles];

    return (
        <div
            className="relative w-full overflow-hidden py-[4vw] select-none pointer-events-auto group/marquee [&_h3]:!text-black/80 [&_p]:!text-black/40"
        >
            <style>
                {`
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-33.33%); }
                }
                `}
            </style>
            <div
                className="flex gap-10 w-max  group-hover/marquee:[animation-play-state:paused]"
                style={{
                    animation: `marquee ${styles.length * 10}s linear infinite`
                }}
            >
                {duplicatedStyles.map((style, idx) => (
                    <div key={`${style.id}-${idx}`} className="w-[14vw]  text-black shrink-0">
                        <StyleStackCard
                            style={style}
                            size="sm"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
