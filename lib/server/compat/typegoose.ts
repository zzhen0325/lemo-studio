// Typegoose compatibility layer - now using Supabase instead of Mongoose

// Dummy decorator functions for backward compatibility
export function Database(name: string) {
  void name;
  return function decorator(target: unknown) {
    void target;
    return undefined;
  };
}

export function index() {
  return function decorator(target: unknown) {
    void target;
    return undefined;
  };
}

export function modelOptions(options: unknown) {
  void options;
  return function decorator(target: unknown) {
    void target;
    return undefined;
  };
}

export function Prop(options?: unknown) {
  void options;
  return function decorator(target: unknown, propertyKey: string | symbol) {
    void target;
    void propertyKey;
  };
}

export function setGlobalOptions(options: unknown) {
  void options;
}

export const Severity = {
  ALLOW: 0,
  WARN: 1,
  ERROR: 2,
};

// Update operation type
export type UpdateOp<T> = Partial<T> | { $set?: Partial<T>; $push?: Partial<T>; $pull?: Partial<T> };

// Bulk write operation type
export type BulkWriteOp<T> = 
  | { updateOne: { filter: Record<string, unknown>; update: UpdateOp<T>; upsert?: boolean } }
  | { deleteOne: { filter: Record<string, unknown> } };

// Extended model type to match Mongoose-like interface used by services
export type ModelType<T> = {
  new (): T;
  find(filter?: Record<string, unknown>): Query<T[]>;
  findOne(filter: Record<string, unknown>): Query<T | null>;
  findById(id: string): Query<T | null>;
  create(doc: Partial<T>): Promise<T>;
  updateOne(filter: Record<string, unknown>, update: UpdateOp<T>, options?: { upsert?: boolean }): Promise<{ modifiedCount?: number }>;
  updateMany(filter: Record<string, unknown>, update: UpdateOp<T>): Promise<void>;
  deleteOne(filter: Record<string, unknown>): Promise<void>;
  deleteMany(filter: Record<string, unknown>): Promise<void>;
  countDocuments(filter?: Record<string, unknown>): Promise<number>;
  estimatedDocumentCount(): Promise<number>;
  bulkWrite(operations: BulkWriteOp<T>[]): Promise<{ modifiedCount?: number }>;
  insertMany(docs: Array<Partial<T>>): Promise<T[]>;
  findOneAndUpdate(filter: Record<string, unknown>, update: UpdateOp<T>, options?: { upsert?: boolean; new?: boolean }): Promise<T | null>;
  collection?: { name: string };
  aggregate?: (pipeline: unknown[]) => Promise<unknown[]>;
};

// Query type that supports chaining methods like .lean(), .sort()
export interface Query<T> extends Promise<T> {
  lean(): Query<T>;
  sort(sortObj: Record<string, 1 | -1>): Query<T>;
  select(fields: string): Query<T>;
  skip(n: number): Query<T>;
  limit(n: number): Query<T>;
  exec(): Promise<T>;
}

// Ref type for references
export type Ref<T> = T | string | null;
