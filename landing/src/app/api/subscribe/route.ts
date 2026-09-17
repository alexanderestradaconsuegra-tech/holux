import { NextRequest, NextResponse } from "next/server";

// Registration creates the account right away: n8n's signup-free webhook
// calls restaurant-onboard, which builds the restaurant, the login and the
// tables, and starts a real 30-day trial (trial_ends_at defaults on that
// table). No MercadoPago step here — that only comes back in if the trial
// expires and the owner activates or resubscribes from the panel.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL;

  if (!n8nBase) {
    return NextResponse.json({ error: "signup_unavailable" }, { status: 503 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const restaurant = String(body?.restaurant || "").trim();
  const owner = String(body?.name || "").trim();

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email) || !restaurant || !owner) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const res = await fetch(`${n8nBase}/webhook/signup-free`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_name: restaurant,
        owner_name: owner,
        owner_email: email,
        phone: String(body?.phone || "").trim() || null,
        plan: String(body?.plan || "pro"),
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return NextResponse.json({ error: "signup_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "signup_failed" }, { status: 502 });
  }
}
