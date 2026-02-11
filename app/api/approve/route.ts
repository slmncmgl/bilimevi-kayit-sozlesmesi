// app/api/contract/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const N8N_CONTRACT_URL = process.env.N8N_CONTRACT_URL;
  if (!N8N_CONTRACT_URL) {
    return NextResponse.json({ error: "N8N_CONTRACT_URL env yok" }, { status: 500 });
  }

  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  // 1) n8n'den contract_html_url al
  const r1 = await fetch(`${N8N_CONTRACT_URL}?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { "accept": "application/json" },
    cache: "no-store",
  });

  if (!r1.ok) {
    const text = await r1.text().catch(() => "");
    return NextResponse.json({ error: "n8n contract hatası", detail: text }, { status: 502 });
  }

  const data = await r1.json().catch(() => ({} as any));
  const contract_html_url = String(data?.contract_html_url ?? "").trim();

  if (!contract_html_url) {
    return NextResponse.json({ error: "contract_html_url boş veya yok" }, { status: 404 });
  }

  // 2) Drive URL'den HTML'i indir, contract_html olarak dön
  const r2 = await fetch(contract_html_url, { method: "GET", cache: "no-store" });
  if (!r2.ok) {
    const text = await r2.text().catch(() => "");
    return NextResponse.json({ error: "contract_html_url indirilemedi", detail: text }, { status: 502 });
  }

  const contract_html = await r2.text();

  if (!contract_html || !contract_html.toLowerCase().includes("<html")) {
    return NextResponse.json({ error: "contract_html boş veya geçersiz" }, { status: 422 });
  }

  return NextResponse.json({ token, contract_html }, { status: 200 });
}
