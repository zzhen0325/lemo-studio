import { motion } from "framer-motion";

export function PlaygroundBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #0F0F15 0%, #131718 12.62%, #1079BB 48.49%, #FBC6E2 74.56%, #D8C6B8 87.73%, #EB9469 100%)",
          }}
        />
      </motion.div>
    </div>
  );
}
