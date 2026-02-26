import { usePlaygroundStore } from "@/lib/store/playground-store";
import ColorBends from "@/components/visual-effects/ColorBends";

export function PlaygroundBackground() {
  const showHistory = usePlaygroundStore(s => s.showHistory);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">

      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: showHistory
            ? "#161616"
            : "linear-gradient(180deg, #0F0F15 0%, #131718 30%, #1079BB 60%, #FBC6E2 80.56%, #FFD7B8 92%, #EB9469 100%)",
        }}
      />
      {!showHistory && (
        <ColorBends
          colors={["#3387CC7D"]}
          rotation={120}
          opacity={0.1}
          speed={0.2}
          scale={3}
          frequency={1.5}
          warpStrength={1.1}
          mouseInfluence={0.8}
          parallax={1}
          noise={0.1}
          blur={0.3}
          transparent
        />
      )}
    </div>
  );
}
