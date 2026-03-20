import { usePlaygroundStore } from "@/lib/store/playground-store";
import ColorBends from "@/components/visual-effects/ColorBends";

const HOME_GRADIENT_STOPS = [
  { position: 0, color: "#0F0F15" },
  { position: 0.3, color: "#1079BB" },
  { position: 0.4, color: "#FBC6E2" },
  { position: 0.5, color: "#FFBF9E" },
  { position: 0.6, color: "#FFD7B8" },
  { position: 0.7, color: "#FBC6E2" },
  { position: 0.8, color: "#1079BB" },
  { position: 1, color: "#0F0F15" },
];
const HOME_BACKGROUND_SCENE_ASPECT = 16 / 9;

export function PlaygroundBackground() {
  const showHistory = usePlaygroundStore(s => s.showHistory);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {showHistory ? (
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: "linear-gradient(180deg, #0F0F15 0%, #242A32 100%)",
          }}
        />
      ) : (
        <>
          <ColorBends
            className="absolute inset-0"
            colors={["#3387CC"]}
            rotation={100}
            opacity={0.08}
            speed={0.1}
            scale={3.5}
            frequency={1.5}
            warpStrength={1.1}
            mouseInfluence={1}
            parallax={2}
            noise={0}
            blur={2}
            transparent={false}
            backgroundGradientStops={HOME_GRADIENT_STOPS}
            backgroundGradientRotation={180}
            backgroundDistortion={18}
            backgroundBlend={0.12}
            sceneAspectRatio={HOME_BACKGROUND_SCENE_ASPECT}
          />



        </>
      )}
    </div>
  );
}
