/**
 * Next.js Instrumentation Hook
 * 在服务启动时执行，打印关键环境变量信息
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           Lemon8 AI Studio - 环境变量调试信息                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Supabase 数据库配置
    console.log('📊 Supabase 数据库配置:');
    console.log('──────────────────────────────────────────────────────────────');
    const supabaseUrl = process.env.COZE_SUPABASE_URL;
    const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
    const dbPassword = process.env.DB_PASSWORD;
    
    console.log(`  COZE_SUPABASE_URL:     ${supabaseUrl || '(未设置)'}`);
    console.log(`  COZE_SUPABASE_ANON_KEY: ${supabaseKey ? `${supabaseKey.substring(0, 30)}...` : '(未设置)'}`);
    console.log(`  DB_PASSWORD:           ${dbPassword ? `${dbPassword.substring(0, 20)}...` : '(未设置)'}`);
    console.log('');

    // 2. 对象存储配置
    console.log('📦 对象存储配置:');
    console.log('──────────────────────────────────────────────────────────────');
    const bucketEndpoint = process.env.COZE_BUCKET_ENDPOINT_URL;
    const bucketName = process.env.COZE_BUCKET_NAME;
    const storageAccessKey = process.env.STORAGE_ACCESS_KEY;
    
    console.log(`  COZE_BUCKET_ENDPOINT_URL: ${bucketEndpoint || '(未设置)'}`);
    console.log(`  COZE_BUCKET_NAME:         ${bucketName || '(未设置)'}`);
    console.log(`  STORAGE_ACCESS_KEY:       ${storageAccessKey ? `${storageAccessKey.substring(0, 20)}...` : '(未设置)'}`);
    console.log('');

    // 3. 项目配置
    console.log('🚀 项目配置:');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  COZE_WORKSPACE_PATH:      ${process.env.COZE_WORKSPACE_PATH || '(未设置)'}`);
    console.log(`  COZE_PROJECT_DOMAIN:      ${process.env.COZE_PROJECT_DOMAIN_DEFAULT || '(未设置)'}`);
    console.log(`  DEPLOY_RUN_PORT:          ${process.env.DEPLOY_RUN_PORT || '(未设置)'}`);
    console.log(`  COZE_PROJECT_ENV:         ${process.env.COZE_PROJECT_ENV || '(未设置)'}`);
    console.log('');

    // 4. AI API 配置状态
    console.log('🤖 AI API 配置状态:');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  DOUBAO_API_KEY:        ${process.env.DOUBAO_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  GOOGLE_API_KEY:        ${process.env.GOOGLE_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  GOOGLE_GENAI_API_KEY:  ${process.env.GOOGLE_GENAI_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  DEEPSEEK_API_KEY:      ${process.env.DEEPSEEK_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  LEMO_COZE_API_TOKEN:   ${process.env.LEMO_COZE_API_TOKEN ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  BYTEDANCE_APP_KEY:     ${process.env.BYTEDANCE_APP_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  BYTEDANCE_APP_SECRET:  ${process.env.BYTEDANCE_APP_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  COMFYUI_API_URL:       ${process.env.COMFYUI_API_URL || '(未设置)'}`);
    console.log('');

    // 5. Session 配置
    console.log('🔐 Session 配置:');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  AUTH_SESSION_SECRET:     ${process.env.AUTH_SESSION_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  API_CONFIG_ENCRYPTION_KEY: ${process.env.API_CONFIG_ENCRYPTION_KEY ? '✅ 已设置' : '❌ 未设置'}`);
    console.log('');

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  环境变量调试信息输出完成                                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
  }
}
