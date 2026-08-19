import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL;

  if (n8nBase) {
    try {
      await fetch(`${n8nBase}/webhook/demo-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // log but don't fail — user still gets success
    }
  }

  return NextResponse.json({ ok: true });
}
