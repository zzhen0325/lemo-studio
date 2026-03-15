"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    showRadialGradient?: boolean;
    colors?: {
        color1: string;
        color2: string;
        color3: string;
        color4: string;
        color5: string;
    };
}

export const AuroraBackground = ({
    className,
    children,
    showRadialGradient = true,
    colors,
    ...props
}: AuroraBackgroundProps) => {
    const auroraGradient = colors
        ? `repeating-linear-gradient(100deg, ${colors.color1} 10%, ${colors.color2} 15%, ${colors.color3} 20%, ${colors.color4} 25%, ${colors.color5} 30%)`
        : "repeating-linear-gradient(100deg,#3b82f6 10%,#a5b4fc 15%,#93c5fd 20%,#ddd6fe 25%,#60a5fa 30%)";

    return (
        <main>
            <div
                className={cn(
                    "transition-bg relative flex h-[100vh] flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900",
                    className
                )}
                {...props}
            >
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={
                        {
                            "--aurora": auroraGradient,
                            "--dark-gradient":
                                "repeating-linear-gradient(100deg,#000 0%,#000 7%,transparent 10%,transparent 12%,#000 16%)",
                            "--white-gradient":
                                "repeating-linear-gradient(100deg,#fff 0%,#fff 7%,transparent 10%,transparent 12%,#fff 16%)",

                            "--blue-300": "#93c5fd",
                            "--blue-400": "#60a5fa",
                            "--blue-500": "#3b82f6",
                            "--indigo-300": "#a5b4fc",
                            "--violet-200": "#ddd6fe",
                            "--black": "#000",
                            "--white": "#fff",
                            "--transparent": "transparent",
                        } as React.CSSProperties
                    }
                >
                    <div
                        className={cn(
                            `after:animate-aurora pointer-events-none absolute -inset-[10px] [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-50 blur-[10px] invert filter will-change-transform [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""] dark:[background-image:var(--dark-gradient),var(--aurora)] dark:invert-0 after:dark:[background-image:var(--dark-gradient),var(--aurora)]`,

                            showRadialGradient &&
                            `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`
                        )}
                    ></div>
                </div>
                {children}
            </div>
        </main>
    );
};
