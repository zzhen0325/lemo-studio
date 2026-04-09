"use client";

import { motion } from "framer-motion";
import React from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
    children: React.ReactNode;
    className?: string;
}

export default function PageTransition({ children, className }: PageTransitionProps) {
    const pathname = usePathname();
    const shouldDisableTransition = pathname === "/studio/gallery/local";

    if (shouldDisableTransition) {
        return (
            <div className={`w-full h-full ${className || ''}`}>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}
            className={`w-full h-full ${className || ''}`}
        >
            {children}
        </motion.div>
    );
}
