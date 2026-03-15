import fs from 'fs';
import net from 'net';
import mongoose from 'mongoose';
import { resolveMongoConfig } from '../config/mongo';

declare global {
  // eslint-disable-next-line no-var
  var __lemonStudioMongoPromise: Promise<typeof mongoose> | undefined;
}

const MONGO_CONNECT_TIMEOUT_MS = 5000;
const CONSUL_SOCKET_PATH = '/opt/tmp/sock/consul.sock';
const LOCAL_CONSUL_AGENT_HOST = '127.0.0.1';
const LOCAL_CONSUL_AGENT_PORT = 2280;
const LOCAL_CONSUL_AGENT_TIMEOUT_MS = 200;

function hasInternalDiscoveryEnv() {
  return Boolean(
    process.env.CONSUL_HTTP_HOST ||
    process.env.ROUTE_IP ||
    process.env.MY_HOST_IP ||
    process.env.TCE_HOST_IP ||
    process.env.MY_HOST_IPV6 ||
    process.env.SERVICE_MESH_MONGO_ADDR
  );
}

function requiresConsulDiscovery(uri: string) {
  return uri.startsWith('mongodb+consul://') || uri.startsWith('mongodb+consul+token://');
}

function hasBytedSdUdsSocket() {
  const socketPath = process.env.BYTED_SD_UDS_PATH?.trim();
  return Boolean(socketPath && fs.existsSync(socketPath));
}

function canConnectToLocalConsulAgent(timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({
      host: LOCAL_CONSUL_AGENT_HOST,
      port: LOCAL_CONSUL_AGENT_PORT,
    });

    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function canAttemptInternalDiscovery() {
  if (hasInternalDiscoveryEnv()) return true;
  if (fs.existsSync(CONSUL_SOCKET_PATH)) return true;
  if (hasBytedSdUdsSocket()) return true;
  return canConnectToLocalConsulAgent(LOCAL_CONSUL_AGENT_TIMEOUT_MS);
}

export async function connectMongo(): Promise<typeof mongoose> {
  const { uri, dbName } = resolveMongoConfig();

  if (
    requiresConsulDiscovery(uri) &&
    !(await canAttemptInternalDiscovery())
  ) {
    throw new Error(
      `[MongoConfig] ${uri.split('://')[0]} requires internal service discovery. Provide a Consul agent via CONSUL_HTTP_HOST (or another supported internal discovery env var), mount ${CONSUL_SOCKET_PATH}, or set BYTED_SD_UDS_PATH before starting the Next server.`
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!globalThis.__lemonStudioMongoPromise) {
    const connectPromise = mongoose.connect(uri, {
      dbName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<typeof mongoose>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `[MongoConfig] Timed out after ${MONGO_CONNECT_TIMEOUT_MS}ms while connecting to MongoDB.`
          )
        );
      }, MONGO_CONNECT_TIMEOUT_MS);
    });

    // Keep the underlying connect promise observed even if the timeout wins first.
    connectPromise.catch(() => undefined);

    globalThis.__lemonStudioMongoPromise = Promise.race([
      connectPromise,
      timeoutPromise,
    ]).finally(() => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }).catch(async (error) => {
      globalThis.__lemonStudioMongoPromise = undefined;

      if (
        typeof error?.message === 'string' &&
        error.message.includes('Cannot find consul host') &&
        !(await canAttemptInternalDiscovery())
      ) {
        throw new Error(
          `${error.message}. Provide a Consul agent via CONSUL_HTTP_HOST, mount ${CONSUL_SOCKET_PATH}, or set BYTED_SD_UDS_PATH before starting the Next server.`
        );
      }

      if (error instanceof Error && error.message.includes('Timed out')) {
        await mongoose.disconnect().catch(() => undefined);
      }

      throw error;
    });
  }

  return globalThis.__lemonStudioMongoPromise;
}

export function getMongoose() {
  return mongoose;
}
