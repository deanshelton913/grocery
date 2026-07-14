"use client";
import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

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
};

function CopyBlock({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <div
        className="font-body text-[10px] uppercase tracking-wide mb-1.5"
        style={{ color: C.inkSoft }}
      >
        {label}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.pageBg }}>
        <pre
          className={`${mono ? "font-mono-ledger" : "font-body"} text-[11px] px-3 py-3 overflow-x-auto whitespace-pre-wrap`}
          style={{ color: C.goldSoft, lineHeight: 1.6, maxHeight: 200, overflowY: "auto" }}
        >
          {value || "loading…"}
        </pre>
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderTop: `1px solid ${C.pageBgSoft}` }}
        >
          <span className="font-body text-[10px]" style={{ color: C.sageOnDark }}>
            {value ? `${value.split("\n").length} lines` : ""}
          </span>
          <button
            onClick={copy}
            disabled={!value}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-[11px] font-semibold"
            style={{
              background: copied ? C.sage : C.gold,
              color: C.pageBg,
              opacity: value ? 1 : 0.4,
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentView() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    fetch(`${o}/api/agent/help`)
      .then((r) => r.text())
      .then(setSystemPrompt)
      .catch(() => {});
    fetch("/api/account/token")
      .then((r) => r.json())
      .then((d) => setApiToken(d.apiToken ?? ""))
      .catch(() => {});
  }, []);

  const mcpConfig = apiToken
    ? JSON.stringify(
        {
          mcpServers: {
            "pantry-ledger": {
              url: `${origin}/api/mcp`,
              headers: { Authorization: `Bearer ${apiToken}` },
            },
          },
        },
        null,
        2
      )
    : "loading…";

  const helpUrl = `${origin}/api/agent/help`;

  return (
    <div className="px-4 pb-24 pt-4 space-y-5">
      {/* System prompt */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: C.paper }}>
        <div className="font-display text-base" style={{ color: C.ink }}>
          System prompt
        </div>
        <p className="font-body text-xs leading-relaxed" style={{ color: C.inkSoft }}>
          Paste this into ChatGPT, Claude, or any AI assistant as the system prompt. It gives the
          agent full access to your grocery list — log receipts from a photo, mark items used or
          wasted, and more.
        </p>
        <CopyBlock label="Paste as system prompt" value={systemPrompt} mono={false} />
        <div className="flex items-center gap-2">
          <span className="font-body text-[11px]" style={{ color: C.inkSoft }}>
            Always up to date:
          </span>
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono-ledger text-[11px]"
            style={{ color: C.goldSoft }}
          >
            {helpUrl} <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* MCP config */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: C.paper }}>
        <div className="font-display text-base" style={{ color: C.ink }}>
          MCP server
        </div>
        <p className="font-body text-xs leading-relaxed" style={{ color: C.inkSoft }}>
          Add this to your{" "}
          <span style={{ color: C.ink, fontWeight: 600 }}>claude_desktop_config.json</span>, Cursor
          MCP settings, or Kiro MCP settings. The agent can then call your grocery list directly
          using native MCP tools.
        </p>
        <CopyBlock label="MCP client config (JSON)" value={mcpConfig} />
      </div>
    </div>
  );
}
