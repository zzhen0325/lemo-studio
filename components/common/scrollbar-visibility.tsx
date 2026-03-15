'use client'
import { useEffect } from "react";

export default function ScrollbarVisibility() {
  useEffect(() => {
    let timer: number | undefined;
    const show = () => {
      document.documentElement.classList.add("scrolling");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        document.documentElement.classList.remove("scrolling");
      }, 800);
    };
    window.addEventListener("scroll", show, { passive: true });
    window.addEventListener("wheel", show, { passive: true });
    window.addEventListener("touchmove", show, { passive: true });
    window.addEventListener("keydown", show, { passive: true });
    return () => {
      window.removeEventListener("scroll", show);
      window.removeEventListener("wheel", show);
      window.removeEventListener("touchmove", show);
      window.removeEventListener("keydown", show);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return null;
}
