import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0f1016] text-white/60">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-3 text-sm font-medium tracking-wider">Loading Shader Lab...</span>
    </div>
  );
}
