import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  const N8N_CONTRACT_URL = process.env.N8N_CONTRACT_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY; // opsiyonel

  if (!N8N_CONTRACT_URL) {
    return NextResponse.json({ error: "N8N_CONTRACT_URL env yok" }, { status: 500 });
  }

  const url = new URL(N8N_CONTRACT_URL);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: N8N_API_KEY ? { "x-api-key": N8N_API_KEY } : undefined,
    cache: "no-store"
  });

  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "n8n contract hatası", detail: text },
      { status: res.status }
    );
  }

  // n8n JSON dönmeli: { contract_html: "...", approval_status: "...", contract_version: "..." }
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "n8n JSON dönmedi", detail: text },
      { status: 502 }
    );
  }
}
