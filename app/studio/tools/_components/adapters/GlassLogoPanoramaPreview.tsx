"use client";

import React from "react";

const GlassLogoPanoramaPreview: React.FC = () => (
  <div className="relative w-full h-full overflow-hidden bg-[#090a10]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(155,220,255,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.25),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(255,170,200,0.18),transparent_32%),linear-gradient(135deg,#07080e_0%,#122033_38%,#294d77_72%,#5f7691_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,0.08)_50%,transparent_85%)] opacity-70" />
    <div className="absolute left-1/2 top-1/2 h-[58%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[32%] border border-white/35 bg-white/10 shadow-[0_0_80px_rgba(190,228,255,0.22)] backdrop-blur-xl" />
    <div className="absolute left-1/2 top-1/2 h-[58%] w-[42%] -translate-x-1/2 -translate-y-1/2 rotate-[18deg] rounded-[32%] border border-white/25 bg-transparent" />
  </div>
);

export default GlassLogoPanoramaPreview;
