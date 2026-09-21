"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { WebGLToolConfig } from './tool-configs';

const WebGLRenderer = dynamic(() => import('./WebGLRenderer'), { ssr: false });

/** Keep offscreen cards from downloading adapters or creating rendering contexts. */
export function ToolPreview({ tool }: { tool: WebGLToolConfig }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const values = Object.fromEntries(tool.parameters.map((param) => [param.id, param.defaultValue]));
    return (
        <div ref={containerRef} className="w-full h-full rounded-none relative isolate">
            {isVisible && tool.type === 'shader' && tool.fragmentShader && (
                <WebGLRenderer
                    shader={tool.fragmentShader}
                    uniforms={values as Record<string, number>}
                    width={400}
                    height={225}
                />
            )}
            {isVisible && tool.type === 'component' && tool.component && (
                <tool.component isPreview {...values} />
            )}
        </div>
    );
}
