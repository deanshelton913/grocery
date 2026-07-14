/**
 * Pantry Ledger MCP Server — Streamable HTTP (JSON-RPC over POST)
 *
 * Endpoint: POST /api/mcp
 * Auth:     Authorization: Bearer <api_token>
 *
 * MCP client config (Claude Desktop, Cursor, Kiro):
 * {
 *   "mcpServers": {
 *     "pantry-ledger": {
 *       "url": "https://your-app.vercel.app/api/mcp",
 *       "headers": { "Authorization": "Bearer <token>" }
 *     }
 *   }
 * }
 *
 * Tools:
 *   list_trips          — get all trips and items
 *   log_trip            — create / replace a full trip (bulk receipt import)
 *   update_item_status  — mark an item used / partial / wasted / pending
 *   update_item_fields  — edit name, price, qty, category
 *   delete_trip         — remove an entire trip
 *   delete_item         — remove a single item from a trip
 */
import { NextRequest, NextResponse } from "next/server";
import { findListByApiToken, getTrips, upsertTrip, deleteTrip, updateItemStatus } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import type { Item } from "@/lib/types";

// ── constants ─────────────────────────────────────────────────────────────────

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "pantry-ledger", version: "1.0.0" };

const VALID_STATUSES = ["pending", "used", "partial", "wasted"] as const;
const VALID_CATEGORIES = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "snacks",
  "beverages",
  "condiments",
  "deli",
  "household",
  "other",
] as const;

// ── tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_trips",
    description: "Get all grocery trips and their items for this list.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "log_trip",
    description:
      "Create or replace a grocery trip. Use this to log a receipt — pass every line item in one call. Always set status to 'pending' for new items.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique trip ID, e.g. trip-safeway-20260714" },
        store: { type: "string", description: "Store name" },
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        fees: { type: "number", description: "Tax or bag fees in dollars (0 if none)" },
        items: {
          type: "array",
          description: "All items on the receipt",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique item ID, e.g. item-001" },
              name: { type: "string" },
              category: { type: "string", enum: [...VALID_CATEGORIES] },
              price: { type: "number", description: "Per-unit price in dollars" },
              qty: { type: "integer", minimum: 1 },
              status: { type: "string", enum: [...VALID_STATUSES] },
            },
            required: ["id", "name", "category", "price", "qty", "status"],
          },
        },
      },
      required: ["id", "store", "date", "items"],
    },
  },
  {
    name: "update_item_status",
    description:
      "Update the status of a grocery item. Values: pending=available (just bought), partial=opened/in use (some remains), used=fully consumed (no waste), wasted=spoiled or thrown away.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string" },
        itemId: { type: "string" },
        status: { type: "string", enum: [...VALID_STATUSES] },
      },
      required: ["tripId", "itemId", "status"],
    },
  },
  {
    name: "update_item_fields",
    description: "Edit the name, price, qty, category, or status of an existing item.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string" },
        itemId: { type: "string" },
        name: { type: "string" },
        category: { type: "string", enum: [...VALID_CATEGORIES] },
        price: { type: "number" },
        qty: { type: "integer", minimum: 1 },
        status: { type: "string", enum: [...VALID_STATUSES] },
      },
      required: ["tripId", "itemId"],
    },
  },
  {
    name: "delete_trip",
    description: "Delete an entire trip and all its items.",
    inputSchema: {
      type: "object",
      properties: { tripId: { type: "string" } },
      required: ["tripId"],
    },
  },
  {
    name: "delete_item",
    description: "Delete a single item from a trip.",
    inputSchema: {
      type: "object",
      properties: {
        tripId: { type: "string" },
        itemId: { type: "string" },
      },
      required: ["tripId", "itemId"],
    },
  },
];

// ── tool execution ────────────────────────────────────────────────────────────

async function callTool(listId: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_trips": {
      const trips = await getTrips(listId);
      return JSON.stringify(trips, null, 2);
    }

    case "log_trip": {
      const trip = args as unknown as Parameters<typeof upsertTrip>[1];
      if (!trip.fees) trip.fees = 0;
      await upsertTrip(listId, trip);
      return `Trip "${trip.store}" (${trip.date}) saved with ${trip.items.length} items.`;
    }

    case "update_item_status": {
      const { tripId, itemId, status } = args as {
        tripId: string;
        itemId: string;
        status: Item["status"];
      };
      if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
      await updateItemStatus(listId, tripId, itemId, status);
      return `Item ${itemId} marked as "${status}".`;
    }

    case "update_item_fields": {
      const { tripId, itemId, ...fields } = args as Record<string, unknown>;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const allowed = ["name", "category", "price", "qty", "status"];
      for (const k of allowed) {
        if (k in fields && fields[k] !== undefined) updates[k] = fields[k];
      }
      const db = supabaseAdmin();
      const { error } = await db
        .from("items")
        .update(updates)
        .eq("id", itemId as string)
        .eq("trip_id", tripId as string)
        .eq("list_id", listId);
      if (error) throw new Error(error.message);
      return `Item ${itemId} updated.`;
    }

    case "delete_trip": {
      const { tripId } = args as { tripId: string };
      await deleteTrip(listId, tripId);
      return `Trip ${tripId} deleted.`;
    }

    case "delete_item": {
      const { tripId, itemId } = args as { tripId: string; itemId: string };
      const db = supabaseAdmin();
      await db.from("items").delete().eq("id", itemId).eq("trip_id", tripId).eq("list_id", listId);
      return `Item ${itemId} removed from trip ${tripId}.`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function jsonrpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonrpcError(null, -32001, "Missing Authorization header");

  const list = await findListByApiToken(token);
  if (!list) return jsonrpcError(null, -32001, "Invalid API token");

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonrpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body as {
    id: unknown;
    method: string;
    params?: Record<string, unknown>;
  };

  // Dispatch
  try {
    switch (method) {
      case "initialize":
        return jsonrpc(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

      case "notifications/initialized":
        // client acknowledgement — no response needed for notifications
        return new NextResponse(null, { status: 204 });

      case "tools/list":
        return jsonrpc(id, { tools: TOOLS });

      case "tools/call": {
        const toolName = (params?.name ?? "") as string;
        const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
        const text = await callTool(list.id, toolName, toolArgs);
        return jsonrpc(id, {
          content: [{ type: "text", text }],
          isError: false,
        });
      }

      case "ping":
        return jsonrpc(id, {});

      default:
        return jsonrpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonrpc(id, {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    });
  }
}

// MCP clients sometimes send GET to discover the endpoint
export async function GET() {
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocol: PROTOCOL_VERSION,
    endpoint: "POST /api/mcp",
    auth: "Authorization: Bearer <api_token>",
    tools: TOOLS.map((t) => t.name),
  });
}
