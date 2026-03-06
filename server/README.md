# Lemo AI Studio GuluX 后端

这是基于 GuluX 的后端服务，用于承接原先 Next.js `app/api/**` 路由的全部 API。

## 启动方式

在仓库根目录下：

```bash
cd server
# 安装依赖（示例，实际请使用公司内推荐的包管理与 registry）
# bnpm install 或 npm install

# 开发模式（默认端口 3000，路由前缀 /api）
npm run dev

# 生产构建
npm run build

# 生产启动
npm start
```

> 约定：服务从 `server/` 目录启动时，会将 `process.cwd()` 切换到仓库根目录，以保证文件读写路径与原 Next.js 实现一致（例如 `public/**`、`data/api-config/**` 等）。

## 关键环境变量

- `MONGODB_URI` / `MONGODB_DB`：MongoDB 连接配置。
  - 生产部署必须显式提供 `MONGODB_URI`，服务不会再回退到内置默认库。
  - 若 URI 本身不带库名，也请同时提供 `MONGODB_DB`。
- `API_CONFIG_ENCRYPTION_KEY`：用于加密 `api-config` 中保存的 `apiKey`。  
  - 建议使用 32 字节随机密钥（base64 / base64url / hex 均可）。
  - 未设置时，系统保持明文兼容模式（仅返回值脱敏）。
