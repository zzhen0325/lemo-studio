import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  className,
  size = 40 
}) => {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ width: size, height: size }}
      >
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 200 200" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base circle background */}
          <circle 
            cx="100" 
            cy="100" 
            r="32.766" 
            stroke="white" 
            strokeOpacity="0.1" 
            strokeWidth="11"
          />
          
          <mask id="mask0_50_443" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="61" y="61" width="78" height="78">
            <circle cx="100" cy="100" r="32.766" stroke="white" strokeWidth="11"/>
          </mask>
          
          <g mask="url(#mask0_50_443)">
            <g filter="url(#filter0_f_50_443)">
              <path 
                d="M134.089 98.3599C134.089 103.049 133.246 107.541 131.703 111.692" 
                stroke="white" 
                strokeWidth="31" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </g>
          </g>
          
          {/* Main highlight stroke */}
          <path 
            d="M133.021 98.6646C133.021 103.353 132.177 107.845 130.634 111.997" 
            stroke="white" 
            strokeWidth="11" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          
          <defs>
            <filter id="filter0_f_50_443" x="87.1985" y="53.8599" width="91.3907" height="102.336" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
              <feGaussianBlur stdDeviation="14.5" result="effect1_foregroundBlur_50_443"/>
            </filter>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
};
