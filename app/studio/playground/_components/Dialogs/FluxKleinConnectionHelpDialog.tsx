"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { probeDirectComfyAvailability } from "@/lib/comfyui/browser-client";
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert } from "lucide-react";

type FluxKleinConnectionHelpDialogProps = {
  open: boolean;
  comfyUrl?: string;
  technicalReason?: string;
  onOpenChange: (open: boolean) => void;
};

export default function FluxKleinConnectionHelpDialog({
  open,
  comfyUrl,
  technicalReason,
  onOpenChange,
}: FluxKleinConnectionHelpDialogProps) {
  const [status, setStatus] = useState<"instructions" | "checking" | "success">("instructions");
  const [shouldVerifyOnReturn, setShouldVerifyOnReturn] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStatus("instructions");
      setShouldVerifyOnReturn(false);
      setVerificationError(null);
      isCheckingRef.current = false;
      return;
    }

    setStatus("instructions");
    setShouldVerifyOnReturn(false);
    setVerificationError(null);
    isCheckingRef.current = false;
  }, [open, comfyUrl]);

  const verifyConnection = useCallback(async () => {
    if (!comfyUrl || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setStatus("checking");
    setVerificationError(null);

    try {
      const result = await probeDirectComfyAvailability({ comfyUrl });
      if (result.available) {
        setStatus("success");
        setShouldVerifyOnReturn(false);
        return;
      }

      setStatus("instructions");
      setVerificationError(result.reason || "暂时还没有检测到 ComfyUI 连通。");
    } catch (error) {
      setStatus("instructions");
      setVerificationError(error instanceof Error ? error.message : "暂时还没有检测到 ComfyUI 连通。");
    } finally {
      isCheckingRef.current = false;
    }
  }, [comfyUrl]);

  useEffect(() => {
    if (!open || !shouldVerifyOnReturn) return;

    const handleFocus = () => {
      void verifyConnection();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifyConnection();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [open, shouldVerifyOnReturn, verifyConnection]);

  const handleOpenLink = () => {
    if (!comfyUrl) return;
    setShouldVerifyOnReturn(true);
    setVerificationError(null);
    window.open(comfyUrl, "_blank", "noopener,noreferrer");
  };

  const isSuccess = status === "success";
  const isChecking = status === "checking";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border border-white/10 bg-[#101114]/95 p-0 text-white shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isSuccess ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-white">
                  {isSuccess ? "连接成功啦" : "首次使用Fluxklein"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/60">
                  {isSuccess ? "浏览器已经可以访问 Fluxklein，对这台机器后续一般不用重复操作。" : ""}
                </DialogDescription>
                {!isSuccess && (technicalReason || verificationError) ? (
                  <p className="mt-2 text-xs text-amber-200/80">
                    {verificationError || technicalReason}
                  </p>
                ) : null}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-3">
          <div className={`rounded-2xl border p-4 text-sm leading-6 ${isSuccess ? "border-emerald-400/20 bg-emerald-400/10 text-white/85" : "border-amber-400/20 bg-amber-400/10 text-white/80"}`}>
            {isSuccess
              ? "已经检测到浏览器可以连上 Fluxklein 了。后面你可以直接回来用，不需要再重复打开这个链接。"
              : "浏览器第一次连Fluxklein，会默认拦一下，按下面操作打开一下链接就行～"}
          </div>

          {!isSuccess ? (
            <div className="mx-auto max-w-sm overflow-hidden rounded-[20px] border border-white/5">
              <NextImage
                src="/assets/20260319-163108.jpeg"
                alt=""
                width={960}
                height={1430}
                unoptimized
                className="block h-auto w-full"
              />
            </div>
          ) : null}

          <div className="space-y-3 text-sm leading-6 text-white/75">
            <p>{isSuccess ? "下一步：" : "处理步骤："}</p>
            {isSuccess ? (
              <ol className="list-decimal space-y-2 pl-5 text-white/80">
                <li>关掉这个弹窗。</li>
                <li>回到当前页面，直接点击“生成”。</li>
                <li>后续一般就不用重复做这一步了，可以直接用。</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-white/80">
                <li>点击下面按钮的链接进行跳转。</li>
                <li>如果浏览器出现“不安全”或“您的连接不是私密连接”，点击“高级”，然后点击“继续前往”。</li>
                <li>完成后回到当前页面，弹窗会自动帮你检查一次。</li>
                <li>检查通过后，后续就不需要重复操作了～</li>
              </ol>
            )}
          </div>



          <div className="flex w-full pb-4 flex-col mx-auto gap-3 sm:flex-row sm:justify-end">
            {isSuccess ? (
              <Button
                type="button"
                className="bg-white text-black w-full hover:bg-primary"
                onClick={() => onOpenChange(false)}
              >
                知道了，继续使用
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    void verifyConnection();
                  }}
                  disabled={!comfyUrl || isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在检查
                    </>
                  ) : (
                    "我已处理，重新检查"
                  )}
                </Button>
                <Button
                  type="button"
                  className="bg-white text-black w-full hover:bg-primary"
                  onClick={handleOpenLink}
                  disabled={!comfyUrl}
                >
                  打开链接
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
