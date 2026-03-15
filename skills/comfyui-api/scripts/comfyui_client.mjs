#!/usr/bin/env node
// ComfyUI API client (local server or ComfyUI Cloud).
// No external deps; uses Node 18+ built-in fetch.

import fs from "fs/promises";
import path from "path";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function loadWorkflow(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function collectFileEntries(obj, results) {
  if (Array.isArray(obj)) {
    for (const v of obj) collectFileEntries(v, results);
    return;
  }
  if (obj && typeof obj === "object") {
    if (typeof obj.filename === "string") results.push(obj);
    for (const v of Object.values(obj)) collectFileEntries(v, results);
  }
}

function dedupeFiles(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = `${e.filename}|${e.subfolder || ""}|${e.type || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildViewUrl(base, mode, entry) {
  const params = new URLSearchParams();
  params.set("filename", entry.filename || "");
  if (entry.subfolder) params.set("subfolder", entry.subfolder);
  if (entry.type) params.set("type", entry.type);
  const route = mode === "cloud" ? "/api/view" : "/view";
  return `${base}${route}?${params.toString()}`;
}

function safeOutPath(outdir, entry) {
  const sub = entry.subfolder ? entry.subfolder.replace(/^[/\\]+|[/\\]+$/g, "") : "";
  const filename = path.basename(entry.filename || "output.bin");
  return sub ? path.join(outdir, sub, filename) : path.join(outdir, filename);
}

async function jsonRequest(method, url, headers, payload) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  return JSON.parse(text);
}

async function submitWorkflow(base, mode, workflow, apiKey, number) {
  if (mode === "cloud") {
    const url = `${base}/api/prompt`;
    const headers = { "X-API-Key": apiKey || "" };
    const payload = { prompt: workflow, number };
    const resp = await jsonRequest("POST", url, headers, payload);
    if (!resp.prompt_id) throw new Error(`No prompt_id in response: ${JSON.stringify(resp)}`);
    return String(resp.prompt_id);
  }
  const url = `${base}/prompt`;
  const resp = await jsonRequest("POST", url, {}, { prompt: workflow });
  if (!resp.prompt_id) throw new Error(`No prompt_id in response: ${JSON.stringify(resp)}`);
  return String(resp.prompt_id);
}

async function fetchHistory(base, mode, promptId, apiKey) {
  const url = mode === "cloud" ? `${base}/api/history_v2/${promptId}` : `${base}/history/${promptId}`;
  const headers = mode === "cloud" ? { "X-API-Key": apiKey || "" } : {};
  const res = await fetch(url, { headers });
  const text = await res.text();
  return JSON.parse(text);
}

async function downloadOutputs(base, mode, entries, apiKey, outdir) {
  const headers = mode === "cloud" && apiKey ? { "X-API-Key": apiKey } : {};
  const downloaded = [];
  for (const entry of entries) {
    const url = buildViewUrl(base, mode, entry);
    const res = await fetch(url, { headers, redirect: "follow" });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = safeOutPath(outdir, entry);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, buf);
    downloaded.push(outPath);
  }
  return downloaded;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args["mode"];
  if (!mode || (mode !== "local" && mode !== "cloud")) {
    console.error("--mode local|cloud is required");
    process.exit(2);
  }

  const base = (args["base-url"] || "http://127.0.0.1:8188").replace(/\/$/, "");
  const workflowPath = args["workflow"];
  if (!workflowPath) {
    console.error("--workflow <path> is required");
    process.exit(2);
  }

  const apiKey = args["api-key"] || process.env.COMFY_API_KEY;
  if (mode === "cloud" && !apiKey) {
    console.error("Missing API key for cloud mode. Use --api-key or COMFY_API_KEY.");
    process.exit(2);
  }

  const number = Number(args["number"] || 1);
  const outdir = args["outdir"] || "./comfy_outputs";
  const pollInterval = Number(args["poll-interval"] || 2) * 1000;
  const timeoutMs = Number(args["timeout"] || 600) * 1000;
  const noWait = Boolean(args["no-wait"]);
  const dryRun = Boolean(args["dry-run"]);

  const workflow = await loadWorkflow(workflowPath);

  if (dryRun) {
    const payload = mode === "cloud" ? { prompt: workflow, number } : { prompt: workflow };
    console.log("[DRY RUN] Submit payload:");
    console.log(JSON.stringify(payload, null, 2).slice(0, 4000));
    process.exit(0);
  }

  const promptId = await submitWorkflow(base, mode, workflow, apiKey, number);
  console.log(`Submitted. prompt_id=${promptId}`);

  if (noWait) process.exit(0);

  const start = Date.now();
  let entries = [];
  while (true) {
    const history = await fetchHistory(base, mode, promptId, apiKey);
    const found = [];
    collectFileEntries(history, found);
    entries = dedupeFiles(found);
    if (entries.length) break;
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for outputs");
    await sleep(pollInterval);
  }

  await fs.mkdir(outdir, { recursive: true });
  const downloaded = await downloadOutputs(base, mode, entries, apiKey, outdir);
  console.log("Downloaded:");
  for (const p of downloaded) console.log(`- ${p}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
