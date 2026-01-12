import { usePlaygroundStore } from "@/lib/store/playground-store";
import ColorBends from "@/components/ColorBends";

export function PlaygroundBackground() {
  const showHistory = usePlaygroundStore(s => s.showHistory);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">

      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: showHistory
            ? "linear-gradient(180deg, #0F0F15 0%, #131718 40%, #1079BB 80.49%, #E6B7A0 95%, #EB9469 100%)"
            : "linear-gradient(180deg, #0F0F15 0%, #131718 10%, #1079BB 50%, #FBC6E2 74.56%, #FFD7B8 87.73%, #EB9469 100%)",
        }}
      />
      {!showHistory && (
        <ColorBends
          colors={["#136293ff "]}
          rotation={120}
          opacity={0.1}
          speed={0.2}
          scale={3}
          frequency={1.2}
          warpStrength={1.1}
          mouseInfluence={0.8}
          parallax={1}
          noise={0.08}
          blur={0.1}
          transparent
        />
      )}
    </div>
  );
}
