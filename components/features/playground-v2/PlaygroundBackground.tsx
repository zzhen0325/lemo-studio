import { usePlaygroundStore } from "@/lib/store/playground-store";

export function PlaygroundBackground() {
  const showHistory = usePlaygroundStore(s => s.showHistory);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: showHistory
            ? "linear-gradient(180deg, #0F0F15 0%, #131718 12.62%, #1079BB 48.49%, #D8C6B8 87.73%, #EB9469 100%)"
            : "linear-gradient(180deg, #0F0F15 0%, #131718 12.62%, #1079BB 48.49%, #FBC6E2 74.56%, #D8C6B8 87.73%, #EB9469 100%)",
        }}
      />
    </div>
  );
}
