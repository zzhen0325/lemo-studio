import { pgTable, unique, varchar, text, jsonb, timestamp, serial, index, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const apiConfigs = pgTable("api_configs", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	provider: varchar({ length: 64 }).notNull(),
	encryptedKey: text("encrypted_key"),
	config: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("api_configs_provider_unique").on(table.provider),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const datasetEntries = pgTable("dataset_entries", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	collectionName: varchar("collection_name", { length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	url: text().notNull(),
	prompt: text(),
	width: integer(),
	height: integer(),
	format: varchar({ length: 32 }),
	size: integer(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("dataset_entries_collection_name_idx").using("btree", table.collectionName.asc().nullsLast().op("text_ops")),
]);

export const generations = pgTable("generations", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	status: varchar({ length: 32 }).default('pending'),
	progress: integer(),
	progressStage: varchar("progress_stage", { length: 64 }),
	userId: varchar("user_id", { length: 36 }),
	projectId: varchar("project_id", { length: 36 }),
	llmResponse: text("llm_response"),
	outputImageId: varchar("output_image_id", { length: 36 }),
	sourceImageId: varchar("source_image_id", { length: 36 }),
	outputUrl: text("output_url"),
	config: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("generations_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("generations_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("generations_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("generations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const imageAssets = pgTable("image_assets", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	url: text().notNull(),
	dir: varchar({ length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	region: varchar({ length: 64 }).notNull(),
	type: varchar({ length: 32 }).notNull(),
	projectId: varchar("project_id", { length: 36 }),
	generationId: varchar("generation_id", { length: 36 }),
	meta: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("image_assets_generation_id_idx").using("btree", table.generationId.asc().nullsLast().op("text_ops")),
	index("image_assets_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("image_assets_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const presetCategories = pgTable("preset_categories", {
	id: serial().primaryKey().notNull(),
	key: varchar({ length: 64 }).notNull(),
	categories: jsonb().default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("preset_categories_key_unique").on(table.key),
]);

export const presets = pgTable("presets", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	coverUrl: text("cover_url"),
	coverData: text("cover_data"),
	config: jsonb(),
	editConfig: jsonb("edit_config"),
	category: varchar({ length: 64 }),
	projectId: varchar("project_id", { length: 36 }),
	type: varchar({ length: 32 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("presets_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("presets_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const styleStacks = pgTable("style_stacks", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	prompt: text().notNull(),
	imagePaths: jsonb("image_paths").default([]),
	previewUrls: jsonb("preview_urls").default([]),
	collageImageUrl: text("collage_image_url"),
	collageConfig: jsonb("collage_config"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const toolPresets = pgTable("tool_presets", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	toolId: varchar("tool_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	values: jsonb(),
	thumbnail: text(),
	timestamp: integer(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("tool_presets_tool_id_idx").using("btree", table.toolId.asc().nullsLast().op("text_ops")),
]);

export const datasetCollections = pgTable("dataset_collections", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	count: integer().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("dataset_collections_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const infiniteCanvasProjects = pgTable("infinite_canvas_projects", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }),
	userId: varchar("user_id", { length: 36 }),
	data: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("infinite_canvas_projects_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	displayName: varchar("display_name", { length: 255 }),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
