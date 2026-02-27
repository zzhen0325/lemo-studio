"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { StudioSidebar } from "./_components/StudioSidebar";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col h-screen w-screen overflow-hidden text-neutral-200 selection:bg-indigo-500/30 relative bg-black")}> 
      <StudioSidebar />
      <main className="flex-1 relative h-full flex flex-col overflow-hidden w-full mx-auto">{children}</main>
    </div>
  );
}
