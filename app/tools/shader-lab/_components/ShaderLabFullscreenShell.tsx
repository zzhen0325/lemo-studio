"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ShaderLabPage } from "@shaderlab/components/pages/shader-lab-page";
import styles from "./shader-lab-theme.module.css";

export function ShaderLabFullscreenShell() {
  const router = useRouter();

  return (
    <div className={styles.viewport}>
      <button
        type="button"
        aria-label="Exit Shader Lab"
        className={styles.exitButton}
        onClick={() => router.push("/studio/tools")}
      >
        <ArrowLeft size={16} />
        <span className={styles.exitButtonLabel}>Exit</span>
      </button>

      <div id="shader-lab-root" className={styles.editorRoot}>
        <ShaderLabPage />
      </div>
    </div>
  );
}
