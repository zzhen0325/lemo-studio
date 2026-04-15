"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ShaderLabFullscreenShell = dynamic(
  () => import("./_components/ShaderLabFullscreenShell").then((mod) => mod.ShaderLabFullscreenShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-[#0f1016] text-white/60">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3 text-sm font-medium tracking-wider">Loading Shader Lab...</span>
      </div>
    ),
  }
);

export default function ShaderLabToolPage() {
  return <ShaderLabFullscreenShell />;
}
