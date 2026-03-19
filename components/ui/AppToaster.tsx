"use client";

import { Toaster } from "sonner";

export function AppToaster() {
    return (
        <Toaster
            className="z-layer-toast"
            position="bottom-center"
            theme="dark"
            style={{ zIndex: "var(--z-layer-toast)" }}
            toastOptions={{
                className: "bg-white/[0.08] mb-10 backdrop-blur-2xl border border-white/20 !shadow-[0_8px_32px_rgba(0,0,0,0.4)] !rounded-xl glass-toast",
                classNames: {
                    description: "text-white/60 text-xs",
                    title: "text-white text-sm font-medium"
                },
                style: {
                    minWidth: '240px',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                },
            }}
        />
    );
}
