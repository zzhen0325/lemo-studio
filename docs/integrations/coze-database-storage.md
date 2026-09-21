# Coze 平台数据库与对象存储集成指南

本文档说明 LEMO Studio 项目如何接入 Coze 平台提供的 Supabase 数据库集成和 S3 兼容对象存储集成，包括环境变量配置、核心抽象、使用方式和最佳实践。

---

## 1. 概述

Coze 平台为项目预置了两类核心基础设施集成，无需手动配置连接信息即可使用：

| 集成类型 | 底层服务 | 环境变量自动注入 | 核心抽象位置 |
|---------|---------|----------------|-------------|
| 关系型数据库 | Supabase (PostgreSQL) | `COZE_SUPABASE_URL` / `COZE_SUPABASE_ANON_KEY` | `src/storage/database/supabase-client.ts` + `lib/server/db/models.ts` |
| 对象存储 | S3 兼容 (TOS/火山引擎) | `COZE_BUCKET_ENDPOINT_URL` / `COZE_BUCKET_NAME` / `STORAGE_ACCESS_KEY` | `src/storage/object-storage.ts` |

**核心设计原则：**
- 平台通过 Workload Identity 自动注入环境变量，开发者无需硬编码密钥
- 数据库访问遵循 `route handler -> service -> repository` 三层架构
- 对象存储统一存储 `storageKey`（逻辑键），访问时动态生成预签名 URL
- 数据库字段使用 `snake_case`，Service/Client DTO 使用 `camelCase`

---

## 2. 数据库集成 (Supabase)

### 2.1 环境变量自动加载

Coze 平台通过 Workload Identity 在运行时自动注入 Supabase 连接凭证，客户端实现位于 `src/storage/database/supabase-client.ts`。

**自动加载流程：**
1. 优先读取进程环境变量 `COZE_SUPABASE_URL` 和 `COZE_SUPABASE_ANON_KEY`
2. 若环境变量不存在，自动通过 `coze_workload_identity` Python SDK 拉取项目环境变量
3. 支持本地 `.env` 文件降级（开发环境）

**无需手动配置：** 平台在部署时会自动设置以下环境变量：

```bash
COZE_SUPABASE_URL=<supabase-project-url>
COZE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### 2.2 客户端初始化

```typescript
// src/storage/database/supabase-client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(token?: string): SupabaseClient {
  if (!clientInstance) {
    const url = process.env.COZE_SUPABASE_URL;
    const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.DB_PASSWORD;

    clientInstance = createClient(url, anonKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // 支持传入用户 JWT token 实现行级权限 (RLS)
  if (token) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      // ...
    });
  }

  return clientInstance;
}
```

### 2.3 Model 层：Mongoose-like 查询抽象

为降低从 MongoDB 迁移到 Supabase 的成本，项目在 `lib/server/db/models.ts` 封装了兼容 Mongoose 风格 API 的查询构建器，自动处理 camelCase/snake_case 转换。

**核心能力：**
- 自动 camelCase → snake_case 字段名转换
- 兼容 `_id` → `id` 主键映射
- 链式查询 API：`find().sort().limit().skip()`
- 支持 `findOne`、`updateOne`、`findOneAndUpdate`、`bulkWrite`、`countDocuments`

**创建新 Model 示例：**

```typescript
// lib/server/db/models.ts
// 为 my_entities 表创建 Model
export const MyEntityModel = createModel<MyEntityDoc>('my_entities');

// 类型定义（数据库字段使用 snake_case）
export interface MyEntityDoc {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}
```

### 2.4 Repository 层：数据访问封装

所有持久化逻辑必须通过 Repository 层封装，禁止在 Service 或 Route Handler 中直接操作 Supabase 客户端。

**Repository 规范：**
- 每个业务域一个 Repository 文件，放在 `lib/server/repositories/`
- Repository 输入输出使用 `snake_case`（与数据库字段一致）
- 封装表级查询细节，不暴露通用 `updateOne/deleteOne` 风格接口
- 用户归属过滤必须在 Repository 层实现

**完整 Repository 示例：**

```typescript
// lib/server/repositories/my-entity.repository.ts
import { MyEntityModel, type MyEntityDoc } from '../db/models';

export class MyEntityRepository {
  /**
   * 按用户查询列表
   */
  public async listByOwner(
    ownerId: string,
    options: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> } = {}
  ): Promise<MyEntityDoc[]> {
    return MyEntityModel.findWithPagination(
      { user_id: ownerId },
      {
        sort: options.sort || { created_at: -1 },
        skip: options.skip,
        limit: options.limit,
      }
    );
  }

  /**
   * 查询单个资源（带归属校验）
   */
  public async findOwnedById(id: string, ownerId: string): Promise<MyEntityDoc | null> {
    return MyEntityModel.findOne({ id, user_id: ownerId });
  }

  /**
   * 创建资源
   */
  public async create(doc: Partial<MyEntityDoc> & { id: string; user_id: string }): Promise<MyEntityDoc> {
    return MyEntityModel.create(doc);
  }

  /**
   * 更新资源（带归属校验）
   */
  public async updateOwned(
    id: string,
    ownerId: string,
    update: Partial<MyEntityDoc>
  ): Promise<void> {
    await MyEntityModel.updateOne({ id, user_id: ownerId }, update);
  }

  /**
   * 删除资源（带归属校验）
   */
  public async deleteOwned(id: string, ownerId: string): Promise<void> {
    await MyEntityModel.deleteOne({ id, user_id: ownerId });
  }
}
```

### 2.5 Service 层 DTO 转换

Service 层负责业务逻辑和 DTO 转换，对外暴露 `camelCase` 字段：

```typescript
// lib/server/service/my-entity.service.ts
import { MyEntityRepository } from '../repositories';
import { generateId } from '../db/models';

// Client 侧 DTO 使用 camelCase
export interface MyEntityDTO {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export class MyEntityService {
  constructor(private readonly repo: MyEntityRepository) {}

  public async createEntity(ownerId: string, name: string): Promise<MyEntityDTO> {
    const id = generateId();
    const now = new Date().toISOString();

    // Repository 入参使用 snake_case
    await this.repo.create({
      id,
      user_id: ownerId,
      name,
      created_at: now,
      updated_at: now,
    });

    // 返回 DTO 使用 camelCase
    return {
      id,
      userId: ownerId,
      name,
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

### 2.6 Route Handler 层

API 路由只负责协议转换和 session 解析，不直接操作数据库：

```typescript
// app/api/my-entities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/server/auth/session';
import { MyEntityService } from '@/lib/server/service/my-entity.service';
import { MyEntityRepository } from '@/lib/server/repositories';

export async function GET(request: NextRequest) {
  // 1. 从会话推导用户归属（不信任客户端传入的 userId）
  const actor = await getSessionActor(request);
  const { searchParams } = new URL(request.url);

  // 2. 参数校验
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // 3. 调用 Service
  const service = new MyEntityService(new MyEntityRepository());
  const entities = await service.listByOwner(actor.actorId, { limit });

  // 4. 返回响应（camelCase DTO）
  return NextResponse.json({ data: entities });
}
```

### 2.7 数据库表设计规范

新增数据表时遵循以下规范：

| 字段名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| `id` | UUID / TEXT | 是 | 主键，使用 `randomUUID()` 生成 |
| `user_id` | TEXT | 是 | 归属用户 ID（游客用 actorId） |
| `created_at` | TIMESTAMPTZ | 是 | 创建时间 ISO 字符串 |
| `updated_at` | TIMESTAMPTZ | 是 | 更新时间 ISO 字符串 |
| `project_id` | TEXT | 否 | 关联项目 ID（如适用） |

**建表 SQL 示例：**

```sql
CREATE TABLE my_entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 常用查询索引
CREATE INDEX idx_my_entities_user_id ON my_entities(user_id);
CREATE INDEX idx_my_entities_created_at ON my_entities(created_at DESC);
```

---

## 3. 对象存储集成 (S3 Compatible)

### 3.1 集成说明

Coze 平台提供 S3 兼容的对象存储服务（底层为火山引擎 TOS），通过 `coze-coding-dev-sdk` 封装的 `S3Storage` 类使用，自动处理签名和鉴权。

**自动注入环境变量：**

```bash
COZE_BUCKET_ENDPOINT_URL=<s3-endpoint-url>
COZE_BUCKET_NAME=<bucket-name>
STORAGE_ACCESS_KEY=<access-key>
```

**核心抽象位置：** `src/storage/object-storage.ts`

### 3.2 客户端初始化

采用单例模式，按需初始化：

```typescript
// src/storage/object-storage.ts
import { S3Storage } from 'coze-coding-dev-sdk';

let storageInstance: S3Storage | null = null;

export function getObjectStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: process.env.STORAGE_ACCESS_KEY || '',
      secretKey: '',  // 平台通过 IAM 自动鉴权，无需 secretKey
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storageInstance;
}
```

### 3.3 核心存储 API

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `uploadImageToStorage()` | 上传 Buffer | `buffer, fileName, subdir?, mimeType?` | `storageKey: string` |
| `getFileUrl()` | 生成预签名 URL | `key, expireTime?`（默认 1 天） | `url: string` |
| `uploadDataUrl()` | 上传 base64 DataURL | `dataUrl, subdir?` | `{ key, url }` |
| `uploadFromUrl()` | 从远程 URL 转存 | `url: string` | `key: string` |
| `readFile()` | 读取文件内容 | `key: string` | `Buffer` |
| `deleteFile()` | 删除文件 | `key: string` | `boolean` |
| `fileExists()` | 检查文件存在 | `key: string` | `boolean` |

### 3.4 Storage Key 规范

对象存储中不存储完整 URL，只存储 **storageKey**（逻辑路径），格式为：

```
<目录前缀>/<文件名>
```

**项目现有目录约定：**

| 目录路径 | 用途 |
|---------|------|
| `lemo-studio/outputs/` | AI 生成结果图片 |
| `lemo-studio/upload/` | 用户上传的参考图/素材 |
| `lemo-studio/dataset/` | Dataset 素材库图片 |
| `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/*` | Lemon8 活动专用目录 |

**示例 storageKey：**
```
lemo-studio/outputs/img_1735000000_a1b2c3.png
lemo-studio/upload/参考图_abc123.jpg
```

### 3.5 预签名 URL 机制

**重要：** 所有存储文件通过**预签名 URL** 访问，URL 有效期默认 1 天（86400 秒）。

**工作流程：**
1. 数据库中只存 `storage_key`（永不过期）
2. 响应给前端时，调用 `getFileUrl(storageKey)` 动态生成带签名的临时 URL
3. 前端拿到的 URL 过期后，需要重新调用接口获取新的预签名 URL
4. 提供 `/api/storage/presigned-url` 接口用于前端按需刷新 URL

**生成预签名 URL 示例：**

```typescript
import { getFileUrl } from '@/src/storage/object-storage';

// 生成 1 小时有效的 URL
const url = await getFileUrl('lemo-studio/outputs/img_xxx.png', 3600);
```

### 3.6 上传工具封装（cdn.ts）

项目在 `lib/server/utils/cdn.ts` 封装了更上层的上传工具，自动处理文件名生成和目录：

```typescript
import { uploadBufferToCdn, getSignedUrlForStorageKey } from '@/lib/server/utils/cdn';

// 上传图片 Buffer
const result = await uploadBufferToCdn(buffer, {
  fileName: 'my-image.png',           // 可选，不填自动生成
  dir: 'lemo-studio/outputs',         // 存储目录
  mimeType: 'image/png',              // MIME 类型
  generateSignedUrl: true,            // 是否同时返回预签名 URL
  signedUrlExpireTime: 3600,          // URL 有效期（秒）
});

// 返回值
// {
//   storageKey: 'lemo-studio/outputs/my-image.png',
//   url: 'https://xxx.tos.coze.site/...?sign=xxx',  // 仅 generateSignedUrl=true 时
//   dir: 'lemo-studio/outputs',
//   fileName: 'my-image.png',
// }

// 后续为 storageKey 生成新的签名 URL
const url = await getSignedUrlForStorageKey(result.storageKey, 86400);
```

### 3.7 URL 规范化处理

为兼容历史数据（可能存了完整预签名 URL、本地路径、data URL 等），项目提供 URL 归一化工具：

```typescript
// lib/server/utils/presigned-url.ts
import {
  extractStorageKeyFromUrl,
  isPresignedUrlExpired,
  isTosPresignedUrl,
} from '@/lib/server/utils/presigned-url';
import { getFileUrl } from '@/src/storage/object-storage';

/**
 * 归一化图片 URL：从任意格式的 URL 提取 storageKey，生成新鲜的预签名 URL
 */
export async function normalizeImageUrl(rawUrl: string): Promise<string> {
  // 1. 如果是 data URL，直接返回
  if (rawUrl.startsWith('data:')) return rawUrl;

  // 2. 尝试提取 storageKey
  const storageKey = extractStorageKeyFromUrl(rawUrl);
  if (!storageKey) return rawUrl;

  // 3. 检查原 URL 是否过期，未过期可直接复用
  if (isTosPresignedUrl(rawUrl) && !isPresignedUrlExpired(rawUrl, 3600)) {
    return rawUrl;
  }

  // 4. 生成新的预签名 URL
  return getFileUrl(storageKey, 86400);
}
```

### 3.8 完整上传流程示例

以用户上传参考图为例：

```typescript
// 1. API 路由: app/api/upload/route.ts
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // 2. 调用 Service
  const uploadService = new UploadService(new ImageAssetsRepository());
  const result = await uploadService.upload({
    name: file.name,
    type: file.type,
    arrayBuffer: () => file.arrayBuffer(),
  });

  // 3. 返回结果（storageKey 用于持久化，url 用于前端即时显示）
  return NextResponse.json({
    storageKey: result.storageKey,  // 存到数据库
    url: result.url,                // 临时显示用
  });
}

// 4. UploadService 内部流程（参考 lib/server/service/upload.service.ts）
public async upload(file: UploadedFileLike) {
  // a. 校验文件类型和扩展名
  // b. 读取文件 Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // c. 上传到对象存储，生成预签名 URL
  const cdnRes = await uploadBufferToCdn(buffer, {
    dir: 'lemo-studio/upload',
    generateSignedUrl: true,
  });

  // d. 记录索引到数据库 image_assets 表
  await this.imageAssetsRepository.create({
    storage_key: cdnRes.storageKey,  // 只存 storageKey
    dir: cdnRes.dir,
    fileName: cdnRes.fileName,
    type: 'upload',
  });

  return {
    storageKey: cdnRes.storageKey,
    url: cdnRes.url,
  };
}
```

### 3.9 前端按需刷新预签名 URL

前端发现图片加载失败（URL 过期）时，调用接口刷新：

```typescript
// 前端代码示例
async function refreshImageUrl(storageKey: string): Promise<string> {
  const res = await fetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: storageKey }),
  });
  const data = await res.json();
  return data.url;
}

// 使用方式：img 标签 onerror 时刷新
function ImageWithRefresh({ storageKey, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl);

  const handleError = async () => {
    const newUrl = await refreshImageUrl(storageKey);
    setUrl(newUrl);
  };

  return <img src={url} onError={handleError} alt="" />;
}
```

---

## 4. 与现有业务模块的集成点

### 4.1 现有 Repository 与表映射

| Repository | 数据库表 | 业务模块 |
|-----------|---------|---------|
| `HistoryRepository` | `generations` | 生成历史 / Gallery |
| `DatasetRepository` | `dataset_collections`, `dataset_entries` | 素材库 |
| `InfiniteCanvasRepository` | `infinite_canvas_projects` | 无限画布 |
| `MoodboardCardsRepository` | `moodboard_cards` | 情绪板 |
| `PresetsRepository` | `presets`, `preset_categories` | 预设 |
| `StylesRepository` | `style_stacks` | 风格 |
| `ToolPresetsRepository` | `tool_presets` | 工具预设 |
| `ImageAssetsRepository` | `image_assets` | 图片资产索引 |
| `UsersRepository` | `users` | 用户 |

### 4.2 现有存储目录使用规范

| 业务场景 | 目录路径 | 调用方 |
|---------|---------|-------|
| AI 生成结果 | `lemo-studio/outputs/` | `SaveImageService` |
| 用户上传参考图 | `lemo-studio/upload/` | `UploadService` |
| Dataset 素材 | `lemo-studio/dataset/` | `DatasetService` |
| Moodboard 卡片 | `lemo-studio/moodboard/` | `MoodboardCardsService` |

---

## 5. 最佳实践

### 5.1 数据库访问

✅ **推荐做法：**
- 新增持久化逻辑必须在 `lib/server/repositories/` 下新建 Repository
- Service 层完成 camelCase ↔ snake_case 转换
- 用户归属过滤必须在 Repository 层强制加 `user_id` 条件
- 所有写操作从 session 推导 `actorId`/`userId`，不信任客户端传入
- 单表文件超过 400 行时拆分
- 复杂查询使用 Supabase 原生 `.select()` 链式调用而非 Model 通用方法

❌ **禁止做法：**
- 在 Route Handler 或 Service 中直接 `getSupabaseClient()` 操作表
- 在数据库中存储预签名 URL（会过期）
- Repository 返回 camelCase 字段（与 DB 字段不一致）
- 通用 `updateOne/deleteOne` 不加 `user_id` 过滤（越权风险）

### 5.2 对象存储

✅ **推荐做法：**
- 数据库只存 `storage_key`，不存完整 URL
- 返回给前端时再动态生成预签名 URL
- 上传成功后在 `image_assets` 表记录索引
- 用户上传文件使用随机文件名（UUID 前缀）避免覆盖
- 公开访问的图片使用 1 天有效期，敏感操作使用 1 小时有效期
- 目录按业务模块划分，避免所有文件堆在根目录

❌ **禁止做法：**
- 数据库中存储带 `?sign=xxx` 的预签名 URL
- 前端直接使用永久的公网 URL（平台存储默认不开启公共读）
- 使用用户原始文件名作为存储 key（存在覆盖风险）
- 在前端代码中硬编码存储 endpoint 或 bucket 名称

---

## 6. 常见问题与排障

### Q1: 本地开发时 Supabase 连接失败

**症状：** 报错 `COZE_SUPABASE_URL is not set`

**可能原因：**
1. 本地未配置 `.env.local` 文件
2. Python `coze_workload_identity` 模块未安装（仅沙箱环境可用）

**解决方案：**
- 在项目根目录创建 `.env.local`，填入 Supabase 连接信息
- 本地开发可连接远程 Supabase 项目或使用本地 Docker 实例

### Q2: 图片返回 403 Forbidden 或签名过期

**症状：** 图片能正常显示一段时间后突然 403

**原因：** 预签名 URL 过期（默认 1 天）

**解决方案：**
1. 确保数据库存的是 `storageKey` 而非旧 URL
2. 列表接口返回时重新生成预签名 URL
3. 前端监听 `img.onerror` 事件，调用 `/api/storage/presigned-url` 刷新

### Q3: 上传文件返回 403 AccessDenied

**症状：** 调用 `uploadImageToStorage` 时返回权限错误

**可能原因：**
1. `STORAGE_ACCESS_KEY` 环境变量未注入
2. Bucket 路径权限配置错误
3. 目录名包含特殊字符或 `..` 路径遍历

**解决方案：**
- 检查环境变量是否存在（沙箱环境会自动注入）
- 存储目录只使用字母、数字、`/`、`_`、`-` 字符
- 使用 `sanitizeSubdir()` 工具函数清洗目录参数

### Q4: Repository 查询返回的字段名是 snake_case，前端使用不便

**解决方案：** Service 层负责转换为 camelCase DTO 后再返回，不要在 Repository 层做转换，保持 Repository 与数据库字段一致。

---

## 7. 相关文档索引

- [数据库设计现状](architecture/database-design-current-state.md) - 详细表结构设计
- [第二轮重构说明](architecture/second-round-refactor.md) - 分层架构演进
- [环境变量契约](ENVIRONMENT.md) - 完整环境变量列表
- [Gallery 模块文档](features/gallery.md) - 图片资产相关流程
