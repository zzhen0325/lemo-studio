import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Infinite Canvas',
  description: 'Standalone infinite canvas editor powered by existing image generation APIs.',
};

export default function InfiniteCanvasLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio-shell min-h-screen w-full">{children}</div>;
}
