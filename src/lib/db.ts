/**
 * Data access layer — all queries use the Supabase service role client
 * so they bypass RLS and run purely server-side.
 */
import { supabaseAdmin } from "./supabase";
import type { Trip, Item } from "./types";

/** Auto-guess storage location from category when not explicitly set */
function guessLocation(category: string): string {
  if (category === "frozen") return "freezer";
  if (["meat", "dairy", "produce", "deli"].includes(category)) return "fridge";
  return "pantry";
}

// --------------------------------------------------------------------------
// Trips
// --------------------------------------------------------------------------

export async function getTrips(listId: string): Promise<Trip[]> {
  const db = supabaseAdmin();

  const { data: tripRows, error: tripErr } = await db
    .from("trips")
    .select("id, store, date, fees")
    .eq("list_id", listId)
    .order("date", { ascending: false });

  if (tripErr) throw tripErr;
  if (!tripRows?.length) return [];

  const tripIds = tripRows.map((t) => t.id);

  const { data: itemRows, error: itemErr } = await db
    .from("items")
    .select("id, trip_id, name, category, price, qty, status, location")
    .in("trip_id", tripIds);

  if (itemErr) throw itemErr;

  return tripRows.map((t) => ({
    id: t.id,
    store: t.store,
    date: t.date,
    fees: Number(t.fees),
    items: (itemRows ?? [])
      .filter((it) => it.trip_id === t.id)
      .map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        price: Number(it.price),
        qty: it.qty,
        status: it.status as Item["status"],
        location: (it.location ?? "fridge") as Item["location"],
      })),
  }));
}

export async function upsertTrip(listId: string, trip: Trip): Promise<void> {
  const db = supabaseAdmin();

  const { error: tripErr } = await db.from("trips").upsert({
    id: trip.id,
    list_id: listId,
    store: trip.store,
    date: trip.date,
    fees: trip.fees,
    updated_at: new Date().toISOString(),
  });
  if (tripErr) throw tripErr;

  if (trip.items.length === 0) return;

  const { error: itemErr } = await db.from("items").upsert(
    trip.items.map((it) => ({
      id: it.id,
      trip_id: trip.id,
      list_id: listId,
      name: it.name,
      category: it.category,
      price: it.price,
      qty: it.qty,
      status: it.status,
      location: it.location ?? guessLocation(it.category),
      updated_at: new Date().toISOString(),
    }))
  );
  if (itemErr) throw itemErr;
}

export async function deleteTrip(listId: string, tripId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("trips").delete().eq("id", tripId).eq("list_id", listId);
  if (error) throw error;
}

export async function updateItemStatus(
  listId: string,
  tripId: string,
  itemId: string,
  status: Item["status"]
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .eq("list_id", listId);
  if (error) throw error;
}

// --------------------------------------------------------------------------
// Lists (auth)
// --------------------------------------------------------------------------

export async function findListBySlug(slug: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("lists")
    .select("id, slug, password_hash, api_token")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function findListByApiToken(token: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from("lists").select("id, slug").eq("api_token", token).single();
  if (error) return null;
  return data;
}

export async function createList(slug: string, passwordHash: string, apiToken: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("lists")
    .insert({ slug, password_hash: passwordHash, api_token: apiToken })
    .select("id, slug, api_token")
    .single();
  if (error) throw error;
  return data;
}

export async function updateListPassword(listId: string, passwordHash: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("lists").update({ password_hash: passwordHash }).eq("id", listId);
  if (error) throw error;
}

export async function rotateApiToken(listId: string, newToken: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("lists").update({ api_token: newToken }).eq("id", listId);
  if (error) throw error;
}

// --------------------------------------------------------------------------
// Meal suggestions
// --------------------------------------------------------------------------

export interface MealSuggestion {
  id: string;
  name: string;
  time: string;
  uses: string[];
  ingredients: string[];
  steps: string[];
  created_at: string;
}

export async function getMealSuggestions(listId: string): Promise<MealSuggestion[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("meal_suggestions")
    .select("id, name, time, uses, ingredients, steps, created_at")
    .eq("list_id", listId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MealSuggestion[];
}

export async function saveMealSuggestions(
  listId: string,
  meals: Omit<MealSuggestion, "id" | "created_at">[]
): Promise<MealSuggestion[]> {
  const db = supabaseAdmin();
  const rows = meals.map((m) => ({ ...m, list_id: listId }));
  const { data, error } = await db
    .from("meal_suggestions")
    .insert(rows)
    .select("id, name, time, uses, ingredients, steps, created_at");
  if (error) throw error;
  return (data ?? []) as MealSuggestion[];
}

export async function deleteMealSuggestion(listId: string, id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("meal_suggestions")
    .delete()
    .eq("id", id)
    .eq("list_id", listId);
  if (error) throw error;
}
