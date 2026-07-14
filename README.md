# Pantry Ledger

Track grocery spend and reduce waste. Multi-device, shared lists, agent API.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** free tier — auth + Postgres storage
- **Upstash Redis** free tier — rate limiting
- **Vercel** free tier — hosting

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor → New query** and paste the contents of `supabase/schema.sql`, then run it
3. Copy your project URL and keys from **Settings → API**

### 2. Upstash Redis

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com)
2. Copy the **REST URL** and **REST Token** from the database details page

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Generate a JWT secret:
```bash
openssl rand -base64 32
```

### 4. Run locally

```bash
npm install
npm run dev
```

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

Add the same environment variables in your Vercel project settings under **Settings → Environment Variables**.

---

## How it works

- Users visit `/` and either **create a list** (choose a unique slug + password) or **sign in** to an existing one
- The slug + password can be shared with anyone who should access the same list on any device
- Sessions are JWT cookies (30-day expiry, HttpOnly)
- Data is stored in Supabase Postgres (trips + items tables)
- Multi-device sync: the client polls `/api/trips` every 30 seconds

## Agent API

Every list gets an API token shown in the Account modal (⚙ icon).

Base URL: `https://your-app.vercel.app`

**Auth:** `Authorization: Bearer <api_token>`

**Rate limit:** 30 requests / minute (sliding window, via Upstash)

### Endpoints

| Method   | Path              | Description                          |
|----------|-------------------|--------------------------------------|
| `GET`    | `/api/agent`      | Fetch all trips                      |
| `POST`   | `/api/agent`      | Upsert a trip (full Trip object)     |
| `PATCH`  | `/api/agent`      | Update a single item status          |
| `DELETE` | `/api/agent?tripId=<id>` | Delete a trip               |

### PATCH body

```json
{
  "tripId": "trip-abc123",
  "itemId": "item-xyz456",
  "status": "used"
}
```

Valid statuses: `pending`, `used`, `partial`, `wasted`

### Trip shape

```json
{
  "id": "trip-abc123",
  "store": "Costco",
  "date": "2026-07-13",
  "fees": 0,
  "items": [
    {
      "id": "item-xyz456",
      "name": "Chuck Roast",
      "category": "meat",
      "price": 48.82,
      "qty": 1,
      "status": "pending"
    }
  ]
}
```

### Example curl

```bash
# Get all trips
curl https://your-app.vercel.app/api/agent \
  -H "Authorization: Bearer YOUR_TOKEN"

# Mark an item as used
curl -X PATCH https://your-app.vercel.app/api/agent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tripId":"trip-abc123","itemId":"item-xyz456","status":"used"}'
```

---

## Password management

From the Account modal (⚙ gear icon in the header) users can:
- View and copy their API token
- Rotate the API token (invalidates the old one immediately)
- Change their list password
- Sign out
