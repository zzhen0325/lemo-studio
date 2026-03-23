-- ==========================================
-- Lemon8 AI Studio - 修复过期预签名 URL 脚本
-- ==========================================
-- 执行方式：在生产环境的 Supabase 数据库中执行此脚本
-- 适用场景：图片因预签名 URL 过期而无法显示
-- ==========================================

BEGIN;

-- 1. 显示修复前的状态统计
SELECT '=== 修复前状态统计 ===' as info;

SELECT 'generations.output_url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN output_url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN output_url NOT LIKE 'ljhwZthlaukjlkulzlp/%' AND output_url NOT LIKE 'http%' AND output_url IS NOT NULL AND output_url != '' THEN 1 ELSE 0 END) as missing_prefix,
       SUM(CASE WHEN output_url LIKE 'http%' AND output_url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM generations WHERE output_url IS NOT NULL AND output_url != ''

UNION ALL

SELECT 'dataset_entries.url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN url NOT LIKE 'ljhwZthlaukjlkulzlp/%' AND url NOT LIKE 'http%' AND url IS NOT NULL AND url != '' THEN 1 ELSE 0 END) as missing_prefix,
       SUM(CASE WHEN url LIKE 'http%' AND url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM dataset_entries WHERE url IS NOT NULL AND url != ''

UNION ALL

SELECT 'image_assets.url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN url NOT LIKE 'ljhwZthlaukjlkulzlp/%' AND url NOT LIKE 'http%' AND url IS NOT NULL AND url != '' THEN 1 ELSE 0 END) as missing_prefix,
       SUM(CASE WHEN url LIKE 'http%' AND url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM image_assets WHERE url IS NOT NULL AND url != '';

-- 2. 修复 generations 表
-- 情况 A: 缺少前缀的 storage key
UPDATE generations 
SET output_url = 'ljhwZthlaukjlkulzlp/' || output_url 
WHERE output_url NOT LIKE 'ljhwZthlaukjlkulzlp/%' 
  AND output_url NOT LIKE 'http%' 
  AND output_url IS NOT NULL 
  AND output_url != '';

-- 情况 B: 过期的预签名 URL
UPDATE generations 
SET output_url = substring(output_url from 'ljhwZthlaukjlkulzlp/[^?]+')
WHERE output_url LIKE 'http%' 
  AND output_url LIKE '%ljhwZthlaukjlkulzlp/%'
  AND output_url LIKE '%?sign=%';

-- 3. 修复 dataset_entries 表
-- 情况 A: 缺少前缀的 storage key
UPDATE dataset_entries 
SET url = 'ljhwZthlaukjlkulzlp/' || url 
WHERE url NOT LIKE 'ljhwZthlaukjlkulzlp/%' 
  AND url NOT LIKE 'http%' 
  AND url IS NOT NULL 
  AND url != '';

-- 情况 B: 过期的预签名 URL
UPDATE dataset_entries 
SET url = substring(url from 'ljhwZthlaukjlkulzlp/[^?]+')
WHERE url LIKE 'http%' 
  AND url LIKE '%ljhwZthlaukjlkulzlp/%'
  AND url LIKE '%?sign=%';

-- 4. 修复 image_assets 表
-- 情况 A: 缺少前缀的 storage key (更新 url 字段)
UPDATE image_assets 
SET url = 'ljhwZthlaukjlkulzlp/' || url 
WHERE url NOT LIKE 'ljhwZthlaukjlkulzlp/%' 
  AND url NOT LIKE 'http%' 
  AND url IS NOT NULL 
  AND url != '';

-- 情况 B: 过期的预签名 URL (同时更新 url 和 storage_key 字段)
UPDATE image_assets 
SET 
  storage_key = CASE 
    WHEN storage_key IS NULL OR storage_key = '' 
    THEN substring(url from 'ljhwZthlaukjlkulzlp/[^?]+')
    ELSE storage_key
  END,
  url = substring(url from 'ljhwZthlaukjlkulzlp/[^?]+')
WHERE url LIKE 'http%' 
  AND url LIKE '%ljhwZthlaukjlkulzlp/%'
  AND url LIKE '%?sign=%';

-- 5. 显示修复后的状态统计
SELECT '=== 修复后状态统计 ===' as info;

SELECT 'generations.output_url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN output_url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN output_url LIKE 'http%' AND output_url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM generations WHERE output_url IS NOT NULL AND output_url != ''

UNION ALL

SELECT 'dataset_entries.url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN url LIKE 'http%' AND url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM dataset_entries WHERE url IS NOT NULL AND url != ''

UNION ALL

SELECT 'image_assets.url' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN url LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       SUM(CASE WHEN url LIKE 'http%' AND url LIKE '%?sign=%' THEN 1 ELSE 0 END) as expired_presigned_url
FROM image_assets WHERE url IS NOT NULL AND url != ''

UNION ALL

SELECT 'image_assets.storage_key' as table_field,
       COUNT(*) as total,
       SUM(CASE WHEN storage_key LIKE 'ljhwZthlaukjlkulzlp/%' THEN 1 ELSE 0 END) as valid_storage_key,
       0 as expired_presigned_url
FROM image_assets WHERE storage_key IS NOT NULL AND storage_key != '';

COMMIT;

-- ==========================================
-- 执行说明：
-- 1. 登录 Supabase 控制台
-- 2. 进入 SQL Editor
-- 3. 粘贴并执行此脚本
-- 4. 检查输出结果，确认 expired_presigned_url 列为 0
-- ==========================================
