import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  serial,
} from "drizzle-orm/pg-core";

// System health check table (DO NOT MODIFY OR DELETE)
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// Image Assets Table
export const imageAssets = pgTable(
  "image_assets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    url: text("url").notNull(),
    dir: varchar("dir", { length: 255 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    region: varchar("region", { length: 64 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // generation, reference, dataset, upload
    projectId: varchar("project_id", { length: 36 }),
    generationId: varchar("generation_id", { length: 36 }),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("image_assets_type_idx").on(table.type),
    index("image_assets_project_id_idx").on(table.projectId),
    index("image_assets_generation_id_idx").on(table.generationId),
  ]
);

// Generations Table
export const generations = pgTable(
  "generations",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    status: varchar("status", { length: 32 }).default("pending"), // pending, completed, failed
    progress: integer("progress"),
    progressStage: varchar("progress_stage", { length: 64 }),
    userId: varchar("user_id", { length: 36 }),
    projectId: varchar("project_id", { length: 36 }),
    llmResponse: text("llm_response"),
    outputImageId: varchar("output_image_id", { length: 36 }),
    sourceImageId: varchar("source_image_id", { length: 36 }),
    outputUrl: text("output_url"),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("generations_user_id_idx").on(table.userId),
    index("generations_project_id_idx").on(table.projectId),
    index("generations_created_at_idx").on(table.createdAt),
    index("generations_status_idx").on(table.status),
  ]
);

// Presets Table
export const presets = pgTable(
  "presets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    coverUrl: text("cover_url"),
    coverData: text("cover_data"), // Base64 data for the cover image
    config: jsonb("config"),
    editConfig: jsonb("edit_config"),
    category: varchar("category", { length: 64 }),
    projectId: varchar("project_id", { length: 36 }),
    type: varchar("type", { length: 32 }), // generation, edit
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("presets_category_idx").on(table.category),
    index("presets_type_idx").on(table.type),
  ]
);

// Preset Categories Table
export const presetCategories = pgTable(
  "preset_categories",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull().unique(),
    categories: jsonb("categories").default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

// Style Stacks Table
export const styleStacks = pgTable(
  "style_stacks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    prompt: text("prompt").notNull(),
    imagePaths: jsonb("image_paths").default([]),
    previewUrls: jsonb("preview_urls").default([]),
    collageImageUrl: text("collage_image_url"),
    collageConfig: jsonb("collage_config"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

// Tool Presets Table
export const toolPresets = pgTable(
  "tool_presets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    toolId: varchar("tool_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    values: jsonb("values"),
    thumbnail: text("thumbnail"),
    timestamp: integer("timestamp"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("tool_presets_tool_id_idx").on(table.toolId),
  ]
);

// Dataset Entries Table
export const datasetEntries = pgTable(
  "dataset_entries",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    collectionName: varchar("collection_name", { length: 255 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    prompt: text("prompt"),
    width: integer("width"),
    height: integer("height"),
    format: varchar("format", { length: 32 }),
    size: integer("size"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("dataset_entries_collection_name_idx").on(table.collectionName),
  ]
);

// API Config Table (for storing encrypted API keys)
export const apiConfigs = pgTable(
  "api_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: varchar("provider", { length: 64 }).notNull().unique(),
    encryptedKey: text("encrypted_key"),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

// Users Table
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

// Dataset Collections Table
export const datasetCollections = pgTable(
  "dataset_collections",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    count: integer("count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("dataset_collections_name_idx").on(table.name),
  ]
);

// Infinite Canvas Projects Table
export const infiniteCanvasProjects = pgTable(
  "infinite_canvas_projects",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }),
    userId: varchar("user_id", { length: 36 }),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("infinite_canvas_projects_user_id_idx").on(table.userId),
  ]
);

// Type exports
export type ImageAsset = typeof imageAssets.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type PresetCategory = typeof presetCategories.$inferSelect;
export type StyleStack = typeof styleStacks.$inferSelect;
export type ToolPreset = typeof toolPresets.$inferSelect;
export type DatasetEntry = typeof datasetEntries.$inferSelect;
export type ApiConfig = typeof apiConfigs.$inferSelect;
