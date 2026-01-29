#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);
const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'output',
  'dist',
  'build'
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    threshold: 500,
    strict: false,
    includeGlobs: [],
    excludeGlobs: [],
    reportDir: 'report'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith('--threshold')) {
      let value;
      if (arg.includes('=')) {
        value = arg.split('=')[1];
      } else {
        value = args[++i];
      }
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) {
        console.error(`无效的阈值: ${value}`);
        process.exit(1);
      }
      options.threshold = Math.floor(num);
      continue;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg.startsWith('--include')) {
      let value;
      if (arg.includes('=')) {
        value = arg.split('=')[1];
      } else {
        value = args[++i];
      }
      if (value) {
        options.includeGlobs.push(value);
      }
      continue;
    }

    if (arg.startsWith('--exclude')) {
      let value;
      if (arg.includes('=')) {
        value = arg.split('=')[1];
      } else {
        value = args[++i];
      }
      if (value) {
        options.excludeGlobs.push(value);
      }
      continue;
    }

    if (arg.startsWith('--report-dir')) {
      let value;
      if (arg.includes('=')) {
        value = arg.split('=')[1];
      } else {
        value = args[++i];
      }
      if (value) {
        options.reportDir = value;
      }
      continue;
    }
  }

  return options;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`文件行数检查脚本

用法：
  node scripts/check-lines.mjs [--threshold=500] [--strict] [--include=glob] [--exclude=glob] [--report-dir=report]

参数说明：
  --threshold       单文件行数阈值，默认为 500
  --strict          严格模式：存在超标文件时以退出码 1 结束
  --include         仅统计匹配的路径（可多次指定），支持简单 glob，如 src/**/*.tsx
  --exclude         排除匹配的路径（可多次指定）
  --report-dir      报告输出目录，默认为 report

默认会递归扫描仓库根目录下的源码文件：
  .ts, .tsx, .js, .jsx, .css, .scss
并排除常见构建产物目录：
  node_modules, .git, .next, output, dist, build
`);
}

function globToRegExp(glob) {
  // 非严格 glob 转正则，仅支持 *, **, ?，其余字符按字面量处理
  const specialChars = /[\\^$+?.()|{}\[\]]/g;
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      const next = glob[i + 1];
      if (next === '*') {
        pattern += '.*';
        i++;
      } else {
        pattern += '[^/]*';
      }
    } else if (ch === '?') {
      pattern += '[^/]';
    } else {
      pattern += ch.replace(specialChars, '\\$&');
    }
  }
  return new RegExp('^' + pattern + '$');
}

function compilePatterns(globs) {
  return globs.map((g) => globToRegExp(g));
}

function collectFiles(rootDir, { extensions, excludedDirNames, includePatterns, excludePatterns }) {
  const results = [];

  function walk(relDir) {
    const absDir = relDir ? path.join(rootDir, relDir) : rootDir;
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (err) {
      console.warn(`无法读取目录: ${absDir}`, err);
      return;
    }

    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const relPosixPath = relPath.split(path.sep).join('/');

      if (entry.isDirectory()) {
        if (excludedDirNames.has(entry.name)) {
          continue;
        }
        walk(relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!extensions.has(ext)) {
          continue;
        }

        if (includePatterns.length > 0 && !includePatterns.some((re) => re.test(relPosixPath))) {
          continue;
        }
        if (excludePatterns.some((re) => re.test(relPosixPath))) {
          continue;
        }

        results.push({ relPath: relPosixPath, absPath: path.join(rootDir, relPath) });
      }
    }
  }

  walk('');
  return results;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.length === 0) return 0;
  const lines = content.split(/\r\n|\r|\n/).length;
  return lines;
}

function suggestRefactor(relPath) {
  const lower = relPath.toLowerCase();
  const ext = path.extname(relPath).toLowerCase();

  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
    if (lower.startsWith('pages/') || lower.includes('/pages/')) {
      return '页面文件过大，建议将复杂布局拆分为多个子组件，并将数据请求与副作用提取到独立 hooks 或 service 模块。';
    }
    if (lower.startsWith('app/') || lower.includes('/app/')) {
      return 'App 目录下文件过大，建议按路由段拆分组件，并将通用逻辑下沉到共享 hooks 与工具函数中。';
    }
    if (lower.includes('/components/')) {
      return '组件体积过大，建议按 UI 区块拆分为多个子组件，并提取复用逻辑到自定义 hooks 或工具函数。';
    }
    if (lower.includes('/hooks/')) {
      return '自定义 Hook 逻辑过于庞大，建议拆分为多个职责单一的 hooks，并将通用工具提取到独立 util 文件。';
    }
    return '建议按“UI 展示 / 状态管理 / 副作用 / 工具函数”拆分到多个较小文件，每个文件保持单一职责。';
  }

  if (ext === '.css' || ext === '.scss') {
    if (lower.includes('/components/')) {
      return '样式文件过大，建议按组件或区块拆分为多个样式文件，并减少全局样式与深层选择器。';
    }
    if (lower.startsWith('pages/') || lower.includes('/pages/')) {
      return '页面样式过于集中，建议按页面区域或组件拆分样式文件，并优先复用全局变量与工具类。';
    }
    return '建议按业务模块或组件拆分样式文件，减少单文件体积，并避免过深的选择器嵌套。';
  }

  return '建议根据业务模块、组件或职责边界拆分成多个更小的文件，提升可维护性。';
}

function generateMarkdownReport(summary) {
  const lines = [];
  lines.push('# 文件行数检查报告');
  lines.push('');
  lines.push(`- 生成时间：${summary.generatedAt}`);
  lines.push(`- 根目录：${summary.root}`);
  lines.push(`- 阈值：${summary.threshold} 行`);
  lines.push(`- 严格模式：${summary.strict ? '是' : '否'}`);
  lines.push(`- 扫描文件数：${summary.totalFiles}`);
  lines.push(`- 总行数：${summary.totalLines}`);
  lines.push('');

  if (summary.exceeded.length > 0) {
    lines.push('## 超标文件清单');
    lines.push('');
    lines.push('| 序号 | 文件路径 | 行数 | 超出行数 | 建议拆分方向 |');
    lines.push('| ---- | -------- | ---- | -------- | ------------ |');
    summary.exceeded.forEach((item, index) => {
      const safeSuggestion = (item.suggestion || '').replace(/\|/g, '\\|');
      lines.push(
        `| ${index + 1} | ${item.path} | ${item.lines} | ${item.overBy} | ${safeSuggestion} |`
      );
    });
  } else {
    lines.push('## 超标文件清单');
    lines.push('');
    lines.push('当前未发现超出阈值的文件。🎉');
  }

  lines.push('');
  lines.push('## Top 50 按行数排序的文件');
  lines.push('');
  const topFiles = [...summary.files]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 50);

  lines.push('| 序号 | 文件路径 | 行数 |');
  lines.push('| ---- | -------- | ---- |');
  topFiles.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.path} | ${item.lines} |`);
  });

  lines.push('');
  lines.push('> 提示：建议将单文件控制在 100~300 行之间，超过阈值的文件优先评估拆分。');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = process.cwd();

  const includePatterns = compilePatterns(options.includeGlobs);
  const excludePatterns = compilePatterns(options.excludeGlobs);

  const files = collectFiles(repoRoot, {
    extensions: DEFAULT_EXTENSIONS,
    excludedDirNames: DEFAULT_EXCLUDED_DIRS,
    includePatterns,
    excludePatterns
  });

  const filesWithCounts = files.map((file) => {
    const lines = countLines(file.absPath);
    return { path: file.relPath, lines };
  });

  const totalLines = filesWithCounts.reduce((sum, f) => sum + f.lines, 0);
  const exceeded = filesWithCounts
    .filter((f) => f.lines > options.threshold)
    .map((f) => ({
      ...f,
      overBy: f.lines - options.threshold,
      suggestion: suggestRefactor(f.path)
    }))
    .sort((a, b) => b.lines - a.lines);

  const summary = {
    generatedAt: new Date().toISOString(),
    root: repoRoot,
    threshold: options.threshold,
    strict: options.strict,
    totalFiles: filesWithCounts.length,
    totalLines,
    files: filesWithCounts.sort((a, b) => b.lines - a.lines),
    exceeded
  };

  const reportDir = path.isAbsolute(options.reportDir)
    ? options.reportDir
    : path.join(repoRoot, options.reportDir);

  fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, 'file-lines.json');
  const mdPath = path.join(reportDir, 'file-lines.md');

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(mdPath, generateMarkdownReport(summary), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `文件行数检查完成，共扫描 ${summary.totalFiles} 个文件，生成报告：\n- ${path.relative(
      repoRoot,
      jsonPath
    )}\n- ${path.relative(repoRoot, mdPath)}`
  );

  if (options.strict && exceeded.length > 0) {
    process.exitCode = 1;
  }
}

main();
