import { NextRequest, NextResponse } from "next/server";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL;

  if (!n8nBase) {
    return NextResponse.json({ ok: true });
  }

  const password = generatePassword();

  const payload = {
    restaurantName: body.name || body.restaurantName || "Mi Restaurante",
    ownerName: body.name || body.ownerName || "",
    ownerEmail: body.email || body.ownerEmail || "",
    ownerPassword: password,
    phone: body.phone || null,
    plan: "starter",
  };

  try {
    await fetch(`${n8nBase}/webhook/restaurant-onboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // fire-and-forget — user still gets success screen
  }

  return NextResponse.json({ ok: true });
}
