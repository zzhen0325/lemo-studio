import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Infinite Canvas',
  description: 'Standalone infinite canvas editor powered by existing image generation APIs.',
};

export default function InfiniteCanvasLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full bg-zinc-50 dark:bg-[#161616] text-zinc-900 dark:text-zinc-100 transition-colors">{children}</div>;
}
