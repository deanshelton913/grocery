"use client";
import { useState, useEffect } from "react";
import { ChefHat, RefreshCw, Sparkles, AlertCircle, Clock, ShoppingBasket, X } from "lucide-react";
import type { Trip } from "@/lib/types";
import type { MealSuggestion } from "@/lib/db";

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

type Meal = MealSuggestion;

function MealCard({ meal, onDismiss }: { meal: Meal; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissing(true);
    await fetch(`/api/suggest?id=${meal.id}`, { method: "DELETE" });
    onDismiss(meal.id);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: C.paper, opacity: dismissing ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      {/* Header row: expand area + dismiss button side by side */}
      <div className="flex items-start px-4 pt-4 pb-3">
        {/* Clickable expand area */}
        <button onClick={() => setExpanded((e) => !e)} className="flex-1 text-left min-w-0">
          <div className="flex items-start justify-between gap-2 pr-1">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[16px] leading-tight" style={{ color: C.ink }}>
                {meal.name}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Clock size={11} color={C.inkSoft} />
                <span className="font-body text-[11px]" style={{ color: C.inkSoft }}>
                  {meal.time}
                </span>
                <span className="font-body text-[11px] mx-1" style={{ color: C.inkSoft }}>
                  ·
                </span>
                <ShoppingBasket size={11} color={C.inkSoft} />
                <span className="font-body text-[11px]" style={{ color: C.inkSoft }}>
                  {meal.uses.length} pantry item{meal.uses.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <span
              className="font-body text-[11px] rounded-full px-2 py-0.5 flex-shrink-0 mt-0.5"
              style={{ background: `${C.gold}22`, color: C.gold }}
            >
              {expanded ? "Hide" : "Recipe"}
            </span>
          </div>

          {/* Pantry items used — always visible */}
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.uses.map((item) => (
              <span
                key={item}
                className="font-body text-[10px] rounded-full px-2 py-0.5"
                style={{ background: `${C.sage}18`, color: C.sage }}
              >
                {item}
              </span>
            ))}
          </div>
        </button>

        {/* Dismiss — sits outside the expand button */}
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="rounded-full p-1 flex-shrink-0 ml-1 mt-0.5"
          style={{ background: `${C.inkSoft}18`, color: C.inkSoft }}
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      {/* Expanded recipe */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px dashed ${C.inkSoft}44` }}>
          {/* Ingredients */}
          <div className="pt-3">
            <div
              className="font-body text-[10px] uppercase tracking-wide mb-2"
              style={{ color: C.inkSoft }}
            >
              Ingredients
            </div>
            <ul className="space-y-1">
              {meal.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 font-body text-xs"
                  style={{ color: C.ink }}
                >
                  <span
                    className="flex-shrink-0 w-1 h-1 rounded-full mt-1.5"
                    style={{ background: C.gold }}
                  />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          <div>
            <div
              className="font-body text-[10px] uppercase tracking-wide mb-2"
              style={{ color: C.inkSoft }}
            >
              Instructions
            </div>
            <ol className="space-y-2">
              {meal.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="font-mono-ledger text-[10px] rounded flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5"
                    style={{ background: C.pageBgSoft, color: C.sageOnDark }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-body text-xs leading-relaxed" style={{ color: C.ink }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MealsView({ trips }: { trips: Trip[] }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const pendingItems = trips.flatMap((t) => t.items).filter((i) => i.status === "pending");
  const pendingCount = pendingItems.length;

  // Load saved suggestions on mount
  useEffect(() => {
    fetch("/api/suggest")
      .then((r) => r.json())
      .then((d) => setMeals(Array.isArray(d.meals) ? d.meals : []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleDismiss = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const suggest = async () => {
    setMeals([]);
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      if (!Array.isArray(data.meals)) {
        setError("Unexpected response format. Try again.");
        return;
      }

      // Prepend new meals (most recent first)
      setMeals((prev) => [...(data.meals as Meal[]), ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pb-24 pt-3 space-y-4">
      {/* Header card */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: C.paper }}>
        <div className="flex items-center gap-2">
          <ChefHat size={18} color={C.gold} />
          <span className="font-display text-base" style={{ color: C.ink }}>
            Meal suggestions
          </span>
        </div>

        <p className="font-body text-xs leading-relaxed" style={{ color: C.inkSoft }}>
          Based on your{" "}
          <span style={{ color: C.ink, fontWeight: 600 }}>
            {pendingCount} pending item{pendingCount !== 1 ? "s" : ""}
          </span>
          {pendingCount === 0 ? " — add a grocery trip first." : "."}
        </p>

        <div>
          <label
            className="font-body text-[10px] uppercase tracking-wide block mb-1"
            style={{ color: C.inkSoft }}
          >
            Preferences (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. quick weeknight meals, no dairy, kid-friendly…"
            className="font-body text-xs rounded-xl px-3 py-2 w-full"
            style={{ background: C.paperSoft, color: C.ink, border: "none", outline: "none" }}
            disabled={loading}
          />
        </div>

        <button
          onClick={suggest}
          disabled={loading || pendingCount === 0}
          className="w-full rounded-xl py-2.5 font-body text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: loading || pendingCount === 0 ? C.pageBgSoft : C.gold,
            color: loading || pendingCount === 0 ? C.sageOnDark : C.pageBg,
            opacity: pendingCount === 0 ? 0.5 : 1,
          }}
        >
          {loading ? (
            <>
              <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
              Thinking…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {meals.length > 0 ? "Regenerate" : "Suggest meals"}
            </>
          )}
        </button>
      </div>

      {/* Loading skeleton — initial fetch OR generating */}
      {(loading || fetching) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-4 space-y-2"
              style={{ background: C.paper, opacity: 1 - i * 0.15 }}
            >
              <div className="h-4 rounded-lg w-2/3" style={{ background: C.paperSoft }} />
              <div className="h-3 rounded-lg w-1/3" style={{ background: C.paperSoft }} />
              <div className="flex gap-1 mt-2">
                {[60, 80, 70].map((w, j) => (
                  <div
                    key={j}
                    className="h-5 rounded-full"
                    style={{ background: C.paperSoft, width: w }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="rounded-2xl p-3 flex items-start gap-2"
          style={{ background: `${C.rust}15`, border: `1px solid ${C.rust}44` }}
        >
          <AlertCircle size={15} color={C.rust} className="flex-shrink-0 mt-0.5" />
          <span className="font-body text-xs" style={{ color: C.rust }}>
            {error}
          </span>
        </div>
      )}

      {/* Meal cards */}
      {!loading && !fetching && meals.length > 0 && (
        <div className="space-y-3">
          <div className="font-body text-[11px] px-1" style={{ color: C.sageOnDark }}>
            {meals.length} meal suggestion{meals.length !== 1 ? "s" : ""} — tap a card to see the
            recipe
          </div>
          {meals.map((meal, i) => (
            <MealCard key={meal.id ?? i} meal={meal} onDismiss={handleDismiss} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
