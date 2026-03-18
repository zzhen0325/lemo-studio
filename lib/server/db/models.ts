import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Get the Supabase client
function getClient(): SupabaseClient {
  return getSupabaseClient();
}

// Helper to generate UUID
export function generateId(): string {
  return randomUUID();
}

// ==========================================
// Query Builder for Mongoose-like interface
// ==========================================

interface QueryBuilder<T> {
  _filter: Record<string, unknown>;
  _sort: Record<string, 1 | -1>;
  _skip?: number;
  _limit?: number;
  _select?: string;
  _table: string;
  _client: SupabaseClient;
  _single: boolean;
}

function createQuery<T>(table: string, client: SupabaseClient): QueryBuilder<T> {
  return {
    _filter: {},
    _sort: {},
    _table: table,
    _client: client,
    _single: false,
  };
}

async function executeQuery<T>(qb: QueryBuilder<T>): Promise<T[]> {
  let query = qb._client.from(qb._table).select(qb._select || '*');
  
  // Apply filters
  for (const [key, value] of Object.entries(qb._filter)) {
    if (value !== undefined && value !== null) {
      if (key === '_id') {
        query = query.eq('id', value as string);
      } else {
        query = query.eq(key, value);
      }
    }
  }
  
  // Apply sort
  for (const [field, order] of Object.entries(qb._sort)) {
    query = query.order(field, { ascending: order === 1 });
  }
  
  // Apply pagination
  if (qb._skip !== undefined && qb._limit !== undefined) {
    query = query.range(qb._skip, qb._skip + qb._limit - 1);
  } else if (qb._limit !== undefined) {
    query = query.limit(qb._limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data as T[]) || [];
}

async function executeSingle<T>(qb: QueryBuilder<T>): Promise<T | null> {
  let query = qb._client.from(qb._table).select(qb._select || '*');
  
  for (const [key, value] of Object.entries(qb._filter)) {
    if (value !== undefined && value !== null) {
      if (key === '_id') {
        query = query.eq('id', value as string);
      } else {
        query = query.eq(key, value);
      }
    }
  }
  
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

// Create a query object with chainable methods
function createQueryable<T>(qb: QueryBuilder<T>): any {
  const promise = qb._single ? executeSingle<T>(qb) : executeQuery<T>(qb);
  
  // Add chainable methods
  (promise as any).lean = () => createQueryable(qb);
  (promise as any).sort = (sortObj: Record<string, 1 | -1>) => {
    Object.assign(qb._sort, sortObj);
    return createQueryable(qb);
  };
  (promise as any).select = (fields: string) => {
    qb._select = fields;
    return createQueryable(qb);
  };
  (promise as any).skip = (n: number) => {
    qb._skip = n;
    return createQueryable(qb);
  };
  (promise as any).limit = (n: number) => {
    qb._limit = n;
    return createQueryable(qb);
  };
  (promise as any).exec = () => qb._single ? executeSingle<T>(qb) : executeQuery<T>(qb);
  
  return promise;
}

// Helper to extract $set from update
function extractUpdateData(update: any): Record<string, unknown> {
  if (update && typeof update === 'object' && '$set' in update) {
    return update.$set as Record<string, unknown>;
  }
  return update as Record<string, unknown>;
}

// ==========================================
// Generations Model
// ==========================================
export interface GenerationDoc {
  id: string;
  status?: 'pending' | 'completed' | 'failed';
  progress?: number;
  progress_stage?: string;
  user_id?: string;
  project_id?: string;
  llm_response?: string;
  output_image_id?: string;
  source_image_id?: string;
  output_url?: string;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const GenerationModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<GenerationDoc>('generations', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<GenerationDoc>('generations', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<GenerationDoc | null> {
    const { data, error } = await getClient()
      .from('generations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as GenerationDoc | null;
  },

  async create(doc: Partial<GenerationDoc>): Promise<GenerationDoc> {
    const { data, error } = await getClient()
      .from('generations')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as GenerationDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      // Try to find first
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    let query = getClient().from('generations').update(updateData);
    if (id) {
      query = query.eq('id', id as string);
    } else {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && value !== null && key !== '_id') {
          query = query.eq(key, value);
        }
      }
    }
    const { error } = await query;
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async updateMany(filter: Record<string, unknown>, update: any): Promise<void> {
    const updateData = extractUpdateData(update);
    let query = getClient().from('generations').update(updateData);
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { error } = await query;
    if (error) throw error;
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    if (id) {
      const { error } = await getClient().from('generations').delete().eq('id', id as string);
      if (error) throw error;
    }
  },

  async deleteMany(filter: Record<string, unknown>): Promise<void> {
    let query = getClient().from('generations').delete();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { error } = await query;
    if (error) throw error;
  },

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    let query = getClient().from('generations').select('*', { count: 'exact', head: true });
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async estimatedDocumentCount(): Promise<number> {
    const { count, error } = await getClient()
      .from('generations')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },

  async findWithPagination(
    filter: Record<string, unknown>,
    options: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number; select?: string }
  ): Promise<GenerationDoc[]> {
    let query = getClient().from('generations').select(options.select || '*');
    
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        if (key === '_id') {
          query = query.eq('id', value as string);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    if (options.sort) {
      for (const [field, order] of Object.entries(options.sort)) {
        query = query.order(field, { ascending: order === 1 });
      }
    }

    if (options.skip !== undefined && options.limit !== undefined) {
      query = query.range(options.skip, options.skip + options.limit - 1);
    } else if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data || []) as unknown) as GenerationDoc[];
  },

  async insertMany(docs: Array<Partial<GenerationDoc>>): Promise<GenerationDoc[]> {
    const { data, error } = await getClient()
      .from('generations')
      .insert(docs as Record<string, unknown>[])
      .select();
    if (error) throw error;
    return (data as GenerationDoc[]) || [];
  },

  async findOneAndUpdate(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean; new?: boolean }): Promise<GenerationDoc | null> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        return await this.create({ ...updateData, id: id as string });
      }
    }
    
    let query = getClient().from('generations').update(updateData);
    if (id) {
      query = query.eq('id', id as string);
    } else {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && value !== null && key !== '_id') {
          query = query.eq(key, value);
        }
      }
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data as GenerationDoc;
  },

  async bulkWrite(operations: any[]): Promise<{ modifiedCount?: number }> {
    // Simplified bulkWrite - just execute each operation
    for (const op of operations) {
      if (op.updateOne) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
      } else if (op.deleteOne) {
        await this.deleteOne(op.deleteOne.filter);
      }
    }
    return { modifiedCount: operations.length };
  },

  collection: { name: 'generations' },
};

// ==========================================
// Image Assets Model
// ==========================================
export interface ImageAssetDoc {
  id: string;
  url: string;
  dir: string;
  file_name: string;
  fileName?: string; // camelCase alias
  region: string;
  type: 'generation' | 'reference' | 'dataset' | 'upload';
  project_id?: string;
  generation_id?: string;
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const ImageAssetModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<ImageAssetDoc>('image_assets', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<ImageAssetDoc>('image_assets', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<ImageAssetDoc | null> {
    const { data, error } = await getClient()
      .from('image_assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as ImageAssetDoc | null;
  },

  async create(doc: Partial<ImageAssetDoc>): Promise<ImageAssetDoc> {
    // Normalize fileName to file_name
    const normalizedDoc = { ...doc };
    if (normalizedDoc.fileName) {
      (normalizedDoc as any).file_name = normalizedDoc.fileName;
      delete normalizedDoc.fileName;
    }
    
    const { data, error } = await getClient()
      .from('image_assets')
      .insert(normalizedDoc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as ImageAssetDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any): Promise<void> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    const { error } = await getClient()
      .from('image_assets')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('image_assets').delete().eq('id', id as string);
    if (error) throw error;
  },

  async deleteMany(filter: Record<string, unknown>): Promise<void> {
    let query = getClient().from('image_assets').delete();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { error } = await query;
    if (error) throw error;
  },

  async insertMany(docs: Array<Partial<ImageAssetDoc>>): Promise<ImageAssetDoc[]> {
    const { data, error } = await getClient()
      .from('image_assets')
      .insert(docs as Record<string, unknown>[])
      .select();
    if (error) throw error;
    return (data as ImageAssetDoc[]) || [];
  },

  collection: { name: 'image_assets' },
};

// ==========================================
// Presets Model
// ==========================================
export interface PresetDoc {
  id: string;
  name: string;
  cover_url?: string;
  cover_data?: string;
  config?: Record<string, unknown>;
  edit_config?: Record<string, unknown>;
  category?: string;
  project_id?: string;
  type?: 'generation' | 'edit';
  created_at?: string;
  updated_at?: string;
}

export const PresetModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<PresetDoc>('presets', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<PresetDoc>('presets', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<PresetDoc | null> {
    const { data, error } = await getClient()
      .from('presets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as PresetDoc | null;
  },

  async create(doc: Partial<PresetDoc>): Promise<PresetDoc> {
    const { data, error } = await getClient()
      .from('presets')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as PresetDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('presets')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('presets').delete().eq('id', id as string);
    if (error) throw error;
  },

  async findOneAndUpdate(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean; new?: boolean }): Promise<PresetDoc | null> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        return await this.create({ ...updateData, id: id as string });
      }
    }
    
    const { data, error } = await getClient()
      .from('presets')
      .update(updateData)
      .eq('id', id as string)
      .select()
      .single();
    if (error) throw error;
    return data as PresetDoc;
  },

  collection: { name: 'presets' },
};

// ==========================================
// Preset Categories Model
// ==========================================
export interface PresetCategoryDoc {
  id: number;
  key: string;
  categories?: string[];
  created_at?: string;
  updated_at?: string;
}

export const PresetCategoryModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<PresetCategoryDoc>('preset_categories', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<PresetCategoryDoc>('preset_categories', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async create(doc: Partial<PresetCategoryDoc>): Promise<PresetCategoryDoc> {
    const { data, error } = await getClient()
      .from('preset_categories')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as PresetCategoryDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create(updateData as Partial<PresetCategoryDoc>);
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('preset_categories')
      .update(updateData)
      .eq('key', filter.key as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  collection: { name: 'preset_categories' },
};

// ==========================================
// Style Stacks Model
// ==========================================
export interface StyleStackDoc {
  id: string;
  name: string;
  prompt: string;
  image_paths?: string[];
  preview_urls?: string[];
  collage_image_url?: string;
  collage_config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const StyleStackModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<StyleStackDoc>('style_stacks', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<StyleStackDoc>('style_stacks', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<StyleStackDoc | null> {
    const { data, error } = await getClient()
      .from('style_stacks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as StyleStackDoc | null;
  },

  async create(doc: Partial<StyleStackDoc>): Promise<StyleStackDoc> {
    const { data, error } = await getClient()
      .from('style_stacks')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as StyleStackDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('style_stacks')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('style_stacks').delete().eq('id', id as string);
    if (error) throw error;
  },

  collection: { name: 'style_stacks' },
};

// ==========================================
// Tool Presets Model
// ==========================================
export interface ToolPresetDoc {
  id: string;
  tool_id: string;
  name: string;
  values?: Record<string, unknown>;
  thumbnail?: string;
  timestamp?: number;
  created_at?: string;
  updated_at?: string;
}

export const ToolPresetModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<ToolPresetDoc>('tool_presets', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<ToolPresetDoc>('tool_presets', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<ToolPresetDoc | null> {
    const { data, error } = await getClient()
      .from('tool_presets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as ToolPresetDoc | null;
  },

  async create(doc: Partial<ToolPresetDoc>): Promise<ToolPresetDoc> {
    const { data, error } = await getClient()
      .from('tool_presets')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as ToolPresetDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('tool_presets')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('tool_presets').delete().eq('id', id as string);
    if (error) throw error;
  },

  collection: { name: 'tool_presets' },
};

// ==========================================
// Dataset Entry Model
// ==========================================
export interface DatasetEntryDoc {
  id: string;
  collection_name: string;
  collectionName?: string; // camelCase alias
  file_name: string;
  url: string;
  prompt?: string;
  promptZh?: string;
  promptEn?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const DatasetEntryModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<DatasetEntryDoc>('dataset_entries', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<DatasetEntryDoc>('dataset_entries', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async create(doc: Partial<DatasetEntryDoc>): Promise<DatasetEntryDoc> {
    // Normalize camelCase to snake_case
    const normalizedDoc: Record<string, unknown> = { ...doc } as Record<string, unknown>;
    if (normalizedDoc.collectionName) {
      normalizedDoc.collection_name = normalizedDoc.collectionName;
      delete normalizedDoc.collectionName;
    }
    
    const { data, error } = await getClient()
      .from('dataset_entries')
      .insert(normalizedDoc)
      .select()
      .single();
    if (error) throw error;
    return data as DatasetEntryDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('dataset_entries')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('dataset_entries').delete().eq('id', id as string);
    if (error) throw error;
  },

  async deleteMany(filter: Record<string, unknown>): Promise<void> {
    let query = getClient().from('dataset_entries').delete();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { error } = await query;
    if (error) throw error;
  },

  async updateMany(filter: Record<string, unknown>, update: any): Promise<void> {
    const updateData = extractUpdateData(update);
    let query = getClient().from('dataset_entries').update(updateData);
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { error } = await query;
    if (error) throw error;
  },

  async insertMany(docs: Array<Partial<DatasetEntryDoc>>): Promise<DatasetEntryDoc[]> {
    const { data, error } = await getClient()
      .from('dataset_entries')
      .insert(docs as Record<string, unknown>[])
      .select();
    if (error) throw error;
    return (data as DatasetEntryDoc[]) || [];
  },

  collection: { name: 'dataset_entries' },
};

// ==========================================
// Dataset Collection Model
// ==========================================
export interface DatasetCollectionDoc {
  id: string;
  name: string;
  count?: number;
  systemPrompt?: string;
  created_at?: string;
  updated_at?: string;
}

export const DatasetCollectionModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<DatasetCollectionDoc>('dataset_collections', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<DatasetCollectionDoc>('dataset_collections', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async create(doc: Partial<DatasetCollectionDoc>): Promise<DatasetCollectionDoc> {
    const { data, error } = await getClient()
      .from('dataset_collections')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as DatasetCollectionDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('dataset_collections')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  collection: { name: 'dataset_collections' },
};

// ==========================================
// User Model
// ==========================================
export interface UserDoc {
  id: string;
  display_name?: string;
  password?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const UserModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<UserDoc>('users', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<UserDoc>('users', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<UserDoc | null> {
    const { data, error } = await getClient()
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as UserDoc | null;
  },

  async create(doc: Partial<UserDoc>): Promise<UserDoc> {
    const { data, error } = await getClient()
      .from('users')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as UserDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: Partial<UserDoc>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient()
      .from('users')
      .update(update as Record<string, unknown>)
      .eq('id', id as string);
    if (error) throw error;
  },

  collection: { name: 'users' },
};

// ==========================================
// Infinite Canvas Project Model
// ==========================================
export interface InfiniteCanvasProjectDoc {
  id: string;
  name?: string;
  projectId?: string; // camelCase alias
  user_id?: string;
  data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const InfiniteCanvasProjectModel = {
  find(filter: Record<string, unknown> = {}): any {
    const qb = createQuery<InfiniteCanvasProjectDoc>('infinite_canvas_projects', getClient());
    qb._filter = { ...filter };
    return createQueryable(qb);
  },

  findOne(filter: Record<string, unknown>): any {
    const qb = createQuery<InfiniteCanvasProjectDoc>('infinite_canvas_projects', getClient());
    qb._filter = { ...filter };
    qb._single = true;
    return createQueryable(qb);
  },

  async findById(id: string): Promise<InfiniteCanvasProjectDoc | null> {
    const { data, error } = await getClient()
      .from('infinite_canvas_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as InfiniteCanvasProjectDoc | null;
  },

  async create(doc: Partial<InfiniteCanvasProjectDoc>): Promise<InfiniteCanvasProjectDoc> {
    const { data, error } = await getClient()
      .from('infinite_canvas_projects')
      .insert(doc as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as InfiniteCanvasProjectDoc;
  },

  async updateOne(filter: Record<string, unknown>, update: any, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }> {
    const updateData = extractUpdateData(update);
    const id = filter.id || filter._id || filter.projectId;
    
    if (options?.upsert) {
      const existing = await this.findOne(filter);
      if (!existing) {
        await this.create({ ...updateData, id: id as string });
        return { modifiedCount: 1 };
      }
    }
    
    const { error } = await getClient()
      .from('infinite_canvas_projects')
      .update(updateData)
      .eq('id', id as string);
    if (error) throw error;
    return { modifiedCount: 1 };
  },

  async deleteOne(filter: Record<string, unknown>): Promise<void> {
    const id = filter.id || filter._id;
    const { error } = await getClient().from('infinite_canvas_projects').delete().eq('id', id as string);
    if (error) throw error;
  },

  async estimatedDocumentCount(): Promise<number> {
    const { count, error } = await getClient()
      .from('infinite_canvas_projects')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },

  async bulkWrite(operations: any[], _options?: { ordered?: boolean }): Promise<{ modifiedCount?: number }> {
    for (const op of operations) {
      if (op.updateOne) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
      } else if (op.deleteOne) {
        await this.deleteOne(op.deleteOne.filter);
      }
    }
    return { modifiedCount: operations.length };
  },

  collection: { name: 'infinite_canvas_projects' },
};

// ==========================================
// Legacy type aliases for backward compatibility
// ==========================================

// Type aliases matching the old Typegoose class names
export type Generation = GenerationDoc;
export type ImageAsset = ImageAssetDoc;
export type Preset = PresetDoc;
export type PresetCategory = PresetCategoryDoc;
export type StyleStack = StyleStackDoc;
export type ToolPreset = ToolPresetDoc;
export type DatasetEntry = DatasetEntryDoc;
export type DatasetCollection = DatasetCollectionDoc;
export type User = UserDoc;
export type InfiniteCanvasProject = InfiniteCanvasProjectDoc;

// Model aliases for DI token compatibility
export const Generation = GenerationModel;
export const ImageAsset = ImageAssetModel;
export const Preset = PresetModel;
export const PresetCategory = PresetCategoryModel;
export const StyleStack = StyleStackModel;
export const ToolPreset = ToolPresetModel;
export const DatasetEntry = DatasetEntryModel;
export const DatasetCollection = DatasetCollectionModel;
export const User = UserModel;
export const InfiniteCanvasProject = InfiniteCanvasProjectModel;
