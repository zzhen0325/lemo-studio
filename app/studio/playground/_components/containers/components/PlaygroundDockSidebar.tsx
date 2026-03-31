"use client";

import { Edit2, History, Image as ImageIcon, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipButton } from "@/components/ui/tooltip-button";

export type DockTab = "history" | "gallery" | "describe" | "style" | "banner";

interface PlaygroundDockSidebarProps {
  activeTab: DockTab;
  isDesktop: boolean;
  uploadedImagesCount: number;
  onDescribeToggle: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onGallery: () => void;
  onStyle: () => void;
}

function getButtonStyle(isActive: boolean) {
  return cn(
    "w-10 h-10 rounded-2xl transition-all duration-200",
    isActive
      ? "bg-primary text-black border border-white/40 hover:bg-primary/10 hover:border-white/60 hover:scale-105"
      : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:scale-110"
  );
}

function SidebarItem({
  icon,
  label,
  tooltipContent,
  tooltipSide,
  className,
  onClick,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  tooltipContent: string;
  tooltipSide: "right" | "bottom";
  className: string;
  onClick: () => void;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <TooltipButton
        icon={icon}
        label={label}
        tooltipContent={tooltipContent}
        tooltipSide={tooltipSide}
        className={className}
        onClick={onClick}
      />
      <span className="text-[10px]">{caption}</span>
    </div>
  );
}

export function PlaygroundDockSidebar({
  activeTab,
  isDesktop,
  uploadedImagesCount,
  onDescribeToggle,
  onEdit,
  onHistory,
  onGallery,
  onStyle,
}: PlaygroundDockSidebarProps) {
  const tooltipSide = isDesktop ? "right" : "bottom";

  return (
    <div
      className={cn(
        "z-[60] transition-all duration-300",
        isDesktop
          ? "absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
          : "relative top-4 flex flex-row justify-center gap-8 mb-6 w-full pt-2"
      )}
    >
      <SidebarItem
        icon={<Sparkles className="w-5 h-5" />}
        label="Describe"
        tooltipContent="Describe image"
        tooltipSide={tooltipSide}
        className={getButtonStyle(activeTab === "describe")}
        onClick={onDescribeToggle}
        caption="Describe"
      />
      <SidebarItem
        icon={<Edit2 className="w-5 h-5" />}
        label="Edit Image"
        tooltipContent={uploadedImagesCount > 0 ? "Edit Image" : "Image Editor"}
        tooltipSide={tooltipSide}
        className={getButtonStyle(false)}
        onClick={onEdit}
        caption="Edit"
      />
      <SidebarItem
        icon={<History className="w-5 h-5" />}
        label="History"
        tooltipContent="History"
        tooltipSide={tooltipSide}
        className={getButtonStyle(activeTab === "history")}
        onClick={onHistory}
        caption="History"
      />
      <SidebarItem
        icon={<ImageIcon className="w-5 h-5" />}
        label="Gallery"
        tooltipContent="Gallery"
        tooltipSide={tooltipSide}
        className={getButtonStyle(activeTab === "gallery")}
        onClick={onGallery}
        caption="Gallery"
      />
      <SidebarItem
        icon={<Palette className="w-5 h-5" />}
        label="Moodboards"
        tooltipContent="Moodboards"
        tooltipSide={tooltipSide}
        className={getButtonStyle(activeTab === "style")}
        onClick={onStyle}
        caption="Moodboards"
      />
    </div>
  );
}
