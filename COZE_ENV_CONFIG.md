# 扣子平台环境变量配置清单

## ✅ 自动注入（无需配置）

以下变量由扣子平台自动注入：
- `COZE_SUPABASE_URL` - Supabase 数据库地址
- `COZE_SUPABASE_ANON_KEY` - Supabase 密钥
- `COZE_BUCKET_ENDPOINT_URL` - 对象存储端点
- `COZE_BUCKET_NAME` - 存储桶名称

---

## 🔧 必须手动配置

### 基础配置
```
PORT=5000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_PORT=5000
NEXT_PUBLIC_SIDEBAR_MODE=full
NEXT_DISABLE_IMAGE_OPTIMIZATION=true
CLOUD_STORAGE=coze
```

### ComfyUI 配置
⚠️ 注意：`10.75.169.12` 是局域网地址，云端部署无法访问！
需要使用 ngrok/frp 等工具暴露到公网后替换地址。

```
COMFYUI_API_URL=http://10.75.169.12:1000
NEXT_PUBLIC_COMFYUI_URL=http://10.75.169.12:1000
COMFYUI_SECURE=false
```

---

## 🤖 AI API Keys（按需配置）

### 豆包/火山引擎
```
DOUBAO_API_KEY=你的API_KEY
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

### Google AI
```
GOOGLE_API_KEY=你的API_KEY
GOOGLE_GENAI_API_KEY=你的API_KEY
```

### DeepSeek
```
DEEPSEEK_API_KEY=你的API_KEY
```

### Coze
```
COZE_API_TOKEN=你的TOKEN
COZE_PROMPT_API_TOKEN=你的TOKEN
COZE_SEED_API_TOKEN=你的TOKEN
```

### 字节跳动 AFR
```
BYTEDANCE_APP_KEY=你的KEY
BYTEDANCE_APP_SECRET=你的SECRET
```

---

## 📋 快速复制（填写你的实际值）

```
PORT=5000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_PORT=5000
NEXT_PUBLIC_SIDEBAR_MODE=full
NEXT_DISABLE_IMAGE_OPTIMIZATION=true
CLOUD_STORAGE=coze

COMFYUI_API_URL=http://你的公网地址:端口
NEXT_PUBLIC_COMFYUI_URL=http://你的公网地址:端口
COMFYUI_SECURE=false

DOUBAO_API_KEY=填写你的值
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

GOOGLE_API_KEY=填写你的值
GOOGLE_GENAI_API_KEY=填写你的值

DEEPSEEK_API_KEY=填写你的值

COZE_API_TOKEN=填写你的值
COZE_PROMPT_API_TOKEN=填写你的值
COZE_SEED_API_TOKEN=填写你的值

BYTEDANCE_APP_KEY=填写你的值
BYTEDANCE_APP_SECRET=填写你的值
```

---

## ⚠️ 重要提醒

1. **ComfyUI 地址**：云端部署无法访问局域网地址 `10.75.169.12`
   - 解决方案：使用 ngrok/frp 将 ComfyUI 暴露到公网
   - 或者：在本地运行项目（推荐）

2. **环境变量生效**：配置后需要重新部署才能生效

3. **敏感信息**：API Keys 请妥善保管，不要泄露
