-- Schema for Lemo AI Studio cloud storage (Postgres)
-- This file defines core tables used for CDN-backed image storage and Supabase-based metadata.

-- 1. Images table: generic image registry
CREATE TABLE IF NOT EXISTS images (
    id              text PRIMARY KEY,
    url             text NOT NULL,
    source_type     text NOT NULL,
    project_id      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    metadata        jsonb
);

CREATE INDEX IF NOT EXISTS idx_images_project_created_at
    ON images (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_created_at
    ON images (created_at DESC);


-- 2. Generations table: link generation runs with output images
CREATE TABLE IF NOT EXISTS generations (
    id                text PRIMARY KEY,
    user_id           text,
    project_id        text,
    output_url        text NOT NULL,
    config            jsonb NOT NULL,
    status            text NOT NULL,
    source_image_url  text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_project_created_at
    ON generations (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_user_created_at
    ON generations (user_id, created_at DESC);


-- 3. Presets table: store generation/edit presets
CREATE TABLE IF NOT EXISTS presets (
    id           text PRIMARY KEY,
    name         text NOT NULL,
    cover_url    text,
    config       jsonb NOT NULL,
    edit_config  jsonb,
    category     text,
    project_id   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    type         text
);

CREATE INDEX IF NOT EXISTS idx_presets_project
    ON presets (project_id);

CREATE INDEX IF NOT EXISTS idx_presets_category
    ON presets (category);


-- 4. Styles & style images
CREATE TABLE IF NOT EXISTS styles (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    prompt      text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS style_images (
    id          text PRIMARY KEY,
    style_id    text NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
    image_url   text NOT NULL,
    kind        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_images_style_id
    ON style_images (style_id);


-- 5. Dataset items: flattened dataset entries
CREATE TABLE IF NOT EXISTS dataset_items (
    id               text PRIMARY KEY,
    collection       text NOT NULL,
    image_url        text NOT NULL,
    prompt_text      text,
    system_keywords  text,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_items_collection
    ON dataset_items (collection, created_at DESC);
