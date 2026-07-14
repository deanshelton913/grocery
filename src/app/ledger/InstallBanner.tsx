"use client";
import { useState, useEffect } from "react";
import { X, Share, MoreVertical, Plus } from "lucide-react";

const C = {
  pageBg: "#1F3329",
  pageBgSoft: "#28402F",
  paper: "#F6F1E4",
  paperSoft: "#EDE6D3",
  ink: "#2B2A22",
  inkSoft: "#6B6754",
  cream: "#F3EFE0",
  sageOnDark: "#9CB29F",
  gold: "#C79A3D",
  goldSoft: "#E4C878",
};

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}

export default function InstallBanner({ apiToken }: { apiToken: string }) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA or dismissed before
    if (isStandalone()) return;
    if (localStorage.getItem("install-banner-dismissed")) return;

    if (isIOS()) setPlatform("ios");
    else if (isAndroid()) setPlatform("android");
    // On desktop: don't show the banner — instructions are only meaningful on mobile
    else return;

    // Small delay so it doesn't flash on mount
    setTimeout(() => setShow(true), 1200);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("install-banner-dismissed", "1");
  };

  const shareLink = `${window.location.origin}/join/${apiToken}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-4 shadow-2xl"
        style={{
          background: C.paper,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="font-display text-[15px]" style={{ color: C.ink }}>
            Add to your home screen
          </div>
          <button onClick={dismiss} className="p-0.5 -mt-0.5 -mr-0.5" style={{ color: C.inkSoft }}>
            <X size={16} />
          </button>
        </div>

        {/* Instructions */}
        {platform === "ios" && (
          <div className="space-y-2 mb-3">
            <div className="font-body text-xs leading-relaxed" style={{ color: C.inkSoft }}>
              Open this page in Safari, then:
            </div>
            <div className="flex items-center gap-2 font-body text-xs" style={{ color: C.ink }}>
              <span
                className="rounded-lg px-1.5 py-0.5 flex-shrink-0"
                style={{ background: C.pageBgSoft, color: C.sageOnDark }}
              >
                1
              </span>
              Tap the{" "}
              <Share size={13} style={{ display: "inline", margin: "0 2px" }} /> Share button at the
              bottom
            </div>
            <div className="flex items-center gap-2 font-body text-xs" style={{ color: C.ink }}>
              <span
                className="rounded-lg px-1.5 py-0.5 flex-shrink-0"
                style={{ background: C.pageBgSoft, color: C.sageOnDark }}
              >
                2
              </span>
              Scroll down and tap{" "}
              <strong>&quot;Add to Home Screen&quot;</strong>{" "}
              <Plus size={12} style={{ display: "inline" }} />
            </div>
          </div>
        )}

        {platform === "android" && (
          <div className="space-y-2 mb-3">
            <div className="font-body text-xs leading-relaxed" style={{ color: C.inkSoft }}>
              In Chrome:
            </div>
            <div className="flex items-center gap-2 font-body text-xs" style={{ color: C.ink }}>
              <span
                className="rounded-lg px-1.5 py-0.5 flex-shrink-0"
                style={{ background: C.pageBgSoft, color: C.sageOnDark }}
              >
                1
              </span>
              Tap the <MoreVertical size={13} style={{ display: "inline", margin: "0 2px" }} /> menu
              in the top-right corner
            </div>
            <div className="flex items-center gap-2 font-body text-xs" style={{ color: C.ink }}>
              <span
                className="rounded-lg px-1.5 py-0.5 flex-shrink-0"
                style={{ background: C.pageBgSoft, color: C.sageOnDark }}
              >
                2
              </span>
              Tap <strong>&quot;Add to Home screen&quot;</strong> or{" "}
              <strong>&quot;Install app&quot;</strong>
            </div>
            <div className="flex items-center gap-2 font-body text-xs" style={{ color: C.ink }}>
              <span
                className="rounded-lg px-1.5 py-0.5 flex-shrink-0"
                style={{ background: C.pageBgSoft, color: C.sageOnDark }}
              >
                3
              </span>
              Tap <strong>&quot;Install&quot;</strong> to confirm
            </div>
          </div>
        )}

        {/* Share link */}
        <div
          className="rounded-xl p-2.5 mb-3"
          style={{ background: C.pageBgSoft }}
        >
          <div className="font-body text-[10px] uppercase tracking-wide mb-1" style={{ color: C.sageOnDark }}>
            Share this link — no password needed
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono-ledger text-[10px] flex-1 truncate"
              style={{ color: C.goldSoft }}
            >
              {shareLink}
            </span>
            <button
              onClick={copyLink}
              className="font-body text-[11px] rounded-lg px-2.5 py-1 flex-shrink-0 font-semibold"
              style={{ background: linkCopied ? C.gold : C.pageBg, color: linkCopied ? C.pageBg : C.sageOnDark }}
            >
              {linkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="w-full font-body text-xs py-1"
          style={{ color: C.inkSoft }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
