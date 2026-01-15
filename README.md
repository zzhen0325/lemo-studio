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
    - `true`：继续使用现有本地存储逻辑（写入 `public/outputs`、`public/upload` 等）。
    - `false` 或未设置：启用新的 **CDN 上传 + Supabase 写入** 路径（读取逻辑将在后续阶段逐步迁移）。

> 建议在本地开发环境创建 `.env.local` 或 `.env` 文件，并在部署环境（如 Vercel、自建服务器）中通过环境变量面板配置以上字段。
