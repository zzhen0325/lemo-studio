type CssCustomProperties = {
  [key: `--${string}`]: string | number;
};

export const STUDIO_DARK_PALETTE = {
  base: "#0E0E0E",
  canvas: "#161616",
  panel: "#1C1C1C",
  surface: "#2C2D2F",
  border: "#4A4C4D",
  divider: "#2E2E2E",
  borderSubtle: "rgba(255,255,255,0.06)",
  foreground: "#D9D9D9",
  muted: "#A3A3A3",
  subtle: "#737373",
  accent: "#DAFFAC",
  accentForeground: "#000000",
} as const;

export const IMAGE_EDITOR_THEME = {
  background: STUDIO_DARK_PALETTE.canvas,
  card: STUDIO_DARK_PALETTE.surface,
  border: STUDIO_DARK_PALETTE.border,
  action: STUDIO_DARK_PALETTE.accent,
  actionSurface: "rgba(218, 255, 172, 0.05)",
  actionText: STUDIO_DARK_PALETTE.accentForeground,
  textPrimary: STUDIO_DARK_PALETTE.foreground,
  textSecondary: STUDIO_DARK_PALETTE.muted,
  textMuted: STUDIO_DARK_PALETTE.subtle,
  annotation: {
    border: "#FF0000",
    labelBackground: "#FF0000",
    labelText: "#FFFFFF",
    handleStroke: "#FFFFFF",
  },
} as const;

export const SETTINGS_THEME_VARS: CssCustomProperties = {
  ["--settings-bg" as string]: STUDIO_DARK_PALETTE.base,
  ["--settings-sidebar-bg" as string]: STUDIO_DARK_PALETTE.canvas,
  ["--settings-sidebar-active" as string]: STUDIO_DARK_PALETTE.surface,
  ["--settings-panel" as string]: STUDIO_DARK_PALETTE.panel,
  ["--settings-panel-soft" as string]: STUDIO_DARK_PALETTE.canvas,
  ["--settings-border" as string]: STUDIO_DARK_PALETTE.divider,
  ["--settings-border-subtle" as string]: STUDIO_DARK_PALETTE.borderSubtle,
  ["--settings-text" as string]: "#FFFFFF",
  ["--settings-text-muted" as string]: "#9CA3AF",
  ["--settings-text-subtle" as string]: "#6B7280",
  ["--settings-accent" as string]: STUDIO_DARK_PALETTE.accent,
  ["--settings-accent-fg" as string]: STUDIO_DARK_PALETTE.accentForeground,
};
