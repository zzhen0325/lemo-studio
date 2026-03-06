const DEFAULT_LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/gulux';
const DEFAULT_LOCAL_MONGO_DB = 'gulux';

export type ResolvedMongoConfig = {
  uri: string;
  dbName: string;
  source: 'env' | 'local-default';
};

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function inferDbNameFromUri(uri: string): string | undefined {
  const match = uri.match(/^[^/]+\/\/[^/]+\/([^?]+)/);
  const dbName = match?.[1]?.trim();
  return dbName ? decodeURIComponent(dbName) : undefined;
}

export function resolveMongoConfig(): ResolvedMongoConfig {
  const envUri = normalizeEnvValue(process.env.MONGODB_URI);
  const envDbName = normalizeEnvValue(process.env.MONGODB_DB);

  if (envUri) {
    return {
      uri: envUri,
      dbName: envDbName || inferDbNameFromUri(envUri) || DEFAULT_LOCAL_MONGO_DB,
      source: 'env',
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[MongoConfig] MONGODB_URI is required in production. Refusing to fall back to the legacy default Mongo URI.'
    );
  }

  return {
    uri: DEFAULT_LOCAL_MONGO_URI,
    dbName: envDbName || DEFAULT_LOCAL_MONGO_DB,
    source: 'local-default',
  };
}
