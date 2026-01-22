/**
 * 数据迁移脚本：将历史数据中的顶层冗余字段迁移到 config 内
 * 
 * 运行方式：
 *   npx ts-node scripts/migrate-history.ts
 * 
 * 或直接：
 *   node -r ts-node/register scripts/migrate-history.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUTS_DIR = path.join(process.cwd(), 'public', 'outputs');
const HISTORY_FILE = path.join(OUTPUTS_DIR, 'history.json');
const BACKUP_FILE = path.join(OUTPUTS_DIR, 'history.migrated.bak.json');

interface Generation {
    id: string;
    config?: {
        sourceImageUrl?: string;
        sourceImageUrls?: string[];
        localSourceId?: string;
        localSourceIds?: string[];
        baseModel?: string;
        editConfig?: unknown;
        isEdit?: boolean;
        parentId?: string;
        taskId?: string;
        [key: string]: unknown;
    };
    // 顶层冗余字段
    sourceImageUrl?: string;
    sourceImageUrls?: string[];
    localSourceId?: string;
    localSourceIds?: string[];
    baseModel?: string;
    editConfig?: unknown;
    isEdit?: boolean;
    parentId?: string;
    taskId?: string;
    [key: string]: unknown;
}

/**
 * 将顶层冗余字段迁移到 config 内
 */
function migrateGeneration(gen: Generation): Generation {
    if (!gen.config) {
        gen.config = {} as Generation['config'];
    }

    const config = gen.config!;

    // 1. sourceImageUrls / sourceImageUrl
    if (!config.sourceImageUrls || config.sourceImageUrls.length === 0) {
        if (gen.sourceImageUrls && gen.sourceImageUrls.length > 0) {
            config.sourceImageUrls = gen.sourceImageUrls;
        } else if (gen.sourceImageUrl) {
            config.sourceImageUrls = [gen.sourceImageUrl];
        }
    }

    // 2. localSourceIds / localSourceId
    if (!config.localSourceIds || config.localSourceIds.length === 0) {
        if (gen.localSourceIds && gen.localSourceIds.length > 0) {
            config.localSourceIds = gen.localSourceIds;
        } else if (gen.localSourceId) {
            config.localSourceIds = [gen.localSourceId];
        }
    }

    // 3. baseModel
    if (!config.baseModel && gen.baseModel) {
        config.baseModel = gen.baseModel;
    }

    // 4. editConfig
    if (!config.editConfig && gen.editConfig) {
        config.editConfig = gen.editConfig;
    }

    // 5. isEdit
    if (config.isEdit === undefined && gen.isEdit !== undefined) {
        config.isEdit = gen.isEdit;
    }

    // 6. parentId
    if (!config.parentId && gen.parentId) {
        config.parentId = gen.parentId;
    }

    // 7. taskId
    if (!config.taskId && gen.taskId) {
        config.taskId = gen.taskId;
    }

    return gen;
}

async function main() {
    console.log('📦 数据迁移脚本启动...');
    console.log(`📂 历史文件路径: ${HISTORY_FILE}`);

    // 1. 检查文件是否存在
    if (!fs.existsSync(HISTORY_FILE)) {
        console.log('⚠️  历史文件不存在，无需迁移');
        return;
    }

    // 2. 读取历史数据
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    let history: Generation[];

    try {
        history = JSON.parse(content);
    } catch (e) {
        console.error('❌ JSON 解析失败:', e);
        return;
    }

    if (!Array.isArray(history)) {
        console.error('❌ 历史数据格式错误，期望数组');
        return;
    }

    console.log(`📊 读取到 ${history.length} 条记录`);

    // 3. 备份原文件
    fs.copyFileSync(HISTORY_FILE, BACKUP_FILE);
    console.log(`💾 已备份到: ${BACKUP_FILE}`);

    // 4. 迁移数据
    let migratedCount = 0;
    const migratedHistory = history.map((gen) => {
        const original = JSON.stringify(gen);
        const migrated = migrateGeneration(gen);

        if (JSON.stringify(migrated) !== original) {
            migratedCount++;
        }

        return migrated;
    });

    // 5. 写入迁移后的数据
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(migratedHistory), 'utf-8');
    console.log(`✅ 迁移完成！共处理 ${migratedCount} 条记录`);

    // 6. 迁移单独的 JSON 元数据文件
    console.log('\n📂 开始迁移单独的元数据文件...');

    const files = fs.readdirSync(OUTPUTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'history.json' && f !== 'history.bak.json' && f !== 'history.old.json' && f !== 'history.migrated.bak.json');

    let jsonMigratedCount = 0;

    for (const jsonFile of jsonFiles) {
        const jsonPath = path.join(OUTPUTS_DIR, jsonFile);
        try {
            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            const metadata = JSON.parse(jsonContent);

            // 检查是否有 config 对象
            if (metadata.config) {
                const original = JSON.stringify(metadata);

                // 迁移顶层字段到 config
                if (metadata.sourceImageUrls && !metadata.config.sourceImageUrls) {
                    metadata.config.sourceImageUrls = metadata.sourceImageUrls;
                }
                if (metadata.localSourceIds && !metadata.config.localSourceIds) {
                    metadata.config.localSourceIds = metadata.localSourceIds;
                }
                if (metadata.baseModel && !metadata.config.baseModel) {
                    metadata.config.baseModel = metadata.baseModel;
                }

                if (JSON.stringify(metadata) !== original) {
                    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');
                    jsonMigratedCount++;
                }
            }
        } catch {
            // 跳过解析失败的文件
        }
    }

    console.log(`✅ 元数据文件迁移完成！共处理 ${jsonMigratedCount} 个文件`);
    console.log('\n🎉 全部迁移完成！');
}

main().catch(console.error);
