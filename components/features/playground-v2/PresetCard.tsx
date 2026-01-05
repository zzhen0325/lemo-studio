import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Preset } from './types';
import GradualBlur from "../../common/graphics/GradualBlur";

interface PresetCardProps {
    preset: Preset;
    onClick: (preset: Preset) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({ preset, onClick }) => {
    return (
        <motion.div
            className="relative w-full aspect-[1/1] rounded-2xl overflow-hidden cursor-pointer group"


            onClick={() => onClick(preset)}
        >

            <Image
                src={preset.cover}
                alt={preset.title}
                fill
                sizes="(max-width: 300px) 50vw, (max-width: 600px) 33vw, 20vw"
                quality={60}
                className="object-cover object-center transition-transform duration-100 group-hover:scale-110"
            />
            <GradualBlur
                preset="bottom"
                height="30%"
                strength={3}
                zIndex={10}
                divCount={2}
            />




            <div className="absolute inset-x-0 bottom-0  z-20 flex flex-col items-center justify-end h-full">
                <h3 className="text-white font-bold text-sm   group-hover:translate-y-0 transition-transform duration-300 mb-2">
                    {preset.title}
                </h3>

            </div>

            {/* 选中/悬停高亮边框 */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/30 rounded-2xl transition-colors duration-300 pointer-events-none" />
        </motion.div>
    );
};
