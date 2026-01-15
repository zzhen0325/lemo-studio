# Supabase 连接配置修复计划

## 问题诊断
您当前的项目代码 (`lib/db.ts`) 使用 **PostgreSQL 直连 (pg)** 方式连接数据库，依赖 `DATABASE_URL` 环境变量。而您提供的 `NEXT_PUBLIC_SUPABASE_URL` 和 `KEY` 是用于 **Supabase 客户端 (SDK)** 的连接方式。

为了修复当前的 500 错误，我们必须确保 `DATABASE_URL` 配置正确。同时，我也会将您提供的 SDK 配置添加到环境变量中，以备将来使用。

## 已完成操作
1.  **更新 .env.local**: 已将您提供的 `NEXT_PUBLIC_SUPABASE_URL` 和 `KEY` 添加到配置文件中。
2.  **保留 DATABASE_URL**: 保留了现有的数据库连接串，但标记为需要修复密码。

## 下一步建议 (关键步骤)
目前的数据库连接失败 (`28P01 password authentication failed`) 是因为 `DATABASE_URL` 中的密码不正确。

请执行以下步骤修复连接：

1.  **找到正确的数据库密码**: 这是您在创建 Supabase 项目时设置的数据库密码（不是登录 Supabase 网站的密码）。如果您忘记了，可以在 Supabase Dashboard -> Project Settings -> Database -> Password 中重置。
2.  **更新 .env.local 中的 DATABASE_URL**:
    将文件中的 `Zhang72299516` 替换为正确的密码。
    ```env
    # 格式: postgresql://postgres:[YOUR-PASSWORD]@db.gkkrrxtonckoegglxszp.supabase.co:5432/postgres
    ```
3.  **如果遇到网络连接问题 (IPv6)**:
    如果在密码正确的情况下仍然连不上（出现超时或 ECONNREFUSED），请将端口从 `5432` 改为 `6543` (Supabase Transaction Pooler)，这通常对 IPv4 网络更友好。
    ```env
    # Pooler 模式 (推荐)
    DATABASE_URL=postgresql://postgres.gkkrrxtonckoegglxszp:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
    ```
    *(注意：Pooler 的 Host 地址可能不同，请在 Supabase Dashboard -> Connect -> Transaction Pooler 中获取准确的连接串)*

我已更新了 `.env.local` 模板，您只需填入正确密码即可生效。
