import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Database client singleton
let client: SupabaseClient | null = null;

/**
 * Get the Supabase client instance
 */
export function getDb(): SupabaseClient {
  if (!client) {
    client = getSupabaseClient();
  }
  return client;
}

/**
 * Connect to the database (for compatibility with existing code)
 * Supabase doesn't require explicit connection, so this is a no-op
 */
export async function connectMongo(): Promise<void> {
  // Supabase doesn't need explicit connection
  // Just ensure the client is initialized
  getDb();
}

// Alias for backward compatibility
export const connectDb = connectMongo;

/**
 * Check if the database is connected
 */
export function isConnected(): boolean {
  return client !== null;
}
