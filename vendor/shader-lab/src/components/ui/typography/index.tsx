import { cva, type VariantProps } from "class-variance-authority"
import { createElement, type ElementType } from "react"
import { cn } from "@shaderlab/lib/cn"

const typographyVariants = cva("m-0", {
  variants: {
    variant: {
      display: "type-display",
      heading: "type-heading",
      title: "type-title",
      body: "type-body",
      label: "type-label",
      caption: "type-caption",
      overline: "type-overline",
      monoMd: "type-mono-md",
      monoSm: "type-mono-sm",
      monoXs: "type-mono-xs",
    },
    tone: {
      primary: "text-[var(--ds-color-text-primary)]",
      secondary: "text-[var(--ds-color-text-secondary)]",
      tertiary: "text-[var(--ds-color-text-tertiary)]",
      muted: "text-[var(--ds-color-text-muted)]",
      disabled: "text-[var(--ds-color-text-disabled)]",
      onLight: "text-[var(--ds-color-text-on-light)]",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    variant: "body",
    tone: "primary",
    align: "left",
  },
})

type TypographyProps = {
  as?: ElementType
  className?: string
} & VariantProps<typeof typographyVariants> &
  Omit<Record<string, unknown>, "as" | "color">

export function Typography({
  as,
  className,
  variant,
  tone,
  align,
  ...props
}: TypographyProps) {
  const Component = (as ?? "p") as ElementType
  const componentProps = props as Record<string, unknown>

  return createElement(Component, {
    ...componentProps,
    className: cn(typographyVariants({ variant, tone, align }), className),
  })
}
