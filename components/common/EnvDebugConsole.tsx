"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __LEMO_ENV_DEBUG_PRINTED__?: boolean;
  }
}

type ConnectionCheck = {
  status: "success" | "error" | "skipped";
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

type DebugEnvResponse = {
  message?: string;
  report?: {
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
};

function printSection(title: string, values: Record<string, unknown>) {
  console.group(title);
  Object.entries(values).forEach(([key, value]) => {
    console.log(`${key}:`, value);
  });
  console.groupEnd();
}

export default function EnvDebugConsole() {
  useEffect(() => {
    const shouldPrint =
      process.env.NODE_ENV !== "production" || window.localStorage.getItem("__DEBUG_ENV__") === "1";
    if (!shouldPrint) return;

    if (window.__LEMO_ENV_DEBUG_PRINTED__) return;
    window.__LEMO_ENV_DEBUG_PRINTED__ = true;

    let disposed = false;

    const printDebugInfo = async () => {
      try {
        const response = await fetch("/api/debug-env", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn(`[Env Debug] 请求失败: ${response.status} ${response.statusText}`);
          return;
        }

        const data = (await response.json()) as DebugEnvResponse;
        if (disposed || !data.report) return;

        console.group("🧪 Lemon8 AI Studio - 环境变量调试信息");
        if (data.message) console.log(data.message);

        printSection("📊 Supabase 数据库配置", data.report.supabase);
        printSection("📦 对象存储配置", data.report.storage);
        printSection("🚀 项目配置", data.report.project);
        printSection("🤖 AI API 配置状态", data.report.ai);
        printSection("🔐 Session 配置", data.report.session);

        console.group("🔌 连接测试");
        console.log("数据库:", `${data.report.checks.database.status} - ${data.report.checks.database.message}`);
        if (data.report.checks.database.code) {
          console.log("数据库错误码:", data.report.checks.database.code);
        }
        if (data.report.checks.database.details) {
          console.log("数据库详情:", data.report.checks.database.details);
        }

        console.log("对象存储:", `${data.report.checks.storage.status} - ${data.report.checks.storage.message}`);
        if (data.report.checks.storage.code) {
          console.log("对象存储错误码:", data.report.checks.storage.code);
        }
        if (data.report.checks.storage.details) {
          console.log("对象存储详情:", data.report.checks.storage.details);
        }
        console.groupEnd();

        console.groupEnd();
      } catch (error) {
        if (!disposed) {
          console.warn("[Env Debug] 获取环境变量调试信息失败:", error);
        }
      }
    };

    void printDebugInfo();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
