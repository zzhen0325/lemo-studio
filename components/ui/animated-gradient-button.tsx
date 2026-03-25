"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { motion, type Variants } from "framer-motion"
import * as React from "react"

import ShinyText from "@/components/ui/ShinyText"
import { cn } from "@/lib/utils"

const buttonVariants: Variants = {
  initial: {
    scale: 1,
  },
  hover: {
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 18,
    },
  },
}

const animatedButtonVariants = cva(
  [
    "group relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium",
    "transition-all duration-200 ease-in-out",
    "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300/80",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "transform-gpu cursor-pointer",
  ],
  {
    variants: {
      variant: {
        default: [
          "border border-black/5 bg-white text-black shadow-sm shadow-black/5",
          "hover:bg-white hover:text-black hover:shadow-sm",
        ],
        outline: [
          "border border-black/10 bg-white text-black",
          "hover:bg-white hover:text-black",
        ],
        gradient: [
          "border border-black/5 bg-white text-black shadow-sm shadow-black/5",
          "hover:bg-white hover:text-black hover:shadow-sm",
        ],
        ghost: [
          "bg-transparent text-black",
          "hover:bg-white/80 hover:text-black",
        ],
      },
      size: {
        sm: "h-8 gap-1.5 px-3 py-1 text-xs [&_svg]:size-3",
        md: "h-10 gap-2 px-4 py-2 text-sm [&_svg]:size-4",
        lg: "h-12 gap-2.5 px-6 py-3 text-base [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface AnimatedButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      | "onDrag"
      | "onDragStart"
      | "onDragEnd"
      | "onAnimationStart"
      | "onAnimationEnd"
      | "onAnimationIteration"
      | "children"
    >,
    VariantProps<typeof animatedButtonVariants> {
  label: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  loading?: boolean
  disableWhileLoading?: boolean
  className?: string
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      label,
      variant,
      size,
      iconLeft,
      iconRight,
      loading = false,
      disableWhileLoading = true,
      className,
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (disabled || (loading && disableWhileLoading)) return

      onClick?.(event)
    }

    const isDisabled = Boolean(disabled || (loading && disableWhileLoading))

    return (
      <motion.button
        ref={ref}
        className={cn(animatedButtonVariants({ variant, size }), className)}
        variants={buttonVariants}
        initial="initial"
        whileHover={!isDisabled ? "hover" : "initial"}
        whileTap={!isDisabled ? "tap" : "initial"}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={loading}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">
          {loading ? (
            <motion.svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <path
                d="M12 4.75V6.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17.25 12H18.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 17.25V18.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.25 12H6.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7.5 7.5L8.56 8.56"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.44 15.44L16.5 16.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16.5 7.5L15.44 8.56"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.56 15.44L7.5 16.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          ) : (
            iconLeft && (
              <motion.span
                initial={{ x: -2, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                {iconLeft}
              </motion.span>
            )
          )}

          <motion.span
            initial={{ y: 1, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
          >
            {isHovered && !loading ? (
              <ShinyText
                text={label}
                speed={1.8}
                color="#111111"
                shineColor="#BCE2FF"
                spread={135}
                className="font-inherit"
              />
            ) : (
              label
            )}
          </motion.span>

          {!loading && iconRight && (
            <motion.span
              initial={{ x: 2, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              {iconRight}
            </motion.span>
          )}
        </span>
      </motion.button>
    )
  }
)

AnimatedButton.displayName = "AnimatedButton"

export { AnimatedButton, animatedButtonVariants }
