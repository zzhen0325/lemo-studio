import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckStatus = 'success' | 'error' | 'skipped';

type ConnectionCheck = {
  status: CheckStatus;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

type DebugEnvReport = {
  supabase: Record<string, string>;
  storage: Record<string, string>;
  project: Record<string, string>;
  ai: Record<string, string>;
  session: Record<string, string>;
  checks: {
    database: ConnectionCheck;
    storage: ConnectionCheck;
  };
};

function maskedValue(value: string | undefined, visibleChars: number): string {
  if (!value) return '(未设置)';
  return `${value.slice(0, visibleChars)}...`;
}

function configuredFlag(value: string | undefined): string {
  return value ? '✅ 已设置' : '❌ 未设置';
}

export async function GET() {
  const supabaseUrl = process.env.COZE_SUPABASE_URL;
  const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
  const dbPassword = process.env.DB_PASSWORD;
  const bucketEndpoint = process.env.COZE_BUCKET_ENDPOINT_URL;
  const bucketName = process.env.COZE_BUCKET_NAME;
  const storageAccessKey = process.env.STORAGE_ACCESS_KEY;

  const report: DebugEnvReport = {
    supabase: {
      COZE_SUPABASE_URL: supabaseUrl || '(未设置)',
      COZE_SUPABASE_ANON_KEY: maskedValue(supabaseKey, 30),
      DB_PASSWORD: maskedValue(dbPassword, 20),
    },
    storage: {
      COZE_BUCKET_ENDPOINT_URL: bucketEndpoint || '(未设置)',
      COZE_BUCKET_NAME: bucketName || '(未设置)',
      STORAGE_ACCESS_KEY: maskedValue(storageAccessKey, 20),
    },
    project: {
      COZE_WORKSPACE_PATH: process.env.COZE_WORKSPACE_PATH || '(未设置)',
      COZE_PROJECT_DOMAIN: process.env.COZE_PROJECT_DOMAIN_DEFAULT || '(未设置)',
      DEPLOY_RUN_PORT: process.env.DEPLOY_RUN_PORT || '(未设置)',
      COZE_PROJECT_ENV: process.env.COZE_PROJECT_ENV || '(未设置)',
    },
    ai: {
      DOUBAO_API_KEY: configuredFlag(process.env.DOUBAO_API_KEY),
      GOOGLE_API_KEY: configuredFlag(process.env.GOOGLE_API_KEY),
      GOOGLE_GENAI_API_KEY: configuredFlag(process.env.GOOGLE_GENAI_API_KEY),
      DEEPSEEK_API_KEY: configuredFlag(process.env.DEEPSEEK_API_KEY),
      LEMO_COZE_API_TOKEN: configuredFlag(process.env.LEMO_COZE_API_TOKEN),
      BYTEDANCE_APP_KEY: configuredFlag(process.env.BYTEDANCE_APP_KEY),
      BYTEDANCE_APP_SECRET: configuredFlag(process.env.BYTEDANCE_APP_SECRET),
      COMFYUI_API_URL: process.env.COMFYUI_API_URL || '(未设置)',
    },
    session: {
      AUTH_SESSION_SECRET: configuredFlag(process.env.AUTH_SESSION_SECRET),
      API_CONFIG_ENCRYPTION_KEY: configuredFlag(process.env.API_CONFIG_ENCRYPTION_KEY),
    },
    checks: {
      database: {
        status: 'skipped',
        message: '跳过数据库连接测试（缺少环境变量）',
      },
      storage: {
        status: 'skipped',
        message: '跳过对象存储连接测试（缺少环境变量）',
      },
    },
  };

  if (supabaseUrl && (supabaseKey || dbPassword)) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseKey || dbPassword!, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      
      const { error } = await client.from('generations').select('id').limit(1);
      
      if (error) {
        report.checks.database = {
          status: 'error',
          message: `数据库连接失败: ${error.message}`,
          code: error.code || undefined,
        };
      } else {
        report.checks.database = {
          status: 'success',
          message: '数据库连接成功',
        };
      }
    } catch (e) {
      report.checks.database = {
        status: 'error',
        message: `数据库连接异常: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (bucketEndpoint && bucketName) {
    try {
      const { S3Storage } = await import('coze-coding-dev-sdk');
      const storage = new S3Storage({
        endpointUrl: bucketEndpoint,
        accessKey: storageAccessKey || '',
        secretKey: '',
        bucketName: bucketName,
        region: 'cn-beijing',
      });
      
      const listResult = await storage.listFiles({ maxKeys: 5 });
      report.checks.storage = {
        status: 'success',
        message: '对象存储连接成功',
        details: {
          bucket: bucketName,
          fileCount: listResult.keys?.length || 0,
          sampleFiles: listResult.keys?.slice(0, 3) || [],
        },
      };
    } catch (e) {
      report.checks.storage = {
        status: 'error',
        message: `对象存储连接异常: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return NextResponse.json({
    message: '环境变量调试信息已返回，可在浏览器控制台查看',
    report,
    environment: {
      supabase: {
        url: supabaseUrl || null,
        hasKey: !!supabaseKey,
        hasDbPassword: !!dbPassword,
      },
      storage: {
        endpoint: bucketEndpoint || null,
        bucket: bucketName || null,
        hasAccessKey: !!storageAccessKey,
      },
      project: {
        workspacePath: process.env.COZE_WORKSPACE_PATH || null,
        domain: process.env.COZE_PROJECT_DOMAIN_DEFAULT || null,
        port: process.env.DEPLOY_RUN_PORT || null,
        env: process.env.COZE_PROJECT_ENV || null,
      }
    }
  });
}
