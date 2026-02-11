// app/api/contract/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const N8N_CONTRACT_URL = process.env.N8N_CONTRACT_URL;
  if (!N8N_CONTRACT_URL) {
    return NextResponse.json({ error: "N8N_CONTRACT_URL env yok" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  // 1) n8n’den contract_html_url çek
  const n8nResp = await fetch(N8N_CONTRACT_URL, {
    method: "GET",
    headers: { "accept": "application/json" },
  }).catch(() => null);

  if (!n8nResp || !n8nResp.ok) {
    const txt = n8nResp ? await n8nResp.text().catch(() => "") : "";
    return NextResponse.json({ error: "n8n contract hatası", detail: txt }, { status: 502 });
  }

  let payload: any = {};
  try {
    payload = await n8nResp.json();
  } catch {
    return NextResponse.json({ error: "n8n JSON dönmedi", detail: "" }, { status: 502 });
  }

  // n8n’in response’u: { token, contract_html_url } olmalı
  const contractUrl = String(payload?.contract_html_url ?? "").trim();
  if (!contractUrl) {
    return NextResponse.json({ error: "contract_html_url yok" }, { status: 404 });
  }

  // 2) Drive’dan HTML’i çek
  const htmlResp = await fetch(contractUrl, {
    method: "GET",
    // Drive bazen content-type farklı dönebilir, kabul et
    headers: { "accept": "text/html,*/*" },
  }).catch(() => null);

  if (!htmlResp || !htmlResp.ok) {
    const txt = htmlResp ? await htmlResp.text().catch(() => "") : "";
    return NextResponse.json({ error: "drive html çekilemedi", detail: txt }, { status: 502 });
  }

  const contract_html = await htmlResp.text().catch(() => "");
  if (!contract_html || !contract_html.toLowerCase().includes("<html")) {
    return NextResponse.json({ error: "contract_html boş veya geçersiz." }, { status: 502 });
  }

  return NextResponse.json({
    token,
    contract_html,
  });
}
