import { NextRequest, NextResponse } from "next/server";

// Registration is now an intent to subscribe, not an account. This hands the
// details to n8n, which records the signup and asks MercadoPago for a checkout
// link; the restaurant is only built once MercadoPago confirms the payment.
//
// The plan key travels, never the price: the amount is looked up server-side so
// a tampered page cannot subscribe a restaurant for one peso.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL;

  if (!n8nBase) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const restaurant = String(body?.restaurant || "").trim();
  const owner = String(body?.name || "").trim();

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email) || !restaurant || !owner) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const res = await fetch(`${n8nBase}/webhook/subscription-start`, {
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
    if (!res.ok || !data?.init_point) {
      return NextResponse.json({ error: "checkout_unavailable" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, init_point: data.init_point });
  } catch {
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 502 });
  }
}
