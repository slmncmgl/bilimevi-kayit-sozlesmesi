// app/api/approve/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export async function POST(req: NextRequest) {
  const N8N_APPROVE_WEBHOOK = process.env.N8N_APPROVE_WEBHOOK;
  if (!N8N_APPROVE_WEBHOOK) {
    return NextResponse.json({ error: "N8N_APPROVE_WEBHOOK env yok" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  const approved_at = new Date().toISOString();
  const approved_ip = getClientIp(req);
  const user_agent = req.headers.get("user-agent") ?? "";

  const r = await fetch(N8N_APPROVE_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      approval_status: "APPROVED",
      approved_at,
      approved_ip,
      user_agent,
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return NextResponse.json({ error: "n8n webhook hata", details: text }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
