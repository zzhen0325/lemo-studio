export const STUDIO_ROUTES = {
  playground: "/studio/playground",
  infiniteCanvas: "/infinite-canvas",
  mappingEditor: "/studio/mapping-editor",
  tools: "/studio/tools",
  dataset: "/studio/dataset",
  settings: "/studio/settings",
} as const;

export type StudioRoute = (typeof STUDIO_ROUTES)[keyof typeof STUDIO_ROUTES];
type StudioTopTabValue = "playground" | "infiniteCanvas" | "tools" | "dataset" | "settings";

export interface StudioNavItem {
  label: string;
  href: (typeof STUDIO_ROUTES)[StudioTopTabValue];
  value: StudioTopTabValue;
}

export const STUDIO_NAV_ITEMS: StudioNavItem[] = [
  { label: "Playground", href: STUDIO_ROUTES.playground, value: "playground" },
  { label: "Infinite Canvas", href: STUDIO_ROUTES.infiniteCanvas, value: "infiniteCanvas" },
  { label: "Tools", href: STUDIO_ROUTES.tools, value: "tools" },
  { label: "Dataset", href: STUDIO_ROUTES.dataset, value: "dataset" },
  // { label: "Settings", href: STUDIO_ROUTES.settings, value: "settings" },
];

export const STUDIO_BACKGROUND_PREFETCH_ROUTES: ReadonlyArray<StudioRoute> = STUDIO_NAV_ITEMS
  .filter((item) => item.value !== "playground")
  .map((item) => item.href);
