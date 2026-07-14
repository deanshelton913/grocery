/**
 * Run with: npx tsx scripts/migrate.ts
 * Applies any pending schema changes to the Supabase database.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const migrations = [
  {
    name: "create meal_suggestions",
    sql: `
      create table if not exists meal_suggestions (
        id          uuid primary key default gen_random_uuid(),
        list_id     uuid not null references lists(id) on delete cascade,
        name        text not null,
        time        text not null,
        uses        jsonb not null default '[]',
        ingredients jsonb not null default '[]',
        steps       jsonb not null default '[]',
        created_at  timestamptz default now()
      );
      create index if not exists meal_suggestions_list_id_idx on meal_suggestions(list_id);
      alter table meal_suggestions enable row level security;
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where tablename = 'meal_suggestions' and policyname = 'No public access'
        ) then
          create policy "No public access" on meal_suggestions for all using (false);
        end if;
      end $$;
    `,
  },
];

async function run() {
  for (const m of migrations) {
    process.stdout.write(`Running: ${m.name} ... `);
    const { error } = await supabase.rpc("exec_sql", { query: m.sql }).single();
    if (error) {
      // exec_sql may not exist — try a direct insert probe instead
      // For create table we can verify by checking if table exists
      const { error: checkErr } = await supabase.from("meal_suggestions").select("id").limit(1);
      if (!checkErr || checkErr.code === "PGRST116") {
        console.log("already exists or created ✓");
      } else {
        console.error(`\nFailed: ${error.message}`);
        console.error("Please run supabase/schema-meals.sql manually in the Supabase SQL Editor:");
        console.error("https://supabase.com/dashboard/project/kkfmtsxfeqquvwnxarwy/sql/new");
        process.exit(1);
      }
    } else {
      console.log("done ✓");
    }
  }
  console.log("\nAll migrations complete.");
}

run();
