# Lemon8 AI Studio

## 本地运行

```bash
pnpm install --frozen-lockfile
pnpm dev:local
```

首次使用需安装 `brew install postgresql@17 postgrest`。本地地址为 `http://127.0.0.1:3001`，前端和 `/api/*` 在同一个 Next.js 进程中。

另开终端执行 `pnpm local:seed` 初始化测试图片。数据库与图片保存在 `.local/`；停止数据库用 `pnpm local:down`，不会清空数据。生成模型仍使用 `.env.local` 中已有凭据。

详见 [本地开发环境](docs/features/local-development.md)。扣子平台继续使用 `pnpm dev` 和 `.coze` 中的部署命令。

## Build Scripts

`pnpm build` 编译 standalone；扣子部署通过 `scripts/deploy-build.sh` 打包并复制公共资源和启动脚本。

## Playwright E2E

```bash
pnpm playwright:install
pnpm test:e2e
pnpm test:e2e:headed
```

By default Playwright starts the Next dev server on `http://localhost:3001`.
Set `PLAYWRIGHT_BASE_URL` if you want to point tests at an already running server.

## Project Docs

- Structure guideline: `docs/PROJECT_STRUCTURE.md`
- Product philosophy & technical plan: `docs/product-philosophy-and-technical-plan.md`
- Deployment notes: `docs/DEPLOYMENT.md`
- Environment variables: `docs/ENVIRONMENT.md`
- Database schema and versioned migrations: `docs/features/database-migrations.md` (`pnpm db:status`, `pnpm db:migrate`, `pnpm db:check`)
- Notes: `docs/notes/`
- Tool docs: `docs/tools/`
