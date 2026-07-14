"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Receipt,
  PieChart,
  Plus,
  History as HistoryIcon,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Minus,
  Circle,
  Pencil,
  AlertTriangle,
  Settings,
} from "lucide-react";
import type { Trip, Item } from "@/lib/types";
import AccountModal from "./AccountModal";

/* ---------------------------------- tokens --------------------------------- */
const COLORS = {
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
  neutral: "#8A8578",
};

const CATEGORIES = [
  { key: "produce", label: "Produce", color: "#6B8E4E" },
  { key: "meat", label: "Meat & Poultry", color: "#7A2E2E" },
  { key: "dairy", label: "Dairy & Eggs", color: "#8FA7B8" },
  { key: "bakery", label: "Bakery & Bread", color: "#C08A4E" },
  { key: "frozen", label: "Frozen", color: "#5D8FA6" },
  { key: "pantry", label: "Pantry & Dry Goods", color: "#B08D57" },
  { key: "snacks", label: "Snacks & Candy", color: "#B4577A" },
  { key: "beverages", label: "Beverages", color: "#3F6E96" },
  { key: "condiments", label: "Condiments & Sauces", color: "#9C6B32" },
  { key: "deli", label: "Deli & Prepared", color: "#7E6089" },
  { key: "household", label: "Household & Non-Food", color: "#726F64" },
  { key: "other", label: "Other", color: "#948C78" },
];
const catByKey = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const STATUS_ORDER: Item["status"][] = ["pending", "used", "partial", "wasted"];
const STATUS = {
  pending: { label: "Pending", color: COLORS.neutral, icon: Circle },
  used: { label: "Used", color: COLORS.sage, icon: Check },
  partial: { label: "Partial", color: COLORS.gold, icon: Minus },
  wasted: { label: "Wasted", color: COLORS.rust, icon: X },
};

/* --------------------------------- helpers --------------------------------- */
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(n) ? n : 0
  );
const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const monthKey = (iso: string) => iso.slice(0, 7);
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  const rules: [string, string[]][] = [
    [
      "produce",
      [
        "onion",
        "lettuce",
        "avocado",
        "strawberr",
        "banana",
        "apple",
        "tomato",
        "potato",
        "green bean",
        "spinach",
        "carrot",
        "pepper",
        "berries",
        "fruit",
        "kale",
        "cucumber",
        "grape",
        "citrus",
        "lemon",
        "lime",
      ],
    ],
    [
      "meat",
      [
        "chicken",
        "beef",
        "turkey",
        "pork",
        "roast",
        "thigh",
        "steak",
        "bacon",
        "sausage",
        "ground",
        "meat",
        "salmon",
        "fish",
        "shrimp",
      ],
    ],
    ["dairy", ["milk", "cheese", "yogurt", "egg", "cream", "butter"]],
    ["bakery", ["bread", "tortilla", "bagel", "muffin", "bun", "roll", "baguette"]],
    ["frozen", ["frozen", "burrito", "pizza roll", "ice cream"]],
    [
      "pantry",
      [
        "tortellini",
        "pasta",
        "rice",
        "canned",
        "salt",
        "sugar",
        "flour",
        "cereal",
        "oat",
        "morsel",
        "coconut milk",
        "beans",
        "sauce jar",
      ],
    ],
    ["snacks", ["chip", "cracker", "candy", "kitkat", "chocolate", "cookie", "popcorn", "pretzel"]],
    ["beverages", ["water", "soda", "juice", "sparkling", "coffee", "tea", "lacroix", "kombucha"]],
    ["condiments", ["mayo", "ketchup", "mustard", "salsa", "dressing", "syrup"]],
    ["deli", ["hummus", "dip", "deli", "meatloaf", "rotisserie", "prepared"]],
    ["household", ["paper towel", "napkin", "detergent", "soap", "foil", "bag", "trash"]],
  ];
  for (const [key, words] of rules) {
    if (words.some((w) => n.includes(w))) return key;
  }
  return "other";
}

function tripItemsTotal(trip: Trip) {
  return trip.items.reduce((s, it) => s + it.price * it.qty, 0);
}
function tripTotal(trip: Trip) {
  return tripItemsTotal(trip) + (trip.fees || 0);
}

/* ------------------------------ small components --------------------------- */
function CategoryDot({ catKey, size = 8 }: { catKey: string; size?: number }) {
  const c = catByKey[catKey] || catByKey.other;
  return (
    <span
      style={{
        width: size,
        height: size,
        background: c.color,
        borderRadius: 999,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

function StatusStamp({
  status,
  onCycle,
  small,
}: {
  status: Item["status"];
  onCycle: () => void;
  small?: boolean;
}) {
  const s = STATUS[status] || STATUS.pending;
  const Icon = s.icon;
  return (
    <button
      onClick={onCycle}
      className={`flex items-center gap-1 rounded-full border font-body ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
      style={{
        borderColor: s.color,
        color: s.color,
        background: `${s.color}1a`,
        transform: status === "wasted" ? "rotate(-2deg)" : "none",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
      title="Tap to update status"
    >
      <Icon size={small ? 11 : 12} strokeWidth={3} />
      {s.label}
    </button>
  );
}

function Header({
  monthTotal,
  monthLabel,
  slug,
  onSettings,
}: {
  monthTotal: number;
  monthLabel: string;
  slug: string;
  onSettings: () => void;
}) {
  return (
    <div className="px-4 pt-5 pb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Receipt size={18} color={COLORS.gold} />
          <span className="font-display text-[19px] tracking-tight" style={{ color: COLORS.cream }}>
            Pantry Ledger
          </span>
        </div>
        <button onClick={onSettings} title="Account settings">
          <Settings size={18} color={COLORS.sageOnDark} />
        </button>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-body text-xs" style={{ color: COLORS.sageOnDark }}>
          {slug} · {monthLabel} spend
        </span>
        <span className="font-mono-ledger text-lg font-semibold" style={{ color: COLORS.goldSoft }}>
          {money(monthTotal)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------- dashboard -------------------------------- */
function DashboardView({ trips, goToHistory }: { trips: Trip[]; goToHistory: () => void }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const allItems = useMemo(
    () =>
      trips.flatMap((t) =>
        t.items.map((it) => ({ ...it, tripDate: t.date, tripId: t.id, store: t.store }))
      ),
    [trips]
  );
  const totalSpend = trips.reduce((s, t) => s + tripTotal(t), 0);
  const thisMonthSpend = trips
    .filter((t) => monthKey(t.date) === thisMonth)
    .reduce((s, t) => s + tripTotal(t), 0);
  const lastMonthSpend = trips
    .filter((t) => monthKey(t.date) === lastMonth)
    .reduce((s, t) => s + tripTotal(t), 0);
  const delta =
    lastMonthSpend > 0 ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : null;

  const wastedTotal = allItems.reduce((s, it) => {
    if (it.status === "wasted") return s + it.price * it.qty;
    if (it.status === "partial") return s + it.price * it.qty * 0.5;
    return s;
  }, 0);
  const wastePct = totalSpend > 0 ? (wastedTotal / totalSpend) * 100 : 0;
  const pendingCount = allItems.filter((it) => it.status === "pending").length;

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    allItems.forEach((it) => {
      map[it.category || "other"] = (map[it.category || "other"] || 0) + it.price * it.qty;
    });
    return CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      total: map[c.key] || 0,
    }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allItems]);

  const topWasted = useMemo(() => {
    const map: Record<string, { name: string; lost: number; times: number; category: string }> = {};
    allItems.forEach((it) => {
      if (it.status !== "wasted" && it.status !== "partial") return;
      const key = it.name.trim().toLowerCase();
      const lost = it.price * it.qty * (it.status === "partial" ? 0.5 : 1);
      if (!map[key]) map[key] = { name: it.name, lost: 0, times: 0, category: it.category };
      map[key].lost += lost;
      map[key].times += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.lost - a.lost)
      .slice(0, 5);
  }, [allItems]);

  return (
    <div className="px-4 pb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-3" style={{ background: COLORS.paper }}>
          <div
            className="font-body text-[11px] uppercase tracking-wide"
            style={{ color: COLORS.inkSoft }}
          >
            All-time spend
          </div>
          <div
            className="font-mono-ledger text-xl font-semibold mt-0.5"
            style={{ color: COLORS.ink }}
          >
            {money(totalSpend)}
          </div>
          {delta !== null && (
            <div
              className="font-body text-[11px] mt-1"
              style={{ color: delta > 0 ? COLORS.rust : COLORS.sage }}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(0)}% vs last month
            </div>
          )}
        </div>
        <div className="rounded-2xl p-3" style={{ background: COLORS.paper }}>
          <div
            className="font-body text-[11px] uppercase tracking-wide"
            style={{ color: COLORS.inkSoft }}
          >
            Wasted
          </div>
          <div
            className="font-mono-ledger text-xl font-semibold mt-0.5"
            style={{ color: COLORS.rust }}
          >
            {money(wastedTotal)}
          </div>
          <div className="font-body text-[11px] mt-1" style={{ color: COLORS.inkSoft }}>
            {wastePct.toFixed(1)}% of spend
          </div>
        </div>
      </div>

      {pendingCount > 0 && (
        <button
          onClick={goToHistory}
          className="w-full rounded-2xl p-3 flex items-center gap-2 text-left"
          style={{ background: COLORS.pageBgSoft, border: `1px solid ${COLORS.gold}55` }}
        >
          <AlertTriangle size={16} color={COLORS.gold} className="flex-shrink-0" />
          <span className="font-body text-xs" style={{ color: COLORS.cream }}>
            <span className="font-semibold" style={{ color: COLORS.goldSoft }}>
              {pendingCount} item{pendingCount === 1 ? "" : "s"}
            </span>{" "}
            waiting to be marked used or wasted — review in History.
          </span>
        </button>
      )}

      <div className="rounded-2xl p-3" style={{ background: COLORS.paper }}>
        <div
          className="font-body text-[11px] uppercase tracking-wide mb-2"
          style={{ color: COLORS.inkSoft }}
        >
          Spend by category
        </div>
        {categoryData.length === 0 ? (
          <div className="font-body text-xs py-4 text-center" style={{ color: COLORS.inkSoft }}>
            Log a trip to see your breakdown.
          </div>
        ) : (
          <div style={{ width: "100%", height: Math.max(140, categoryData.length * 28) }}>
            <ResponsiveContainer>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fontSize: 10.5, fill: COLORS.ink, fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => money(Number(v ?? 0))}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.paperSoft}`,
                  }}
                />
                <Bar
                  dataKey="total"
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  shape={(props: {
                    x?: number;
                    y?: number;
                    width?: number;
                    height?: number;
                    color?: string;
                  }) => {
                    const { x = 0, y = 0, width = 0, height = 0, color } = props;
                    return (
                      <rect x={x} y={y} width={width} height={height} fill={color} rx={6} ry={6} />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl p-3" style={{ background: COLORS.paper }}>
        <div
          className="font-body text-[11px] uppercase tracking-wide mb-2"
          style={{ color: COLORS.inkSoft }}
        >
          Most wasted items
        </div>
        {topWasted.length === 0 ? (
          <div className="font-body text-xs py-4 text-center" style={{ color: COLORS.inkSoft }}>
            Nothing marked wasted yet. Update items in History as you use them up.
          </div>
        ) : (
          <div className="space-y-2">
            {topWasted.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between font-body text-xs"
                style={{ color: COLORS.ink }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <CategoryDot catKey={w.category} />
                  <span className="truncate">{w.name}</span>
                  <span style={{ color: COLORS.inkSoft }}>×{w.times}</span>
                </div>
                <span
                  className="font-mono-ledger font-semibold flex-shrink-0 ml-2"
                  style={{ color: COLORS.rust }}
                >
                  {money(w.lost)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- editable item row ---------------------------- */
function EditableItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: Item & { _touched?: boolean };
  onChange: (next: Item & { _touched?: boolean }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1.5 items-center mb-1.5">
      <input
        value={item.name}
        onChange={(e) =>
          onChange({
            ...item,
            name: e.target.value,
            category: item._touched ? item.category : guessCategory(e.target.value),
          })
        }
        placeholder="Item name"
        className="font-body text-xs rounded-lg px-2 py-1.5 flex-1 min-w-0"
        style={{ background: COLORS.paperSoft, color: COLORS.ink, border: "none", outline: "none" }}
      />
      <select
        value={item.category}
        onChange={(e) => onChange({ ...item, category: e.target.value, _touched: true })}
        className="font-body text-[10px] rounded-lg px-1 py-1.5 flex-shrink-0"
        style={{
          background: COLORS.paperSoft,
          color: COLORS.ink,
          border: "none",
          outline: "none",
          width: 64,
        }}
      >
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        value={item.qty}
        onChange={(e) => onChange({ ...item, qty: Number(e.target.value) || 1 })}
        className="font-mono-ledger text-xs rounded-lg px-1 py-1.5 flex-shrink-0 text-center"
        style={{
          background: COLORS.paperSoft,
          color: COLORS.ink,
          border: "none",
          outline: "none",
          width: 34,
        }}
      />
      <input
        type="number"
        step="0.01"
        min="0"
        value={item.price}
        onChange={(e) => onChange({ ...item, price: Number(e.target.value) || 0 })}
        className="font-mono-ledger text-xs rounded-lg px-1.5 py-1.5 flex-shrink-0 text-right"
        style={{
          background: COLORS.paperSoft,
          color: COLORS.ink,
          border: "none",
          outline: "none",
          width: 56,
        }}
      />
      <button onClick={onRemove} className="flex-shrink-0 p-1" style={{ color: COLORS.rust }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* -------------------------------- log trip --------------------------------- */
function LogTripView({
  onSave,
  existingStores,
}: {
  onSave: (t: Trip) => void;
  existingStores: string[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [store, setStore] = useState("");
  const [date, setDate] = useState(today);
  const [fees, setFees] = useState("");
  const [items, setItems] = useState<(Item & { _touched?: boolean })[]>([
    { id: uid("new"), name: "", category: "other", price: 0, qty: 1, status: "pending" },
  ]);
  const [savedFlash, setSavedFlash] = useState(false);

  const addRow = () =>
    setItems((prev) => [
      ...prev,
      { id: uid("new"), name: "", category: "other", price: 0, qty: 1, status: "pending" },
    ]);
  const updateRow = (id: string, next: Item & { _touched?: boolean }) =>
    setItems((prev) => prev.map((it) => (it.id === id ? next : it)));
  const removeRow = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const runningTotal =
    items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0) +
    (Number(fees) || 0);
  const canSave = store.trim() && items.some((it) => it.name.trim());

  const handleSave = () => {
    if (!canSave) return;
    const cleanItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        id: uid("item"),
        name: it.name.trim(),
        category: it.category || "other",
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 1,
        status: "pending" as const,
      }));
    onSave({
      id: uid("trip"),
      store: store.trim(),
      date,
      fees: Number(fees) || 0,
      items: cleanItems,
    });
    setStore("");
    setDate(today);
    setFees("");
    setItems([
      { id: uid("new"), name: "", category: "other", price: 0, qty: 1, status: "pending" },
    ]);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <div className="px-4 pb-24 space-y-3">
      <div className="rounded-2xl p-3.5" style={{ background: COLORS.paper }}>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label
              className="font-body text-[10px] uppercase tracking-wide block mb-1"
              style={{ color: COLORS.inkSoft }}
            >
              Store
            </label>
            <input
              list="store-suggestions"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="e.g. Costco"
              className="font-body text-sm rounded-lg px-2.5 py-2 w-full"
              style={{
                background: COLORS.paperSoft,
                color: COLORS.ink,
                border: "none",
                outline: "none",
              }}
            />
            <datalist id="store-suggestions">
              {existingStores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div style={{ width: 130 }}>
            <label
              className="font-body text-[10px] uppercase tracking-wide block mb-1"
              style={{ color: COLORS.inkSoft }}
            >
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-body text-sm rounded-lg px-2 py-2 w-full"
              style={{
                background: COLORS.paperSoft,
                color: COLORS.ink,
                border: "none",
                outline: "none",
              }}
            />
          </div>
        </div>
        <label
          className="font-body text-[10px] uppercase tracking-wide block mb-1 mt-2"
          style={{ color: COLORS.inkSoft }}
        >
          Items
        </label>
        {items.map((it) => (
          <EditableItemRow
            key={it.id}
            item={it}
            onChange={(next) => updateRow(it.id, next)}
            onRemove={() => removeRow(it.id)}
          />
        ))}
        <button
          onClick={addRow}
          className="font-body text-xs flex items-center gap-1 mt-1 mb-3"
          style={{ color: COLORS.sage }}
        >
          <Plus size={13} /> Add item
        </button>
        <div
          className="flex items-center justify-between gap-2 pt-2"
          style={{ borderTop: `1px dashed ${COLORS.inkSoft}66` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-body text-[11px]" style={{ color: COLORS.inkSoft }}>
              Tax / fees
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="0.00"
              className="font-mono-ledger text-xs rounded-lg px-1.5 py-1 text-right"
              style={{
                background: COLORS.paperSoft,
                color: COLORS.ink,
                border: "none",
                outline: "none",
                width: 56,
              }}
            />
          </div>
          <div className="font-mono-ledger text-base font-semibold" style={{ color: COLORS.ink }}>
            {money(runningTotal)}
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-2xl py-3 font-body text-sm font-semibold"
        style={{
          background: canSave ? COLORS.gold : COLORS.pageBgSoft,
          color: canSave ? COLORS.pageBg : COLORS.sageOnDark,
          opacity: canSave ? 1 : 0.6,
        }}
      >
        {savedFlash ? "Trip saved ✓" : "Save trip"}
      </button>
    </div>
  );
}

/* ------------------------------ receipt card ------------------------------- */
function ReceiptCard({
  trip,
  expanded,
  onToggle,
  onCycleStatus,
  onDelete,
  onEditTrip,
}: {
  trip: Trip;
  expanded: boolean;
  onToggle: () => void;
  onCycleStatus: (tripId: string, itemId: string) => void;
  onDelete: (tripId: string) => void;
  onEditTrip: (t: Trip) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Trip>(trip);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    setDraft(trip);
  }, [trip]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(trip);
    setEditing(true);
  };
  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditTrip({ ...draft, fees: Number(draft.fees) || 0 });
    setEditing(false);
  };
  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  };

  const updateDraftItem = (id: string, next: Item) =>
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? next : it)) }));
  const removeDraftItem = (id: string) =>
    setDraft((d) => ({
      ...d,
      items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items,
    }));
  const addDraftItem = () =>
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        { id: uid("item"), name: "", category: "other", price: 0, qty: 1, status: "pending" },
      ],
    }));

  return (
    <div className="relative mb-5" style={{ paddingBottom: 10 }}>
      <div
        className="rounded-t-2xl rounded-b-md overflow-hidden torn-bottom"
        style={{ background: COLORS.paper }}
      >
        <button
          onClick={onToggle}
          className="w-full text-left px-4 pt-3.5 pb-3 flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <div className="font-display text-[15px] truncate" style={{ color: COLORS.ink }}>
              {trip.store}
            </div>
            <div className="font-body text-[11px]" style={{ color: COLORS.inkSoft }}>
              {fmtDate(trip.date)} · {trip.items.length} item{trip.items.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono-ledger text-sm font-semibold" style={{ color: COLORS.ink }}>
              {money(tripTotal(trip))}
            </span>
            {expanded ? (
              <ChevronUp size={16} color={COLORS.inkSoft} />
            ) : (
              <ChevronDown size={16} color={COLORS.inkSoft} />
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4" style={{ borderTop: `1px dashed ${COLORS.inkSoft}55` }}>
            {!editing ? (
              <>
                <div className="pt-3 space-y-2">
                  {trip.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-2 font-mono-ledger text-[12px]"
                      style={{ color: COLORS.ink }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CategoryDot catKey={it.category} />
                        <span className="truncate">
                          {it.name}
                          {it.qty > 1 ? ` ×${it.qty}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span>{money(it.price * it.qty)}</span>
                        <StatusStamp
                          status={it.status}
                          small
                          onCycle={() => onCycleStatus(trip.id, it.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {trip.fees > 0 && (
                  <div
                    className="flex items-center justify-between font-mono-ledger text-[12px] pt-2 mt-2"
                    style={{ color: COLORS.inkSoft, borderTop: `1px dashed ${COLORS.inkSoft}55` }}
                  >
                    <span>Tax / fees</span>
                    <span>{money(trip.fees)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 mt-1">
                  <button
                    onClick={startEdit}
                    className="font-body text-[11px] flex items-center gap-1"
                    style={{ color: COLORS.sage }}
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  {confirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="font-body text-[11px]" style={{ color: COLORS.rust }}>
                        Delete trip?
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(trip.id);
                        }}
                        className="font-body text-[11px] font-semibold"
                        style={{ color: COLORS.rust }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDelete(false);
                        }}
                        className="font-body text-[11px]"
                        style={{ color: COLORS.inkSoft }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingDelete(true);
                      }}
                      className="font-body text-[11px] flex items-center gap-1"
                      style={{ color: COLORS.inkSoft }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="pt-3">
                <div className="flex gap-2 mb-2">
                  <input
                    value={draft.store}
                    onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))}
                    className="font-body text-xs rounded-lg px-2 py-1.5 flex-1"
                    style={{
                      background: COLORS.paperSoft,
                      color: COLORS.ink,
                      border: "none",
                      outline: "none",
                    }}
                  />
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                    className="font-body text-xs rounded-lg px-2 py-1.5"
                    style={{
                      background: COLORS.paperSoft,
                      color: COLORS.ink,
                      border: "none",
                      outline: "none",
                    }}
                  />
                </div>
                {draft.items.map((it) => (
                  <EditableItemRow
                    key={it.id}
                    item={it}
                    onChange={(next) => updateDraftItem(it.id, next)}
                    onRemove={() => removeDraftItem(it.id)}
                  />
                ))}
                <button
                  onClick={addDraftItem}
                  className="font-body text-xs flex items-center gap-1 mt-1 mb-3"
                  style={{ color: COLORS.sage }}
                >
                  <Plus size={13} /> Add item
                </button>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="font-body text-[11px]" style={{ color: COLORS.inkSoft }}>
                    Tax / fees
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.fees}
                    onChange={(e) => setDraft((d) => ({ ...d, fees: Number(e.target.value) }))}
                    className="font-mono-ledger text-xs rounded-lg px-1.5 py-1 text-right"
                    style={{
                      background: COLORS.paperSoft,
                      color: COLORS.ink,
                      border: "none",
                      outline: "none",
                      width: 56,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="flex-1 rounded-lg py-2 font-body text-xs font-semibold"
                    style={{ background: COLORS.gold, color: COLORS.pageBg }}
                  >
                    Save changes
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 rounded-lg py-2 font-body text-xs font-semibold"
                    style={{ background: COLORS.paperSoft, color: COLORS.inkSoft }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryView({
  trips,
  onCycleStatus,
  onDelete,
  onEditTrip,
  expandedId,
  setExpandedId,
}: {
  trips: Trip[];
  onCycleStatus: (t: string, i: string) => void;
  onDelete: (t: string) => void;
  onEditTrip: (t: Trip) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const sorted = useMemo(() => [...trips].sort((a, b) => (a.date < b.date ? 1 : -1)), [trips]);
  if (sorted.length === 0) {
    return (
      <div
        className="px-4 py-10 text-center font-body text-sm"
        style={{ color: COLORS.sageOnDark }}
      >
        No trips logged yet. Tap &quot;Add Trip&quot; to get started.
      </div>
    );
  }
  return (
    <div className="px-4 pb-6 pt-1">
      {sorted.map((trip) => (
        <ReceiptCard
          key={trip.id}
          trip={trip}
          expanded={expandedId === trip.id}
          onToggle={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
          onCycleStatus={onCycleStatus}
          onDelete={onDelete}
          onEditTrip={onEditTrip}
        />
      ))}
    </div>
  );
}

function TabBar({ active, setActive }: { active: string; setActive: (k: string) => void }) {
  const tabs = [
    { key: "dashboard", label: "Overview", icon: PieChart },
    { key: "log", label: "Add Trip", icon: Plus },
    { key: "history", label: "History", icon: HistoryIcon },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center"
      style={{ background: COLORS.pageBg, borderTop: `1px solid ${COLORS.pageBgSoft}` }}
    >
      <div className="flex w-full max-w-md">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
            >
              <Icon
                size={18}
                color={isActive ? COLORS.gold : COLORS.sageOnDark}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className="font-body text-[10px]"
                style={{
                  color: isActive ? COLORS.gold : COLORS.sageOnDark,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- main app --------------------------------- */
export default function LedgerClient({
  initialTrips,
  listId: _listId,
  slug,
}: {
  initialTrips: Trip[];
  listId: string;
  slug: string;
}) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [tab, setTab] = useState("dashboard");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  // Sync a trip to the server
  const syncTrip = useCallback(async (trip: Trip) => {
    await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
  }, []);

  const deleteFromServer = useCallback(async (tripId: string) => {
    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
  }, []);

  // Poll for remote changes every 30s (multi-device sync)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/trips");
        if (res.ok) {
          const data = await res.json();
          setTrips(data.trips);
        }
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const handleAddTrip = (trip: Trip) => {
    setTrips((prev) => [...prev, trip]);
    setExpandedId(trip.id);
    setTab("history");
    syncTrip(trip);
  };

  const handleCycleStatus = (tripId: string, itemId: string) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          items: t.items.map((it) => {
            if (it.id !== itemId) return it;
            const idx = STATUS_ORDER.indexOf(it.status);
            return { ...it, status: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] };
          }),
        };
      });
      const updated = next.find((t) => t.id === tripId);
      if (updated) syncTrip(updated);
      return next;
    });
  };

  const handleDeleteTrip = (tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (expandedId === tripId) setExpandedId(null);
    deleteFromServer(tripId);
  };

  const handleEditTrip = (updatedTrip: Trip) => {
    const clean = {
      ...updatedTrip,
      items: updatedTrip.items
        .filter((it) => it.name.trim())
        .map((it) => ({ ...it, price: Number(it.price) || 0, qty: Number(it.qty) || 1 })),
    };
    setTrips((prev) => prev.map((t) => (t.id === clean.id ? clean : t)));
    syncTrip(clean);
  };

  const existingStores = useMemo(() => Array.from(new Set(trips.map((t) => t.store))), [trips]);
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long" });
  const monthTotal = trips
    .filter((t) => monthKey(t.date) === thisMonth)
    .reduce((s, t) => s + tripTotal(t), 0);

  return (
    <div
      className="min-h-screen"
      style={{ background: COLORS.pageBg, ["--page-bg" as string]: COLORS.pageBg }}
    >
      <div className="max-w-md mx-auto">
        <Header
          monthTotal={monthTotal}
          monthLabel={monthLabel}
          slug={slug}
          onSettings={() => setShowAccount(true)}
        />

        {tab === "dashboard" && (
          <DashboardView trips={trips} goToHistory={() => setTab("history")} />
        )}
        {tab === "log" && <LogTripView onSave={handleAddTrip} existingStores={existingStores} />}
        {tab === "history" && (
          <HistoryView
            trips={trips}
            onCycleStatus={handleCycleStatus}
            onDelete={handleDeleteTrip}
            onEditTrip={handleEditTrip}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
          />
        )}

        <div className="text-center pb-24 pt-1">
          <span className="font-body text-[10px]" style={{ color: `${COLORS.sageOnDark}99` }}>
            Synced across all your devices
          </span>
        </div>
      </div>

      <TabBar active={tab} setActive={setTab} />

      {showAccount && <AccountModal slug={slug} onClose={() => setShowAccount(false)} />}
    </div>
  );
}
