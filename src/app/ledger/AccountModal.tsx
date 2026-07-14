"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, Check, RefreshCw } from "lucide-react";

const C = {
  pageBg: "#1F3329", pageBgSoft: "#28402F", paper: "#F6F1E4",
  paperSoft: "#EDE6D3", ink: "#2B2A22", inkSoft: "#6B6754",
  cream: "#F3EFE0", sageOnDark: "#9CB29F", gold: "#C79A3D",
  goldSoft: "#E4C878", sage: "#5C8A5A", rust: "#B23B2E",
};

export default function AccountModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter();
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetch("/api/account/token")
      .then((r) => r.json())
      .then((d) => setApiToken(d.apiToken))
      .catch(() => {});
  }, []);

  const copyToken = () => {
    if (!apiToken) return;
    navigator.clipboard.writeText(apiToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rotateToken = async () => {
    setRotating(true);
    try {
      const res = await fetch("/api/account/token", { method: "POST" });
      const data = await res.json();
      setApiToken(data.apiToken);
    } catch { /* ignore */ }
    setRotating(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ text: "Password updated!", ok: true });
        setCurrentPw(""); setNewPw("");
      } else {
        setPwMsg({ text: data.error ?? "Error", ok: false });
      }
    } catch {
      setPwMsg({ text: "Network error", ok: false });
    }
    setPwLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-2xl p-5 pb-8 space-y-5"
        style={{ background: C.paper, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-display text-base" style={{ color: C.ink }}>Account</span>
          <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
        </div>

        {/* List name */}
        <div>
          <div className="font-body text-[11px] uppercase tracking-wide mb-1" style={{ color: C.inkSoft }}>List name</div>
          <div className="font-body text-sm rounded-lg px-3 py-2" style={{ background: C.paperSoft, color: C.ink }}>{slug}</div>
        </div>

        {/* API Token */}
        <div>
          <div className="font-body text-[11px] uppercase tracking-wide mb-1" style={{ color: C.inkSoft }}>Agent API token</div>
          <p className="font-body text-[11px] mb-2" style={{ color: C.inkSoft }}>
            Use this bearer token to call <code style={{ background: C.paperSoft, padding: "1px 4px", borderRadius: 4 }}>POST /api/agent</code> from any AI agent or script. Rate limited to 30 req/min.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono-ledger text-[11px] rounded-lg px-2.5 py-2 truncate"
              style={{ background: C.pageBg, color: C.sageOnDark }}>
              {apiToken ?? "loading..."}
            </div>
            <button onClick={copyToken} title="Copy" className="p-2 rounded-lg" style={{ background: C.paperSoft }}>
              {copied ? <Check size={14} color={C.sage} /> : <Copy size={14} color={C.inkSoft} />}
            </button>
            <button onClick={rotateToken} title="Rotate token" disabled={rotating}
              className="p-2 rounded-lg" style={{ background: C.paperSoft }}>
              <RefreshCw size={14} color={rotating ? C.inkSoft : C.rust}
                style={{ animation: rotating ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          {rotating && <p className="font-body text-[11px] mt-1" style={{ color: C.inkSoft }}>Rotating… old token is now invalid.</p>}
        </div>

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="space-y-2">
          <div className="font-body text-[11px] uppercase tracking-wide" style={{ color: C.inkSoft }}>Change password</div>
          <input type="password" placeholder="Current password" value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)} required
            className="font-body text-sm rounded-lg px-3 py-2 w-full"
            style={{ background: C.paperSoft, color: C.ink, border: "none" }} />
          <input type="password" placeholder="New password (min 4 chars)" value={newPw}
            onChange={(e) => setNewPw(e.target.value)} required
            className="font-body text-sm rounded-lg px-3 py-2 w-full"
            style={{ background: C.paperSoft, color: C.ink, border: "none" }} />
          {pwMsg && (
            <p className="font-body text-[11px]" style={{ color: pwMsg.ok ? C.sage : C.rust }}>{pwMsg.text}</p>
          )}
          <button type="submit" disabled={pwLoading}
            className="w-full rounded-xl py-2 font-body text-sm font-semibold"
            style={{ background: C.gold, color: C.pageBg, opacity: pwLoading ? 0.6 : 1 }}>
            {pwLoading ? "Saving…" : "Update password"}
          </button>
        </form>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full rounded-xl py-2 font-body text-sm"
          style={{ background: C.paperSoft, color: C.rust }}>
          Sign out
        </button>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
