import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewComfyProvider } from "@/lib/providers/view-comfy-provider";
import { cn } from "@/lib/utils";
import ScrollbarVisibility from "@/components/common/scrollbar-visibility";
import { AppToaster } from "@/components/ui/AppToaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrument = localFont({
  src: "../public/Font/InstrumentSerif-Regular.ttf",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Lemostudio",
  description: "PlaygroundV2 & Mapping Editor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${instrument.variable}`}>
      <head>
        <link rel="preload" href="/Font/InstrumentSerif-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/images/logo.svg" as="image" />
        <link rel="preload" href="/assets/loading-icon.svg" as="image" />
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body className={cn("min-h-screen font-sans antialiased")}>

        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <ViewComfyProvider>
              <ScrollbarVisibility />
              {children}
              <AppToaster />
            </ViewComfyProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
