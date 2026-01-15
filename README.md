# Lemo AI Studio

This is a starter template for [Learn Next.js](https://nextjs.org/learn).

## 环境变量配置

项目在接入 CDN 上传与 Supabase Postgres 后，需要在运行环境中配置以下环境变量：

### CDN 相关

- `CDN_BASE_URL` （必填）
  - 说明：CDN 上传接口的基础域名。
  - 推荐值：`https://ife-cdn.byteintl.net`
- `CDN_REGION` （必填）
  - 说明：CDN 上传的区域标识。
  - 推荐值：`SG`
- `CDN_DIR` （必填）
  - 说明：CDN 上传的目录（包含团队空间前缀）。
  - 推荐值：`ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design`
- `CDN_EMAIL` （必填）
  - 说明：用于上传鉴权与日志记录的邮箱。
  - 推荐值：`zzhen.0325@bytedance.com`
- `CDN_TOKEN` （可选）
  - 说明：当团队空间开启加密时，需要在请求头中携带的 Token，对应 header：`x-cdn-token`。
  - 未加密空间可以不配置。

### 数据库相关

- `DATABASE_URL` （必填）
  - 说明：Supabase Postgres 连接字符串，用于历史记录、预设、风格、数据集等结构化数据的读写。
  - 示例：`postgresql://<user>:<password>@<host>:5432/postgres`

### 存储模式开关

- `USE_LOCAL_STORAGE` （可选，默认 `false`）
  - 说明：控制是否仍使用本地文件系统进行读写，作为兼容/回退模式。
  - 取值：
    - `true`：继续使用现有本地存储逻辑（历史记录 / 预设 / 数据集 等接口读写均基于本地文件系统，例如 `public/outputs`、`public/upload`、`public/dataset`）。
    - `false` 或未设置：历史记录 / 预设 / 数据集 等接口的读写会优先走 **CDN 上传 + Supabase Postgres**，若数据库查询异常则自动回退到本地读取逻辑。

> 建议在本地开发环境创建 `.env.local` 或 `.env` 文件，并在部署环境（如 Vercel、自建服务器）中通过环境变量面板配置以上字段。

## 测试：CDN 上传验证

在本地可以使用仓库内提供的脚本，对 CDN 上传接口进行最小可行验证，并将结果写入 `scripts/cdn-upload-test.log`。

### 前置准备

1. 在项目根目录配置好环境变量（见上文“环境变量配置”），至少包括：
   - `CDN_BASE_URL`（未配置时默认为 `https://ife-cdn.byteintl.net`）
   - `CDN_REGION=SG`
   - `CDN_DIR=ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design`
   - `CDN_EMAIL=zzhen.0325@bytedance.com`
   - 可选：`CDN_TOKEN=<团队空间加密 Token>`（若团队空间已加密）。

### 使用 curl 版脚本

1. 在仓库根目录执行：`bash scripts/cdn-upload-test.sh`。
2. 脚本会自动选择测试图片：优先使用 `public/images/logos/logo.png`，若不存在则回退为 `public/1/*.png` 中的首个文件。
3. 脚本调用 `${CDN_BASE_URL}/cdn/upload` 进行上传，并在终端和 `scripts/cdn-upload-test.log` 中输出结果：
   - 成功（HTTP 200 且 `code = 0`）时，日志中会包含形如 `[...][SUCCESS] cdnUrl=...` 的行，其中的 `cdnUrl` 即为后续业务可直接使用的图片地址。
   - 失败时，日志会记录完整响应体以及错误分类，例如：
     - `TEAM_SPACE_ENCRYPTED_NEED_TOKEN`：团队空间已加密，需要在环境中配置 `CDN_TOKEN` 后重试；
     - `NETWORK_RESTRICTED` 或 `HTTP_ERROR_OR_NETWORK`：可能为网络访问受限、证书或代理问题，可在本地尝试直接访问 `https://ife-cdn.byteintl.net` 进行排查。

### 使用 Node 版脚本

1. 当 curl 由于网络、证书或运行环境限制无法验证成功时，可以尝试 Node 版脚本：`npx ts-node scripts/cdn-upload-test.ts`（需要本地 Node.js 18+，并安装或通过 npx 获取 ts-node 等运行器）。
2. Node 版脚本使用与 curl 版相同的环境变量与测试图片，并将结果附加写入同一个 `scripts/cdn-upload-test.log` 日志文件，成功时会额外标记一行 `CDN_URL_MARKER <cdnUrl>` 便于快速检索。
