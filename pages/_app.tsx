import type { AppProps } from 'next/app';
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewComfyProvider } from "@/lib/providers/view-comfy-provider";
import { SWRCacheProvider } from "@/lib/swr-cache-provider";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/common/PageTransition";
import { useRouter } from 'next/router';
import { AppToaster } from "@/components/ui/AppToaster";

export default function MyApp({ Component, pageProps }: AppProps) {
    const router = useRouter();
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <SWRCacheProvider>
                <TooltipProvider>
                    <ViewComfyProvider>
                        <AnimatePresence mode="wait">
                            <PageTransition key={router.pathname}>
                                <Component {...pageProps} />
                            </PageTransition>
                        </AnimatePresence>
                        <AppToaster />
                    </ViewComfyProvider>
                </TooltipProvider>
            </SWRCacheProvider>
        </ThemeProvider>
    );
}
