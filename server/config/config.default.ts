/* eslint-disable @typescript-eslint/ban-ts-comment */
import path from "path";
import { ApplicationConfig } from "@gulux/gulux";
import GlobalExceptionMiddleware from "../middleware/global-exception";
import CorsMiddleware from "../middleware/cors";

// 约定：GuluX 服务从 server/ 目录启动，这里将 cwd 提升到仓库根目录，
// 以保持与 Next 应用中 process.cwd() 的语义一致（指向 lemo-AI-studio 根目录）。
const workspaceRoot = path.join(process.cwd(), "..");
if (process.cwd() !== workspaceRoot) {
  process.chdir(workspaceRoot);
}

const config: ApplicationConfig = {
  name: "lemo-ai-studio-server",
  middleware: [CorsMiddleware, GlobalExceptionMiddleware],
  applicationHttp: {
    port: Number(process.env.PORT) || 3000,
    routerPrefix: "/api",
  },
  typegoose: {
    clients: {
      default: {
        uri:
          process.env.MONGODB_URI ||
          "mongodb+consul+token://bytedance.bytedoc.lemon8_design_aigc/lemon8_design_aigc?connectTimeoutMS=2000",
        dbName: process.env.MONGODB_DB || "lemon8_design_aigc",
        // @ts-ignore option passthrough to driver
        useNewUrlParser: true,
        // @ts-ignore option passthrough to driver
        useUnifiedTopology: true,
      }
    },
  },
};

export default config;
