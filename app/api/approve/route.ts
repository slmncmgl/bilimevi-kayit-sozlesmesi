import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token;

  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  const N8N_APPROVE_URL = process.env.N8N_APPROVE_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY; // opsiyonel

  if (!N8N_APPROVE_URL) {
    return NextResponse.json({ error: "N8N_APPROVE_URL env yok" }, { status: 500 });
  }

  // IP (opsiyonel)
  const xff = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const approved_ip = xff || null;

  const res = await fetch(N8N_APPROVE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(N8N_API_KEY ? { "x-api-key": N8N_API_KEY } : {})
    },
    body: JSON.stringify({
      token,
      approved_ip
    })
  });

  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "n8n approve hatası", detail: text },
      { status: res.status }
    );
  }

  // n8n ister JSON ister text dönebilir, JSON dene
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
