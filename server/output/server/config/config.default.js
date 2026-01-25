"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/ban-ts-comment */
const path_1 = __importDefault(require("path"));
const global_exception_1 = __importDefault(require("../middleware/global-exception"));
const cors_1 = __importDefault(require("../middleware/cors"));
// 约定：GuluX 服务从 server/ 目录启动，这里将 cwd 提升到仓库根目录，
// 以保持与 Next 应用中 process.cwd() 的语义一致（指向 lemo-AI-studio 根目录）。
const workspaceRoot = path_1.default.join(process.cwd(), "..");
if (process.cwd() !== workspaceRoot) {
    process.chdir(workspaceRoot);
}
// 加载 .env.local 环境变量（模拟 Next.js 行为）
const fs_1 = __importDefault(require("fs"));
const envLocalPath = path_1.default.join(process.cwd(), ".env.local");
if (fs_1.default.existsSync(envLocalPath)) {
    const envContent = fs_1.default.readFileSync(envLocalPath, "utf8");
    envContent.split("\n").forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("#")) {
            const firstEqIndex = trimmedLine.indexOf("=");
            if (firstEqIndex !== -1) {
                const key = trimmedLine.substring(0, firstEqIndex).trim();
                const value = trimmedLine.substring(firstEqIndex + 1).trim().replace(/^['"](.*)['"]$/, "$1");
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    });
}
const config = {
    name: "lemo-ai-studio-server",
    middleware: [cors_1.default, global_exception_1.default],
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
                uri: process.env.MONGODB_URI ||
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
exports.default = config;
