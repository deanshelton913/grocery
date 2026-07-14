import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTrips } from "@/lib/db";
import LedgerClient from "./LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const trips = await getTrips(session.listId);

  return (
    <LedgerClient
      initialTrips={trips}
      listId={session.listId}
      slug={session.slug}
    />
  );
}
