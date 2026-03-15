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

function normalizeMongoUri(uri: string): string {
  if (
    uri.startsWith('mongodb://') ||
    uri.startsWith('mongodb+srv://') ||
    uri.startsWith('mongodb+consul://') ||
    uri.startsWith('mongodb+token://') ||
    uri.startsWith('mongodb+consul+token://')
  ) {
    return uri;
  }

  if (uri.startsWith('mongodb:')) {
    return uri.replace(/^mongodb:\/*/i, 'mongodb://');
  }

  if (uri.startsWith('mongodb+srv:')) {
    return uri.replace(/^mongodb\+srv:\/*/i, 'mongodb+srv://');
  }

  if (uri.startsWith('mongodb+consul:')) {
    return uri.replace(/^mongodb\+consul:\/*/i, 'mongodb+consul://');
  }

  if (uri.startsWith('mongodb+token:')) {
    return uri.replace(/^mongodb\+token:\/*/i, 'mongodb+token://');
  }

  if (uri.startsWith('mongodb+consul+token:')) {
    return uri.replace(/^mongodb\+consul\+token:\/*/i, 'mongodb+consul+token://');
  }

  const explicitScheme = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1];
  if (explicitScheme) {
    throw new Error(
      `[MongoConfig] Unsupported MONGODB_URI scheme "${explicitScheme}". Expected a MongoDB connection string such as "mongodb://", "mongodb+srv://", or the supported internal Byted Mongo schemes.`
    );
  }

  return `mongodb://${uri.replace(/^\/+/, '')}`;
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
    const normalizedUri = normalizeMongoUri(envUri);
    return {
      uri: normalizedUri,
      dbName: envDbName || inferDbNameFromUri(normalizedUri) || DEFAULT_LOCAL_MONGO_DB,
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
