import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printHelp() {
  console.log(`
Usage: node scripts/record-history.mjs [options]

Options:
  --count <n>                 Number of commits to record from latest log (default: 5)
  --commits <a,b,c>           Explicit commit hashes, comma-separated
  --nearby <n>                Expand each given commit to nearby n commits (including itself)
  --history-ref <ref>         Git ref used for nearby expansion (default: HEAD)
  --file <path>               Limit git log to commits touching this file/path
  --route <path>              Route to record (default: /)
  --port <port>               Dev server port (default: 3001)
  --capture-width <px>        Browser layout viewport width (default: 1920)
  --capture-height <px>       Browser layout viewport height (default: 1080)
  --video-width <px>          Video width (default: 1920)
  --video-height <px>         Video height (default: 1080)
  --video-fps <n>             Target video fps (default: 60)
  --video-bitrate-mbps <n>    Target video bitrate in Mbps (default: 20)
  --output-dir <dir>          Output directory (default: output/history-records)
  --pre-wait-ms <ms>          Wait after page load before screenshot (default: 3000)
  --capture-ms <ms>           Additional wait to keep video recording (default: 5000)
  --no-install                Skip pnpm install on each commit
  --no-transcode              Keep playwright raw webm without ffmpeg VP9 re-encode
  --help                      Show help
`);
}

function parseArgs(argv) {
  const options = {
    count: 5,
    commits: [],
    nearby: 0,
    historyRef: "HEAD",
    file: "",
    route: "/",
    port: 3001,
    captureWidth: 1920,
    captureHeight: 1080,
    videoWidth: 1920,
    videoHeight: 1080,
    videoFps: 60,
    videoBitrateMbps: 20,
    outputDir: path.resolve("output/history-records"),
    preWaitMs: 3000,
    captureMs: 5000,
    installEachCommit: true,
    transcode: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--no-install") {
      options.installEachCommit = false;
      continue;
    }
    if (arg === "--no-transcode") {
      options.transcode = false;
      continue;
    }

    if (arg === "--count" && next) {
      options.count = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--count=")) {
      options.count = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--commits" && next) {
      options.commits = next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg.startsWith("--commits=")) {
      options.commits = arg
        .split("=")[1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (arg === "--nearby" && next) {
      options.nearby = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--nearby=")) {
      options.nearby = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--history-ref" && next) {
      options.historyRef = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--history-ref=")) {
      options.historyRef = arg.split("=")[1];
      continue;
    }

    if (arg === "--file" && next) {
      options.file = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--file=")) {
      options.file = arg.split("=")[1];
      continue;
    }

    if (arg === "--route" && next) {
      options.route = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--route=")) {
      options.route = arg.split("=")[1];
      continue;
    }

    if (arg === "--port" && next) {
      options.port = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      options.port = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--video-width" && next) {
      options.videoWidth = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--video-width=")) {
      options.videoWidth = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--video-height" && next) {
      options.videoHeight = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--video-height=")) {
      options.videoHeight = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--capture-width" && next) {
      options.captureWidth = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--capture-width=")) {
      options.captureWidth = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--capture-height" && next) {
      options.captureHeight = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--capture-height=")) {
      options.captureHeight = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--video-fps" && next) {
      options.videoFps = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--video-fps=")) {
      options.videoFps = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--video-bitrate-mbps" && next) {
      options.videoBitrateMbps = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--video-bitrate-mbps=")) {
      options.videoBitrateMbps = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--output-dir" && next) {
      options.outputDir = path.resolve(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(arg.split("=")[1]);
      continue;
    }

    if (arg === "--pre-wait-ms" && next) {
      options.preWaitMs = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--pre-wait-ms=")) {
      options.preWaitMs = Number(arg.split("=")[1]);
      continue;
    }

    if (arg === "--capture-ms" && next) {
      options.captureMs = Number(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--capture-ms=")) {
      options.captureMs = Number(arg.split("=")[1]);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error("--count must be a positive integer");
  }
  if (!Number.isInteger(options.nearby) || options.nearby < 0) {
    throw new Error("--nearby must be a non-negative integer");
  }
  if (options.nearby > 0 && options.commits.length === 0) {
    throw new Error("--nearby requires --commits");
  }
  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("--port must be a positive integer");
  }
  if (!Number.isInteger(options.captureWidth) || options.captureWidth <= 0) {
    throw new Error("--capture-width must be a positive integer");
  }
  if (!Number.isInteger(options.captureHeight) || options.captureHeight <= 0) {
    throw new Error("--capture-height must be a positive integer");
  }
  if (!Number.isInteger(options.videoWidth) || options.videoWidth <= 0) {
    throw new Error("--video-width must be a positive integer");
  }
  if (!Number.isInteger(options.videoHeight) || options.videoHeight <= 0) {
    throw new Error("--video-height must be a positive integer");
  }
  if (!Number.isInteger(options.videoFps) || options.videoFps <= 0) {
    throw new Error("--video-fps must be a positive integer");
  }
  if (!Number.isFinite(options.videoBitrateMbps) || options.videoBitrateMbps <= 0) {
    throw new Error("--video-bitrate-mbps must be a positive number");
  }
  if (!Number.isInteger(options.preWaitMs) || options.preWaitMs < 0) {
    throw new Error("--pre-wait-ms must be a non-negative integer");
  }
  if (!Number.isInteger(options.captureMs) || options.captureMs < 0) {
    throw new Error("--capture-ms must be a non-negative integer");
  }

  return options;
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (res.status !== 0) {
    const stderr = (res.stderr || "").trim();
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${stderr}`);
  }
  return (res.stdout || "").trim();
}

async function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: false,
      stdio: "inherit",
      ...opts,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed (${code}): ${cmd} ${args.join(" ")}`));
      }
    });
  });
}

function ensurePortAvailable(port) {
  const res = spawnSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const pids = (res.stdout || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (pids.length > 0) {
    throw new Error(`Port ${port} is already in use by PID(s): ${pids.join(", ")}. Stop them first.`);
  }
}

function getCommits(options) {
  if (options.commits.length > 0 && options.nearby > 0) {
    return expandNearbyCommits(options.commits, options);
  }
  if (options.commits.length > 0) {
    return options.commits;
  }

  const args = ["log", "-n", String(options.count), "--pretty=format:%h"];
  if (options.file) {
    args.push("--", options.file);
  }

  const output = runCapture("git", args);
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getHistoryCommits(options) {
  const args = ["rev-list", "--first-parent", "--reverse", options.historyRef];
  if (options.file) {
    args.push("--", options.file);
  }

  const output = runCapture("git", args);
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getWindowRange(total, centerIndex, windowSize) {
  const clampedWindow = Math.min(windowSize, total);
  let start = centerIndex - Math.floor((clampedWindow - 1) / 2);
  let end = start + clampedWindow - 1;

  if (start < 0) {
    end += -start;
    start = 0;
  }
  if (end >= total) {
    const overshoot = end - total + 1;
    start = Math.max(0, start - overshoot);
    end = total - 1;
  }

  return [start, end];
}

function expandNearbyCommits(anchorCommits, options) {
  const history = getHistoryCommits(options);
  if (history.length === 0) {
    return [];
  }

  const selected = [];
  const seen = new Set();

  for (const anchor of anchorCommits) {
    const fullAnchor = runCapture("git", ["rev-parse", `${anchor}^{commit}`]);
    const index = history.indexOf(fullAnchor);
    if (index < 0) {
      throw new Error(
        `Commit ${anchor} not found in first-parent history of ${options.historyRef}` +
          (options.file ? ` for path ${options.file}` : "")
      );
    }

    const [start, end] = getWindowRange(history.length, index, options.nearby);
    for (const commit of history.slice(start, end + 1)) {
      if (seen.has(commit)) continue;
      seen.add(commit);
      selected.push(runCapture("git", ["rev-parse", "--short", commit]));
    }
  }

  return selected;
}

function startDevServer(port, cwd) {
  const env = {
    ...process.env,
    APP_PORT: String(port),
    NEXT_PUBLIC_APP_PORT: String(port),
  };

  const child = spawn("pnpm", ["dev"], {
    shell: false,
    env,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  const pushLog = (source, chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      logs.push(`[${source}] ${line}`);
      if (logs.length > 160) logs.shift();
    }
  };

  child.stdout.on("data", (chunk) => pushLog("stdout", chunk));
  child.stderr.on("data", (chunk) => pushLog("stderr", chunk));

  return { child, logs };
}

async function waitForServer(healthUrl, fallbackUrl, child, logs, timeoutMs = 150000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${child.exitCode}\n${logs.join("\n")}`);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return;
    } catch {
      // keep polling
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(fallbackUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status < 500) return;
    } catch {
      // keep polling
    }

    await sleep(1000);
  }

  throw new Error(`Dev server startup timeout for ${healthUrl}`);
}

async function waitProcessExit(child, timeoutMs) {
  if (!child || child.exitCode !== null) return true;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("close", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;

  child.kill("SIGTERM");
  const exitedOnTerm = await waitProcessExit(child, 8000);
  if (!exitedOnTerm) {
    child.kill("SIGKILL");
    await waitProcessExit(child, 3000);
  }
}

function ensureFfmpegIfNeeded(options) {
  if (!options.transcode) return;
  const ffmpeg = spawnSync("ffmpeg", ["-version"], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (ffmpeg.status !== 0) {
    throw new Error("ffmpeg is required for VP9 transcode but was not found in PATH");
  }
}

async function transcodeVp9(rawVideoPath, finalVideoPath, options) {
  const bitrate = `${options.videoBitrateMbps}M`;
  const bufsize = `${Math.round(options.videoBitrateMbps * 2)}M`;
  const gop = String(options.videoFps * 2);

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    rawVideoPath,
    "-an",
    "-vf",
    `scale=${options.videoWidth}:${options.videoHeight}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${options.videoWidth}:${options.videoHeight}:(ow-iw)/2:(oh-ih)/2:black,fps=${options.videoFps}`,
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    bitrate,
    "-minrate",
    bitrate,
    "-maxrate",
    bitrate,
    "-bufsize",
    bufsize,
    "-g",
    gop,
    "-row-mt",
    "1",
    "-tile-columns",
    "2",
    "-threads",
    "8",
    "-speed",
    "2",
    finalVideoPath,
  ]);
}

async function linkNodeModules(worktreeDir, repoRoot) {
  const rootNodeModules = path.join(repoRoot, "node_modules");
  const worktreeNodeModules = path.join(worktreeDir, "node_modules");

  await fsp.rm(worktreeNodeModules, { recursive: true, force: true }).catch(() => {});
  await fsp.symlink(rootNodeModules, worktreeNodeModules, "junction");
}

async function withWorktree(repoRoot, commit, fn) {
  const worktreeBase = await fsp.mkdtemp(path.join(os.tmpdir(), "cozestudio-history-"));
  const worktreeDir = path.join(worktreeBase, commit);

  try {
    await runCommand("git", ["worktree", "add", "--detach", worktreeDir, commit], { cwd: repoRoot });
    return await fn(worktreeDir);
  } finally {
    await runCommand("git", ["worktree", "remove", "--force", worktreeDir], { cwd: repoRoot }).catch(
      () => {}
    );
    await fsp.rm(worktreeBase, { recursive: true, force: true }).catch(() => {});
  }
}

async function recordCommit({ repoRoot, commit, options, baseUrl }) {
  const screenshotPath = path.join(options.outputDir, `${commit}.png`);
  const finalVideoPath = path.join(options.outputDir, `${commit}.webm`);
  const rawKeepPath = path.join(options.outputDir, `${commit}.raw.webm`);

  const targetUrl = new URL(options.route, baseUrl).toString();
  const healthUrl = new URL("/healthz", baseUrl).toString();
  const fallbackUrl = new URL("/", baseUrl).toString();

  return withWorktree(repoRoot, commit, async (worktreeDir) => {
    let serverProcess = null;
    let browser = null;
    let context = null;
    let page = null;

    try {
      if (options.installEachCommit) {
        try {
          await runCommand("pnpm", ["install", "--prefer-offline"], { cwd: worktreeDir });
        } catch (installError) {
          console.warn(
            `⚠️ pnpm install failed on ${commit}, fallback to repo node_modules symlink`
          );
          console.warn(
            installError instanceof Error ? installError.message : String(installError)
          );
          await linkNodeModules(worktreeDir, repoRoot);
        }
      } else {
        await linkNodeModules(worktreeDir, repoRoot);
      }

      const { child, logs } = startDevServer(options.port, worktreeDir);
      serverProcess = child;

      console.log(`⏳ Waiting for dev server: ${healthUrl}`);
      await waitForServer(healthUrl, fallbackUrl, serverProcess, logs);

      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: options.captureWidth, height: options.captureHeight },
        recordVideo: {
          dir: options.outputDir,
          size: { width: options.captureWidth, height: options.captureHeight },
        },
      });
      page = await context.newPage();

      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      try {
        await page.waitForLoadState("networkidle", { timeout: 12000 });
      } catch {
        // Some pages keep polling/websocket connections.
      }

      await sleep(options.preWaitMs);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await sleep(options.captureMs);

      const video = page.video();
      await page.close();
      await context.close();
      context = null;

      const rawPath = video ? await video.path() : null;
      if (!rawPath || !fs.existsSync(rawPath)) {
        throw new Error("Playwright video file not found");
      }

      await fsp.rename(rawPath, rawKeepPath).catch(async () => {
        await fsp.copyFile(rawPath, rawKeepPath);
        await fsp.unlink(rawPath).catch(() => {});
      });

      if (options.transcode) {
        await transcodeVp9(rawKeepPath, finalVideoPath, options);
      } else {
        await fsp.copyFile(rawKeepPath, finalVideoPath);
      }

      await browser.close();
      browser = null;

      console.log(`✅ ${commit} recorded`);
      return {
        commit,
        ok: true,
        screenshotPath,
        rawVideoPath: rawKeepPath,
        finalVideoPath,
      };
    } catch (error) {
      return {
        commit,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      await stopProcess(serverProcess);
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  ensurePortAvailable(options.port);
  ensureFfmpegIfNeeded(options);

  const repoRoot = runCapture("git", ["rev-parse", "--show-toplevel"]);
  const commits = getCommits(options);
  if (commits.length === 0) {
    throw new Error("No commits found for given conditions.");
  }

  await fsp.mkdir(options.outputDir, { recursive: true });
  console.log(`📦 Output directory: ${options.outputDir}`);
  console.log(`📜 Commits to record: ${commits.join(", ")}`);
  console.log(
    `🎞️ Spec: VP9 ${options.videoWidth}x${options.videoHeight} ${options.videoFps}fps ${options.videoBitrateMbps}Mbps`
  );

  const baseUrl = `http://127.0.0.1:${options.port}`;
  const results = [];

  for (const commit of commits) {
    console.log("\n======================================");
    console.log(`🎥 Recording commit: ${commit}`);
    console.log("======================================");

    const result = await recordCommit({ repoRoot, commit, options, baseUrl });
    results.push(result);

    if (!result.ok) {
      console.error(`❌ ${commit} failed`);
      console.error(result.error);
    }
  }

  const failed = results.filter((item) => !item.ok);
  const succeeded = results.filter((item) => item.ok);

  console.log("\n======================================");
  console.log(`✅ Success: ${succeeded.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📁 Artifacts: ${options.outputDir}`);
  console.log("======================================");

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
