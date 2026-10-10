// RevenueCat webhook: mirrors subscriptions into public.subscriptions and
// turns Sadaqa gift purchases into a year of Premium for the student who has
// waited the longest. Configured in RevenueCat (Project settings, Webhooks)
// with the header "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
//
// Secrets: REVENUECAT_WEBHOOK_SECRET (shared with RevenueCat) and
// REVENUECAT_SECRET_KEY (RevenueCat secret API key, to grant the gifted
// entitlement). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by
// the platform.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SADAQA_PRODUCT_ID = "com.nmoussaoui.memoriq.sadaqa.year";
const ENTITLEMENT = "premium";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  store?: string;
  price?: number | null;
  currency?: string | null;
  transaction_id?: string | null;
};

/** The Supabase user behind the event (the app logs in with the user uuid). */
function supabaseUserId(e: RevenueCatEvent): string | null {
  const ids = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])];
  return ids.find((id): id is string => !!id && UUID.test(id)) ?? null;
}

function subscriptionStatus(type: string): string {
  switch (type) {
    case "EXPIRATION":
      return "expired";
    case "CANCELLATION":
      return "cancelled"; // still active until current_period_end
    case "BILLING_ISSUE":
      return "billing_issue";
    case "SUBSCRIPTION_PAUSED":
      return "paused";
    default:
      return "active";
  }
}

async function recordSubscription(e: RevenueCatEvent) {
  const userId = supabaseUserId(e);
  if (!userId) return;
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    entitlement: ENTITLEMENT,
    status: subscriptionStatus(e.type),
    source: e.store ?? null,
    current_period_end: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function recordGift(e: RevenueCatEvent) {
  const { error } = await db.from("sadaqa_gifts").upsert(
    {
      donor_user_id: supabaseUserId(e),
      amount_cents: e.price != null ? Math.round(e.price * 100) : null,
      currency: e.currency ?? null,
      transaction_id: e.transaction_id ?? null,
    },
    { onConflict: "transaction_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Grants a year of Premium in RevenueCat (promotional entitlement). */
async function grantYear(userId: string): Promise<boolean> {
  const key = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!key) return false;
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}/entitlements/${ENTITLEMENT}/promotional`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ duration: "yearly" }),
    },
  );
  return res.ok;
}

/**
 * Pairs every pending gift with the longest-waiting student, oldest first.
 * Runs on every webhook call, so a gift bought while nobody was waiting is
 * assigned as soon as the next event arrives after someone joins the list.
 */
async function assignPendingGifts() {
  const { data: gifts } = await db
    .from("sadaqa_gifts")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);
  for (const gift of gifts ?? []) {
    const { data: student } = await db
      .from("sadaqa_waitlist")
      .select("user_id")
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!student) return;
    if (!(await grantYear(student.user_id))) return; // retry on a later event
    const now = new Date().toISOString();
    await db
      .from("sadaqa_gifts")
      .update({ status: "assigned", beneficiary_user_id: student.user_id, assigned_at: now })
      .eq("id", gift.id);
    await db
      .from("sadaqa_waitlist")
      .update({ status: "granted", granted_at: now })
      .eq("user_id", student.user_id);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  let event: RevenueCatEvent;
  try {
    event = (await req.json()).event;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!event?.type) return new Response("ok");

  try {
    if (event.product_id === SADAQA_PRODUCT_ID) {
      if (event.type === "NON_RENEWING_PURCHASE") await recordGift(event);
    } else if ((event.entitlement_ids ?? []).includes(ENTITLEMENT)) {
      await recordSubscription(event);
    }
    await assignPendingGifts();
  } catch (error) {
    console.error(error);
    // A 5xx makes RevenueCat retry later; every write above is idempotent.
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
});
