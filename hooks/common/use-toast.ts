"use client"

import { toast as sonnerToast } from "sonner"
import type { ReactNode } from "react"

interface ToastProps {
  id?: string | number
  title?: ReactNode
  description?: ReactNode
  variant?: "default" | "destructive"
  duration?: number
  action?: ReactNode
}

/**
 * Compatibility wrapper for sonner toast
 */
function toast({ id, title, description, variant, duration, action }: ToastProps) {
  const options = {
    id,
    description,
    duration: duration === Infinity ? Infinity : (duration || 4000),
    action: action as any, // sonner supports action objects too, but we can pass react component
  }

  if (variant === "destructive") {
    return sonnerToast.error(title, options)
  }

  return sonnerToast(title, options)
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  }
}

export { useToast, toast }

