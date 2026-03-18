import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, { status: 'ok' | 'error'; message: string; details?: unknown }> = {};

  // 1. 检查 Supabase 环境变量
  const supabaseUrl = process.env.COZE_SUPABASE_URL;
  const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
  
  results['supabase_env'] = {
    status: supabaseUrl && supabaseKey ? 'ok' : 'error',
    message: supabaseUrl && supabaseKey 
      ? 'Supabase 环境变量已配置'
      : '缺少 Supabase 环境变量',
    details: {
      url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : null,
      key: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : null,
    }
  };

  // 2. 检查对象存储环境变量
  const bucketUrl = process.env.COZE_BUCKET_ENDPOINT_URL;
  const bucketName = process.env.COZE_BUCKET_NAME;
  
  results['storage_env'] = {
    status: bucketUrl && bucketName ? 'ok' : 'error',
    message: bucketUrl && bucketName 
      ? '对象存储环境变量已配置'
      : '缺少对象存储环境变量',
    details: {
      endpoint: bucketUrl || null,
      bucket: bucketName || null,
    }
  };

  // 3. 尝试连接 Supabase
  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      
      // 测试查询
      const { error } = await client.from('users').select('id').limit(1);
      
      results['supabase_connection'] = {
        status: error ? 'error' : 'ok',
        message: error 
          ? `数据库连接失败: ${error.message}`
          : '数据库连接成功',
        details: error ? { code: error.code, message: error.message } : undefined
      };
    } catch (e) {
      results['supabase_connection'] = {
        status: 'error',
        message: `数据库连接异常: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } else {
    results['supabase_connection'] = {
      status: 'error',
      message: '跳过数据库连接测试（缺少环境变量）',
    };
  }

  // 4. 尝试连接对象存储
  if (bucketUrl && bucketName) {
    try {
      const { S3Storage } = await import('coze-coding-dev-sdk');
      const storage = new S3Storage({
        endpointUrl: bucketUrl,
        accessKey: '',
        secretKey: '',
        bucketName: bucketName,
        region: 'cn-beijing',
      });
      
      // 测试列出文件
      const listResult = await storage.listFiles({ maxKeys: 1 });
      
      results['storage_connection'] = {
        status: 'ok',
        message: '对象存储连接成功',
        details: {
          fileCount: listResult.keys?.length || 0,
        }
      };
    } catch (e) {
      results['storage_connection'] = {
        status: 'error',
        message: `对象存储连接异常: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } else {
    results['storage_connection'] = {
      status: 'error',
      message: '跳过对象存储连接测试（缺少环境变量）',
    };
  }

  // 5. 检查 AI API 配置
  const aiConfigs = {
    'doubao': !!(process.env.DOUBAO_API_KEY),
    'google': !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY),
    'deepseek': !!(process.env.DEEPSEEK_API_KEY),
    'coze': !!(process.env.LEMO_COZE_API_TOKEN),
    'bytedance': !!(process.env.BYTEDANCE_APP_KEY && process.env.BYTEDANCE_APP_SECRET),
    'comfyui': !!(process.env.COMFYUI_API_URL),
  };

  results['ai_apis'] = {
    status: 'ok',
    message: 'AI API 配置状态',
    details: aiConfigs,
  };

  // 汇总结果
  const allOk = Object.values(results).every(r => r.status === 'ok' || r.message.includes('跳过'));
  
  return NextResponse.json({
    status: allOk ? 'healthy' : 'issues_found',
    timestamp: new Date().toISOString(),
    results,
  }, { status: allOk ? 200 : 500 });
}
