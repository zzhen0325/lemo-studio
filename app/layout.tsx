import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewComfyProvider } from "@/lib/providers/view-comfy-provider";
import { cn } from "@/lib/utils";
import ScrollbarVisibility from "@/components/common/scrollbar-visibility";
import { AppToaster } from "@/components/ui/AppToaster";

const instrument = localFont({
  src: "../public/Font/InstrumentSerif-Regular.ttf",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Lemostudio",
  description: "PlaygroundV2 & Mapping Editor",
};

const enableTweakcnLivePreview = process.env.NEXT_PUBLIC_ENABLE_TWEAKCN_LIVE_PREVIEW === "true";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrument.variable}`}>
      <head>
        <link rel="preload" href="/Font/InstrumentSerif-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/images/logo.svg" as="image" />
        <link rel="preload" href="/assets/loading-icon.svg" as="image" />
      </head>
      <body className={cn("min-h-screen font-sans antialiased")} suppressHydrationWarning>

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
