import mongoose from 'mongoose';
import { resolveMongoConfig } from '../config/mongo';

let connecting: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  const { uri, dbName } = resolveMongoConfig();

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
