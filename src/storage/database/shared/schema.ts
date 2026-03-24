import { pgTable, serial, timestamp, index, varchar, text, integer, jsonb, unique, pgPolicy, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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
	promptZh: text("prompt_zh"),
	promptEn: text("prompt_en"),
	orderIdx: integer("order_idx").default(0),
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
	// 交互统计字段
	likeCount: integer("like_count").default(0),
	moodboardAddCount: integer("moodboard_add_count").default(0),
	downloadCount: integer("download_count").default(0),
	editCount: integer("edit_count").default(0),
	lastLikedAt: timestamp("last_liked_at", { withTimezone: true, mode: 'string' }),
	lastMoodboardAddedAt: timestamp("last_moodboard_added_at", { withTimezone: true, mode: 'string' }),
	lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true, mode: 'string' }),
	lastEditedAt: timestamp("last_edited_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("generations_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("generations_project_id_idx").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("generations_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("generations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("generations_like_count_idx").using("btree", table.likeCount.desc().nullsLast().op("int4_ops")),
	index("generations_moodboard_add_count_idx").using("btree", table.moodboardAddCount.desc().nullsLast().op("int4_ops")),
	index("generations_download_count_idx").using("btree", table.downloadCount.desc().nullsLast().op("int4_ops")),
	index("generations_edit_count_idx").using("btree", table.editCount.desc().nullsLast().op("int4_ops")),
]);

// 点赞去重表
export const generationLikes = pgTable("generation_likes", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	generationId: varchar("generation_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("generation_likes_generation_id_idx").using("btree", table.generationId.asc().nullsLast().op("text_ops")),
	index("generation_likes_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("generation_likes_unique").on(table.generationId, table.userId),
]);

export const imageAssets = pgTable("image_assets", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	// storage_key: 对象存储中的唯一标识（URI），用于生成预签名 URL
	storageKey: text("storage_key"),
	// url: 预签名 URL（可选，可由 storageKey 动态生成）
	url: text(),
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
	index("image_assets_storage_key_idx").using("btree", table.storageKey.asc().nullsLast().op("text_ops")),
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
	order: jsonb("order_arr").default([]),
	systemPrompt: text("system_prompt"),
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
	password: varchar({ length: 255 }),
});

// ==========================================
// Playground Shortcuts - 首页快捷入口配置表
// ==========================================
export const playgroundShortcuts = pgTable("playground_shortcuts", {
	// 基础信息
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	code: varchar({ length: 64 }).notNull(), // 唯一标识，如 "lemo", "us-kv", "sea-kv"
	name: varchar({ length: 255 }).notNull(), // 显示名称
	sortOrder: integer("sort_order").default(0), // 排序权重
	isEnabled: boolean("is_enabled").default(true), // 启用状态

	// 封面信息
	coverTitle: varchar("cover_title", { length: 255 }), // 封面标题
	coverSubtitle: varchar("cover_subtitle", { length: 500 }), // 封面副标题
	coverStorageKey: text("cover_storage_key"), // 封面图对象存储 key
	coverUrl: text("cover_url"), // 封面图 URL（可选，可动态生成）

	// 模型配置
	modelId: varchar("model_id", { length: 128 }), // 绑定模型 ID
	defaultAspectRatio: varchar("default_aspect_ratio", { length: 32 }), // 默认比例 (如 "1:1", "16:9")
	defaultWidth: integer("default_width"), // 默认宽度
	defaultHeight: integer("default_height"), // 默认高度
	allowModelChange: boolean("allow_model_change").default(true), // 是否允许改模型

	// Prompt 模板
	promptTemplate: text("prompt_template"), // 模板正文
	promptFields: jsonb("prompt_fields"), // 字段定义 JSON
	promptConfig: jsonb("prompt_config"), // 其他 prompt 配置 JSON

	// 详情内容
	moodboardDescription: text("moodboard_description"), // moodboard 说明
	examplePrompts: jsonb("example_prompts"), // 示例 prompt 列表 JSON
	galleryOrder: jsonb("gallery_order"), // 图集顺序（存储 image asset IDs）JSON

	// 运营信息
	creator: varchar({ length: 255 }), // 创建人
	publishStatus: varchar("publish_status", { length: 32 }).default('draft'), // 发布状态: draft, published, archived
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }), // 发布时间

	// 时间戳
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("playground_shortcuts_code_unique").on(table.code),
	index("playground_shortcuts_code_idx").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("playground_shortcuts_sort_order_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("playground_shortcuts_is_enabled_idx").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
	index("playground_shortcuts_publish_status_idx").using("btree", table.publishStatus.asc().nullsLast().op("text_ops")),
]);
