import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getApiBase } from "@/lib/api-base";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function GoogleApiStatus({ className }: { className?: string }) {
    const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'blocked' | 'offline'>('idle');
    const [lastCheck, setLastCheck] = useState<Date | null>(null);

    const checkStatus = React.useCallback(async () => {
        setStatus('checking');
        try {
            const res = await fetch(`${getApiBase()}/check-google-api`);
            const data = await res.json();
            setStatus(data.status);
            setLastCheck(new Date());
        } catch {
            setStatus('offline');
        }
    }, []);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [checkStatus]);

    const getStatusConfig = () => {
        switch (status) {
            case 'connected':
                return { color: 'bg-emerald-500', label: 'Google API Connected', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' };
            case 'blocked':
                return { color: 'bg-orange-500', label: 'Google API Blocked (API Key issue?)', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.5)] animate-pulse' };
            case 'offline':
                return { color: 'bg-red-500', label: 'Google API Unreachable (Network issue)', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse' };
            case 'checking':
                return { color: 'bg-blue-500', label: 'Checking connection...', glow: 'animate-pulse' };
            default:
                return { color: 'bg-gray-500', label: 'Initializing...', glow: '' };
        }
    };

    const config = getStatusConfig();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md cursor-help hover:bg-white/10 transition-colors", className)}>
                    <div className={cn("w-2 h-2 rounded-full", config.color, config.glow)} />
                    <span className="text-[10px] font-medium text-white/50 tracking-widest uppercase">
                        Google API
                    </span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#121212] border-white/10 text-white text-xs">
                <div className="space-y-1">
                    <p className="font-semibold">{config.label}</p>
                    {lastCheck && (
                        <p className="text-white/40 text-[10px]">Last check: {lastCheck.toLocaleTimeString()}</p>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
