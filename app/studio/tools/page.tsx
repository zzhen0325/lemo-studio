import { Suspense } from "react";
import ToolsView from "./_components/ToolsView";

export default function ToolsPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Thinking...</div>}>
        <ToolsView />
      </Suspense>
    </div>
  );
}
