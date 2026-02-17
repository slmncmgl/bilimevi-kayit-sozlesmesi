import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error("RECAPTCHA_SECRET_KEY env yok");
    return false;
  }

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${token}`,
  });

  const data = await res.json();

  // ✅ v2: sadece success kontrolü (score YOK!)
  return data.success === true;
}

export async function POST(req: NextRequest) {
  const N8N_APPROVE_WEBHOOK = process.env.N8N_APPROVE_WEBHOOK;
  if (!N8N_APPROVE_WEBHOOK) {
    return NextResponse.json({ error: "N8N_APPROVE_WEBHOOK env yok" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();
  const fullName = String(body?.full_name ?? "").trim();
  const recaptchaToken = String(body?.recaptcha_token ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "token zorunlu" }, { status: 400 });
  }

  if (!fullName) {
    return NextResponse.json({ error: "full_name zorunlu" }, { status: 400 });
  }

  if (!recaptchaToken) {
    return NextResponse.json({ error: "reCAPTCHA token eksik" }, { status: 400 });
  }

  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    return NextResponse.json({ error: "reCAPTCHA doğrulaması başarısız" }, { status: 403 });
  }

  const approved_at = new Date().toISOString();
  const approved_ip = getClientIp(req);
  const user_agent = req.headers.get("user-agent") ?? "";

  const r = await fetch(N8N_APPROVE_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      full_name: fullName,
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
