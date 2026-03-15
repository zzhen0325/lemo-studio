"use client"

import * as React from "react"

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: "class" | "data-theme"
  defaultTheme?: "light" | "dark" | "system"
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  storageKey?: string
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "light",
  enableSystem = false,
  disableTransitionOnChange = false,
  storageKey = "theme",
}: ThemeProviderProps) {
  React.useEffect(() => {
    const doc = document.documentElement
    const stored = localStorage.getItem(storageKey)
    const prefersDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

    const resolveTheme = (val: string | null): "light" | "dark" => {
      const t = (val ?? defaultTheme)
      if (t === "system") {
        return enableSystem && prefersDark() ? "dark" : "light"
      }
      return t === "dark" ? "dark" : "light"
    }

    const applyTheme = (theme: "light" | "dark") => {
      if (disableTransitionOnChange) {
        const css = document.createElement("style")
        css.setAttribute("data-theme-transition-disable", "")
        css.textContent = "*{transition:none !important}"
        document.head.appendChild(css)
        requestAnimationFrame(() => {
          if (attribute === "class") {
            doc.classList.toggle("dark", theme === "dark")
          } else {
            doc.setAttribute("data-theme", theme)
          }
          // Force reflow then remove style
          void doc.offsetHeight
          css.remove()
        })
      } else {
        if (attribute === "class") {
          doc.classList.toggle("dark", theme === "dark")
        } else {
          doc.setAttribute("data-theme", theme)
        }
      }
    }

    const initial = resolveTheme(stored)
    applyTheme(initial)

    if (enableSystem && (stored === null || stored === "system")) {
      const mql = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme(prefersDark() ? "dark" : "light")
      try {
        mql.addEventListener("change", handler)
      } catch {
        // Safari
        mql.addListener(handler)
      }
      return () => {
        try {
          mql.removeEventListener("change", handler)
        } catch {
          mql.removeListener(handler)
        }
      }
    }
  }, [attribute, defaultTheme, enableSystem, disableTransitionOnChange, storageKey])

  return <>{children}</>
}
