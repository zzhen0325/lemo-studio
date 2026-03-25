import { Suspense } from "react";
import DatasetManagerView from "./_components/DatasetManagerView";

export default function DatasetPage() {
  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Thinking...</div>}>
        <DatasetManagerView />
      </Suspense>
    </div>
  );
}
