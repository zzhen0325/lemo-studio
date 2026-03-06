/* eslint-disable @typescript-eslint/ban-ts-comment */
import path from "path";
import { ApplicationConfig } from "@gulux/gulux";
import GlobalExceptionMiddleware from "../middleware/global-exception";
import CorsMiddleware from "../middleware/cors";
import { resolveMongoConfig } from "./mongo";

// 约定：GuluX 服务通常从 server/ 目录启动；若从仓库根目录启动也能兼容。
const cwd = process.cwd();
const workspaceRoot = cwd.endsWith(`${path.sep}server`) ? path.join(cwd, "..") : cwd;
// if (process.cwd() !== workspaceRoot) {
//   process.chdir(workspaceRoot);
// }

// 加载 .env.local 环境变量（模拟 Next.js 行为）
import fs from "fs";
const envLocalPath = path.join(workspaceRoot, ".env.local");
const forceOverrideEnvKeys = new Set([
  "COMFYUI_API_URL",
  "COMFYUI_SECURE",
  "NEXT_PUBLIC_COMFYUI_URL",
]);
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const firstEqIndex = trimmedLine.indexOf("=");
      if (firstEqIndex !== -1) {
        const key = trimmedLine.substring(0, firstEqIndex).trim();
        const value = trimmedLine.substring(firstEqIndex + 1).trim().replace(/^['"](.*)['"]$/, "$1");
        if (!key) return;
        if (forceOverrideEnvKeys.has(key) || !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}
console.info("[ServerConfig] COMFYUI_API_URL resolved", process.env.COMFYUI_API_URL || "");

const mongoConfig = resolveMongoConfig();
console.info("[MongoConfig] source", mongoConfig.source, "db", mongoConfig.dbName);

const config: ApplicationConfig = {
  name: "lemo-ai-studio-server",
  middleware: [CorsMiddleware, GlobalExceptionMiddleware],
  applicationHttp: {
    port: Number(process.env.PORT) || 3000,
    routerPrefix: "/api",
    bodyParser: {
      jsonLimit: "100mb",
      formLimit: "100mb",
    },
  },
  typegoose: {
    clients: {
      default: {
        uri: mongoConfig.uri,
        dbName: mongoConfig.dbName,
        // @ts-ignore option passthrough to driver
        useNewUrlParser: true,
        // @ts-ignore option passthrough to driver
        useUnifiedTopology: true,
      }
    },
  },
};

export default config;
