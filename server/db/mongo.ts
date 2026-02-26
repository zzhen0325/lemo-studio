import mongoose from 'mongoose';

const DEFAULT_URI =
  'mongodb+consul+token://bytedance.bytedoc.lemon8_design_aigc/lemon8_design_aigc?connectTimeoutMS=2000';

let connecting: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const dbName = process.env.MONGODB_DB || 'lemon8_design_aigc';

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connecting) {
    connecting = mongoose.connect(uri, {
      dbName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
    });
  }

  return connecting;
}

export function getMongoose() {
  return mongoose;
}
