import React from 'react';
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipButtonProps {
    icon: React.ReactNode;
    label: string;
    tooltipContent: string;
    tooltipSide?: "top" | "right" | "bottom" | "left";
    tooltipDelay?: number;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function TooltipButton({
    icon,
    label,
    tooltipContent,
    tooltipSide = "right",
    tooltipDelay = 100,
    variant = "ghost",
    size = "icon",
    className = "",
    onClick,
}: TooltipButtonProps) {
    return (
        <TooltipProvider delayDuration={tooltipDelay}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={size}
                        className={`rounded-lg ${className}`}
                        aria-label={label}
                        onClick={onClick}
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide} sideOffset={5}>
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
