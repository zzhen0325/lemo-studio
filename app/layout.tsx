import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { instrumentSerif, poppins } from "@/lib/fonts";
import { ViewComfyProvider } from "@/lib/providers/view-comfy-provider";
import { cn } from "@/lib/utils";
import ScrollbarVisibility from "@/components/common/scrollbar-visibility";
import { AppToaster } from "@/components/ui/AppToaster";

export const metadata: Metadata = {
  title: "Lemostudio",
  description: "PlaygroundV2 & Mapping Editor",
  icons: {
    icon: "/images/logo.ico/favicon.ico",
    shortcut: "/images/logo.ico/favicon.ico",
  },
};

const enableTweakcnLivePreview = process.env.NEXT_PUBLIC_ENABLE_TWEAKCN_LIVE_PREVIEW === "true";

function resolveRuntimePublicApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE || "").trim();
}

const runtimePublicEnv = {
  apiBase: resolveRuntimePublicApiBase(),
  comfyUrl: (process.env.NEXT_PUBLIC_COMFYUI_URL || "").trim(),
  baseUrl: (process.env.NEXT_PUBLIC_BASE_URL || "").trim(),
  disableImageOptimization: (process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION || "").trim(),
};
const runtimePublicEnvScript = `window.__LEMO_RUNTIME_ENV__ = ${JSON.stringify(runtimePublicEnv).replace(/</g, "\\u003c")};`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(poppins.variable, instrumentSerif.variable)}>
      <head>
        <link rel="preload" href="/images/studiologo.svg" as="image" />
        <link rel="preload" href="/assets/loading-icon.svg" as="image" />
      </head>
      <body className={cn("min-h-screen font-sans antialiased")} suppressHydrationWarning>
        <Script id="lemo-runtime-public-env" strategy="beforeInteractive">
          {runtimePublicEnvScript}
        </Script>

        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <ViewComfyProvider>
              <ScrollbarVisibility />
              {children}
              <AppToaster />
            </ViewComfyProvider>
          </TooltipProvider>
        </ThemeProvider>
        {enableTweakcnLivePreview ? (
          <Script
            id="tweakcn-live-preview"
            src="https://tweakcn.com/live-preview.min.js"
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
        ) : null}
      </body>
    </html>
  );
}
