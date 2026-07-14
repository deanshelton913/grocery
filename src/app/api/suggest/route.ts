/**
 * GET  /api/suggest          — load saved meal suggestions
 * POST /api/suggest          — generate + save new suggestions
 * DELETE /api/suggest?id=<>  — dismiss a suggestion
 *
 * Uses OpenRouter (openrouter.ai) with a free model.
 * Set OPENROUTER_API_KEY in your environment.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTrips, saveMealSuggestions, getMealSuggestions, deleteMealSuggestion } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const meals = await getMealSuggestions(session.listId);
  return NextResponse.json({ meals });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteMealSuggestion(session.listId, id);
  return NextResponse.json({ ok: true });
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Try these in order — first non-rate-limited one wins.
// Avoid reasoning models (nemotron-*-reasoning, thinking variants) — they prepend
// chain-of-thought text before JSON which breaks parsing.
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 503 });
  }

  // Optionally accept a filter from the body (e.g. only use specific items)
  const body = await req.json().catch(() => ({}));
  const preferenceNote: string = body.note ?? "";

  const trips = await getTrips(session.listId);

  // Collect pending items across all trips
  const pendingItems = trips.flatMap((t) =>
    t.items
      .filter((i) => i.status === "pending")
      .map((i) => `${i.name}${i.qty > 1 ? ` (x${i.qty})` : ""}`)
  );

  if (pendingItems.length === 0) {
    return NextResponse.json(
      { error: "No pending items in your pantry. Add a trip first." },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a home chef assistant. Given a list of groceries someone already has, suggest 3-4 practical meals they can make this week.

Respond with ONLY a valid JSON array. No markdown, no explanation, no code fences. Just the raw JSON.

Schema:
[
  {
    "name": "Meal Name",
    "time": "30 min",
    "uses": ["ingredient1", "ingredient2"],
    "ingredients": ["2 cups flour", "1 tsp salt"],
    "steps": ["Step one", "Step two", "Step three"]
  }
]

Rules:
- "uses" lists only items from the provided pantry (exact names)
- "ingredients" is the full ingredient list including quantities
- "steps" are concise numbered instructions (5-8 steps max)
- "time" is total prep + cook time
- Return 3-4 meals, everyday home cooking, practical and realistic`;

  const userMessage = `Here are my groceries (all marked as not yet used):
${pendingItems.map((n) => `- ${n}`).join("\n")}
${preferenceNote ? `\nExtra notes: ${preferenceNote}` : ""}

Suggest meals I can make this week.`;

  // Try each model in order, skip rate-limited ones
  let upstream: Response | null = null;
  let lastError = "";

  for (const model of MODELS) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers.get("origin") ?? "https://grocery-alpha-two.vercel.app",
        "X-Title": "Pantry Ledger",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (res.ok) {
      console.log(`[suggest] using model: ${model}`);
      upstream = res;
      break;
    }

    // 429 = rate limited — try next model
    if (res.status === 429) {
      lastError = `${model} rate limited`;
      console.warn(`[suggest] ${lastError}, trying next model`);
      continue;
    }

    // Any other error — log and try next
    const errText = await res.text();
    lastError = errText;
    console.error(`[suggest] ${model} error:`, errText);
    continue;
  }

  if (!upstream) {
    console.error("[suggest] All models failed:", lastError);
    return NextResponse.json(
      { error: "All free AI models are currently busy. Please try again in a minute." },
      { status: 503 }
    );
  }

  // Parse the response and return structured JSON
  let raw: string;
  try {
    const json = await upstream.json();
    raw = json.choices?.[0]?.message?.content ?? "";
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  // Strip thinking tags, markdown fences, and any text before the JSON array
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // remove <think>...</think> blocks
    .replace(/^```(?:json)?\s*/im, "") // opening fence
    .replace(/\s*```\s*$/m, "") // closing fence
    .trim();

  // Extract just the JSON array — find first [ to last ]
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  let meals: unknown;
  try {
    meals = JSON.parse(cleaned);
  } catch {
    console.error("[suggest] JSON parse failed, raw:", cleaned.slice(0, 300));
    return NextResponse.json(
      { error: "AI returned unexpected format. Try again.", raw: cleaned },
      { status: 502 }
    );
  }

  // Persist to DB
  let saved;
  try {
    saved = await saveMealSuggestions(
      session.listId,
      (meals as Array<Record<string, unknown>>).map((m) => ({
        name: String(m.name ?? ""),
        time: String(m.time ?? ""),
        uses: Array.isArray(m.uses) ? (m.uses as string[]) : [],
        ingredients: Array.isArray(m.ingredients) ? (m.ingredients as string[]) : [],
        steps: Array.isArray(m.steps) ? (m.steps as string[]) : [],
      }))
    );
  } catch (e) {
    console.error("[suggest] DB save failed:", e);
    // Return the meals anyway even if DB save fails
    return NextResponse.json({ meals });
  }

  return NextResponse.json({ meals: saved });
}
