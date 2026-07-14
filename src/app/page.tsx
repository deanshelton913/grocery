"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

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
  sage: "#5C8A5A",
  rust: "#B23B2E",
};

type Mode = "login" | "claim";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/claim";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        router.push("/ledger");
      }
    } catch {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: C.pageBg }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Receipt size={22} color={C.gold} />
          <span className="font-display text-2xl tracking-tight" style={{ color: C.cream }}>
            Pantry Ledger
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: C.paper }}>
          {/* Mode toggle */}
          <div className="flex rounded-xl mb-5 p-0.5" style={{ background: C.paperSoft }}>
            {(["login", "claim"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className="flex-1 rounded-xl py-1.5 font-body text-sm font-medium transition-colors"
                style={{
                  background: mode === m ? C.gold : "transparent",
                  color: mode === m ? C.pageBg : C.inkSoft,
                }}
              >
                {m === "login" ? "Sign in" : "Create list"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                className="font-body text-[11px] uppercase tracking-wide block mb-1"
                style={{ color: C.inkSoft }}
              >
                {mode === "claim" ? "Choose a list name" : "List name"}
              </label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={mode === "claim" ? "e.g. smith-family" : "your-list-name"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-body text-sm rounded-lg px-3 py-2.5 w-full"
                style={{ background: C.paperSoft, color: C.ink, border: "none" }}
                required
              />
              {mode === "claim" && (
                <p className="font-body text-[10px] mt-1" style={{ color: C.inkSoft }}>
                  Lowercase letters, numbers, hyphens. This is your shared list identifier.
                </p>
              )}
            </div>

            <div>
              <label
                className="font-body text-[11px] uppercase tracking-wide block mb-1"
                style={{ color: C.inkSoft }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="font-body text-sm rounded-lg px-3 py-2.5 w-full"
                style={{ background: C.paperSoft, color: C.ink, border: "none" }}
                required
              />
              {mode === "claim" && (
                <p className="font-body text-[10px] mt-1" style={{ color: C.inkSoft }}>
                  Share this password with anyone who should access the list.
                </p>
              )}
            </div>

            {error && (
              <p className="font-body text-xs" style={{ color: C.rust }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 font-body text-sm font-semibold mt-1"
              style={{
                background: loading ? C.pageBgSoft : C.gold,
                color: loading ? C.sageOnDark : C.pageBg,
              }}
            >
              {loading ? "..." : mode === "login" ? "Sign in" : "Create my list"}
            </button>
          </form>
        </div>

        <p className="text-center font-body text-[11px] mt-4" style={{ color: C.sageOnDark }}>
          {mode === "login" ? "No account yet? " : "Already have a list? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "claim" : "login");
              setError("");
            }}
            className="underline"
            style={{ color: C.goldSoft }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
