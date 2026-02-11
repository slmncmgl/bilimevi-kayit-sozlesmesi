// app/api/contract/route.ts
import { NextRequest, NextResponse } from "next/server";

type N8nContractPayload =
  | { token?: string; contract_html_url?: string }
  | { rowIndex?: number; contract_html_url?: string };

export async function GET(req: NextRequest) {
  const N8N_CONTRACT_URL = process.env.N8N_CONTRACT_URL;
  if (!N8N_CONTRACT_URL) {
    return NextResponse.json(
      { error: "N8N_CONTRACT_URL env yok" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  // 1) n8n’den contract_html_url çek (token ile)
  // Not: n8n bazen array döndürür ([{...}]) bazen object döndürür ({...})
  const n8nUrl =
    `${N8N_CONTRACT_URL}${N8N_CONTRACT_URL.includes("?") ? "&" : "?"}` +
    `token=${encodeURIComponent(token)}`;

  const n8nResp = await fetch(n8nUrl, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  if (!n8nResp || !n8nResp.ok) {
    const txt = n8nResp ? await n8nResp.text().catch(() => "") : "";
    return NextResponse.json(
      { error: "n8n contract hatası", detail: txt },
      { status: 502 }
    );
  }

  let payload: any;
  try {
    payload = await n8nResp.json();
  } catch {
    // n8n 200 dönüp JSON değilse buraya düşer
    const fallbackTxt = await n8nResp.text().catch(() => "");
    return NextResponse.json(
      { error: "n8n JSON dönmedi", detail: fallbackTxt },
      { status: 502 }
    );
  }

  const obj: N8nContractPayload = Array.isArray(payload) ? payload[0] ?? {} : payload ?? {};

  const contractUrl = String(obj?.contract_html_url ?? "").trim();
  if (!contractUrl) {
    return NextResponse.json(
      { error: "contract_html_url yok", debug_payload: obj },
      { status: 404 }
    );
  }

  // 2) Drive’dan HTML’i çek
  const htmlResp = await fetch(contractUrl, {
    method: "GET",
    headers: { accept: "text/html,*/*" },
    cache: "no-store",
  }).catch(() => null);

  if (!htmlResp || !htmlResp.ok) {
    const txt = htmlResp ? await htmlResp.text().catch(() => "") : "";
    return NextResponse.json(
      { error: "drive html çekilemedi", detail: txt, contract_html_url: contractUrl },
      { status: 502 }
    );
  }

  const contract_html = await htmlResp.text().catch(() => "");
  // Google Drive bazen HTML yerine farklı içerik döndürebilir, bu yüzden hafif doğrulama
  if (!contract_html || !contract_html.toLowerCase().includes("<html")) {
    return NextResponse.json(
      {
        error: "contract_html boş veya geçersiz.",
        contract_html_url: contractUrl,
        preview: contract_html?.slice(0, 200) ?? "",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ token, contract_html });
}
