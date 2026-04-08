"use client";

import React, { useEffect, useRef } from 'react';

interface WebGLRendererProps {
    shader: string;
    uniforms: Record<string, number | number[]>;
    className?: string;
    width?: number;
    height?: number;
}

const WebGLRenderer: React.FC<WebGLRendererProps> = ({ shader, uniforms, className, width = 800, height = 600 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
        if (!gl) {
            console.error('WebGL not supported');
            return;
        }

        // Vertex shader (simple quad)
        const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

        // Fragment shader (prefixed with uniforms)
        const fsSource = `
      precision highp float;
      ${Object.keys(uniforms)
                .filter(key => !new RegExp(`uniform\\s+\\w+\\s+${key}\\s*;`).test(shader))
                .map(key => `uniform float ${key};`)
                .join('\n')}
      ${!new RegExp(`uniform\\s+\\w+\\s+iTime\\s*;`).test(shader) ? 'uniform float iTime;' : ''}
      ${!new RegExp(`uniform\\s+\\w+\\s+iResolution\\s*;`).test(shader) ? 'uniform vec2 iResolution;' : ''}
      ${shader}
    `;

        const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

        const program = gl.createProgram();
        if (!program || !vertexShader || !fragmentShader) return;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return;
        }

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'position');
        const iTimeLocation = gl.getUniformLocation(program, 'iTime');
        const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
        const userUniformLocations = Object.keys(uniforms).reduce((acc, key) => {
            acc[key] = gl.getUniformLocation(program, key);
            return acc;
        }, {} as Record<string, WebGLUniformLocation | null>);

        const render = () => {
            const time = (Date.now() - startTimeRef.current) / 1000;

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            gl.enableVertexAttribArray(positionLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            gl.uniform1f(iTimeLocation, time);
            gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);

            Object.keys(uniforms).forEach(key => {
                const location = userUniformLocations[key];
                const value = uniforms[key];
                if (location) {
                    if (typeof value === 'number') {
                        gl.uniform1f(location, value);
                    }
                }
            });

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }

            // Clean up WebGL resources
            gl.deleteBuffer(positionBuffer);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteProgram(program);

            // Explicitly lose context if possible (optional but recommended for complete cleanup)
            const extension = gl.getExtension('WEBGL_lose_context');
            if (extension) {
                // extension.loseContext(); // Be careful with this as it might affect other contexts if not handled right
            }
        };
    }, [shader, uniforms]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            width={width}
            height={height}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
};

export default WebGLRenderer;
