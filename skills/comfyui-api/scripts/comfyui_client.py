#!/usr/bin/env python3
"""ComfyUI API client (local server or ComfyUI Cloud).

Supports:
- Submit API-format workflow
- Poll history until outputs exist
- Download outputs via /view or /api/view
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Tuple


def _request(method: str, url: str, headers: Dict[str, str] | None = None, data: bytes | None = None, timeout: int = 30) -> Tuple[int, Dict[str, str], bytes]:
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return resp.getcode(), dict(resp.headers), body


def _json_request(method: str, url: str, headers: Dict[str, str] | None = None, payload: Dict[str, Any] | None = None, timeout: int = 30) -> Dict[str, Any]:
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    _, _, body = _request(method, url, headers=h, data=data, timeout=timeout)
    return json.loads(body.decode("utf-8"))


def _load_workflow(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _collect_file_entries(obj: Any, results: List[Dict[str, Any]]) -> None:
    if isinstance(obj, dict):
        if "filename" in obj and isinstance(obj.get("filename"), str):
            results.append(obj)
        for v in obj.values():
            _collect_file_entries(v, results)
    elif isinstance(obj, list):
        for v in obj:
            _collect_file_entries(v, results)


def _dedupe_files(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for e in entries:
        key = (
            e.get("filename"),
            e.get("subfolder"),
            e.get("type"),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def _safe_out_path(outdir: str, entry: Dict[str, Any]) -> str:
    subfolder = entry.get("subfolder") or ""
    filename = entry.get("filename") or "output.bin"
    filename = os.path.basename(filename)
    if subfolder:
        subfolder = subfolder.strip("/\\")
        path = os.path.join(outdir, subfolder, filename)
    else:
        path = os.path.join(outdir, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def _build_view_url(base: str, mode: str, entry: Dict[str, Any]) -> str:
    params = {"filename": entry.get("filename", "")}
    if entry.get("subfolder"):
        params["subfolder"] = entry.get("subfolder")
    if entry.get("type"):
        params["type"] = entry.get("type")
    if mode == "cloud":
        return f"{base}/api/view?{urllib.parse.urlencode(params)}"
    return f"{base}/view?{urllib.parse.urlencode(params)}"


def submit_workflow(base: str, mode: str, workflow: Dict[str, Any], api_key: str | None, number: int) -> str:
    if mode == "cloud":
        url = f"{base}/api/prompt"
        headers = {"X-API-Key": api_key or ""}
        payload = {"prompt": workflow, "number": number}
    else:
        url = f"{base}/prompt"
        headers = {}
        payload = {"prompt": workflow}
    resp = _json_request("POST", url, headers=headers, payload=payload)
    prompt_id = resp.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"No prompt_id in response: {resp}")
    return str(prompt_id)


def fetch_history(base: str, mode: str, prompt_id: str, api_key: str | None) -> Dict[str, Any]:
    if mode == "cloud":
        url = f"{base}/api/history_v2/{prompt_id}"
        headers = {"X-API-Key": api_key or ""}
    else:
        url = f"{base}/history/{prompt_id}"
        headers = {}
    return _json_request("GET", url, headers=headers)


def download_outputs(base: str, mode: str, entries: List[Dict[str, Any]], api_key: str | None, outdir: str) -> List[str]:
    downloaded = []
    headers = {"X-API-Key": api_key} if (mode == "cloud" and api_key) else {}
    for entry in entries:
        url = _build_view_url(base, mode, entry)
        _, _, body = _request("GET", url, headers=headers)
        out_path = _safe_out_path(outdir, entry)
        with open(out_path, "wb") as f:
            f.write(body)
        downloaded.append(out_path)
    return downloaded


def main() -> int:
    parser = argparse.ArgumentParser(description="ComfyUI API client (local server or ComfyUI Cloud)")
    parser.add_argument("--mode", choices=["local", "cloud"], required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8188", help="Base URL for ComfyUI")
    parser.add_argument("--workflow", required=True, help="Path to API-format workflow JSON")
    parser.add_argument("--api-key", default=os.environ.get("COMFY_API_KEY"), help="Cloud API key (or COMFY_API_KEY env)")
    parser.add_argument("--number", type=int, default=1, help="Cloud only: number of runs")
    parser.add_argument("--outdir", default="./comfy_outputs", help="Output directory")
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Seconds between history polls")
    parser.add_argument("--timeout", type=int, default=600, help="Max seconds to wait for outputs")
    parser.add_argument("--no-wait", action="store_true", help="Submit only, do not wait/download")
    parser.add_argument("--dry-run", action="store_true", help="Validate workflow and print request, no network")

    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    workflow = _load_workflow(args.workflow)

    if args.mode == "cloud" and not args.api_key:
        print("Missing API key for cloud mode. Use --api-key or COMFY_API_KEY.", file=sys.stderr)
        return 2

    if args.dry_run:
        payload = {"prompt": workflow, "number": args.number} if args.mode == "cloud" else {"prompt": workflow}
        print("[DRY RUN] Submit payload:")
        print(json.dumps(payload, indent=2)[:4000])
        return 0

    prompt_id = submit_workflow(base, args.mode, workflow, args.api_key, args.number)
    print(f"Submitted. prompt_id={prompt_id}")

    if args.no_wait:
        return 0

    start = time.time()
    entries: List[Dict[str, Any]] = []
    while True:
        history = fetch_history(base, args.mode, prompt_id, args.api_key)
        found: List[Dict[str, Any]] = []
        _collect_file_entries(history, found)
        entries = _dedupe_files(found)
        if entries:
            break
        if time.time() - start > args.timeout:
            raise TimeoutError("Timed out waiting for outputs")
        time.sleep(args.poll_interval)

    os.makedirs(args.outdir, exist_ok=True)
    downloaded = download_outputs(base, args.mode, entries, args.api_key, args.outdir)
    print("Downloaded:")
    for p in downloaded:
        print(f"- {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
