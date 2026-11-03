import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { promoteDueScheduledOrders } from "@/lib/checkout/finalize";
import { tickOrders } from "@/lib/orders/simulation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Called every ~2 s by open tracking / partner / admin screens to advance dispatch and simulated riders.
 * Returns the order's updated_at so the screen can refresh even if a realtime event was missed.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const order = req.nextUrl.searchParams.get("order");
  const id = order && /^[0-9a-f-]{36}$/.test(order) ? order : undefined;
  // Open screens also release due scheduled orders, so the demo works on hosts with daily-only cron (Vercel Hobby).
  await Promise.all([tickOrders(id), promoteDueScheduledOrders()]);
  if (!id) return NextResponse.json({ ok: true });
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("orders").select("updated_at, status").eq("id", id).maybeSingle();
  return NextResponse.json({ ok: true, updatedAt: data?.updated_at ?? null, status: data?.status ?? null });
}
