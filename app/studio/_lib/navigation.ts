export const STUDIO_ROUTES = {
  playground: "/studio/playground",
  mappingEditor: "/studio/mapping-editor",
  tools: "/studio/tools",
  dataset: "/studio/dataset",
  settings: "/studio/settings",
  gallery: "/studio/gallery",
} as const;

export type StudioRoute = (typeof STUDIO_ROUTES)[keyof typeof STUDIO_ROUTES];
type StudioNavValue = "playground" | "tools" | "dataset" | "settings";

export interface StudioNavItem {
  label: string;
  href: (typeof STUDIO_ROUTES)[StudioNavValue];
  value: StudioNavValue;
}

export const STUDIO_NAV_ITEMS: StudioNavItem[] = [
  { label: "Playground", href: STUDIO_ROUTES.playground, value: "playground" },
  { label: "Tools", href: STUDIO_ROUTES.tools, value: "tools" },
  { label: "Dataset", href: STUDIO_ROUTES.dataset, value: "dataset" },
  { label: "Settings", href: STUDIO_ROUTES.settings, value: "settings" },
];
