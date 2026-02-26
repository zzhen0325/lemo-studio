"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const SettingsView = dynamic(() => import("./_components/SettingsView").then((m) => m.SettingsView), {
  loading: () => <div className="flex h-full items-center justify-center text-white">Loading Settings...</div>,
  ssr: false,
});

export default function SettingsPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Settings...</div>}>
        <SettingsView />
      </Suspense>
    </div>
  );
}
