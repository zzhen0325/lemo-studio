import * as React from "react"
import { cn } from "@/lib/utils"

export interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "outline" | "ghost"
  size?: "sm" | "md"
}

export const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  ({ className, variant = "outline", size = "sm", ...props }, ref) => {
    const base = "flex items-center gap-2 rounded-xl cursor-pointer select-none transition-colors"
    const v = variant === "outline"
      ? "border border-white/10 bg-black/10 hover:bg-white/80 hover:text-black"
      : "bg-transparent hover:bg-black/10"
    const s = size === "sm" ? "px-3 py-2" : "px-4 py-3"
    return (
      <div
        ref={ref}
        className={cn(base, v, s, className)}
        {...props}
      />
    )
  }
)
Item.displayName = "Item"

export const ItemContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 min-w-0", className)} {...props} />
  )
)
ItemContent.displayName = "ItemContent"

export const ItemTitle = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("text-sm", className)} {...props} />
  )
)
ItemTitle.displayName = "ItemTitle"

export const ItemDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  )
)
ItemDescription.displayName = "ItemDescription"

export const ItemActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
)
ItemActions.displayName = "ItemActions"

export const ItemMedia = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
)
ItemMedia.displayName = "ItemMedia"

