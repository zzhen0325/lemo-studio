import { Suspense } from "react";
import { SettingsView } from "./_components/SettingsView";

export default function SettingsPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Thinking...</div>}>
        <SettingsView />
      </Suspense>
    </div>
  );
}
