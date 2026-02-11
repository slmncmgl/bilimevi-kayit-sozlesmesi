"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ContractResp = {
  contract_html: string;
  approval_status?: string;
  contract_version?: string;
};

export default function ContractPage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractResp | null>(null);

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => "Bilimevi Sözleşme Onayı", []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/contract?token=${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Contract fetch failed (${res.status})`);
        }

        const data = (await res.json()) as ContractResp;

        if (!data?.contract_html || typeof data.contract_html !== "string") {
          throw new Error("contract_html boş veya geçersiz.");
        }

        if (!cancelled) setContract(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;

      const thresholdPx = 12;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx;
      setScrolledToBottom(atBottom);
    }

    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [loading, contract]);

  async function approve() {
    setApproving(true);
    setErr(null);

    try {
      const res = await fetch(`/api/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Approve failed (${res.status})`);
      }

      setApproved(true);
    } catch (e: any) {
      setErr(e?.message || "Bilinmeyen hata");
    } finally {
      setApproving(false);
    }
  }

  // ✅ normalize burada: state’ten gelen HTML'i güvenli şekilde ekrana sığdır
  const normalizedHtml = useMemo(() => {
    const html = contract?.contract_html ?? "";
    if (!html) return "";

    return html
      .replace(
        /<\/head>/i,
        `<style>
          html, body { max-width: 100%; overflow-x: hidden; }
          img, table { max-width: 100% !important; height: auto !important; }
          * { max-width: 100% !important; box-sizing: border-box; }
          body { margin: 0; padding: 0; }
          p, div, span { white-space: normal !important; overflow-wrap: anywhere; word-break: break-word; }
        </style></head>`
      )
      .replace(/width:\s*\d+(px|pt);?/gi, "width:auto;")
      .replace(/max-width:\s*\d+(px|pt);?/gi, "max-width:100%;");
  }, [contract?.contract_html]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6fa", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 8px 0" }}>{title}</h1>

        <div style={{ marginBottom: 12, color: "#666", fontSize: 14 }}>
          Token: <code>{token}</code>
        </div>

        {loading ? (
          <div style={{ padding: 16, background: "white", borderRadius: 12 }}>Yükleniyor...</div>
        ) : err ? (
          <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #f2c2c2" }}>
            <div style={{ color: "#b00020", fontWeight: 600, marginBottom: 8 }}>Hata</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
          </div>
        ) : (
          <>
            {/* ✅ Scroll alanı */}
            <div
              ref={containerRef}
              style={{
                height: "70vh",
                overflowY: "auto",
                overflowX: "hidden",
                background: "white",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                border: "1px solid #eee",
              }}
            >
              <div
                style={{
                  width: "100%",
                  overflowX: "hidden",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  fontSize: 15,
                  lineHeight: "24px",
                }}
                dangerouslySetInnerHTML={{ __html: normalizedHtml }}
              />
            </div>

            {/* ✅ Buton alanı (scroll container DIŞINDA) */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
              <button
                onClick={approve}
                disabled={!scrolledToBottom || approving || approved}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  cursor: !scrolledToBottom || approving || approved ? "not-allowed" : "pointer",
                  background: !scrolledToBottom || approving || approved ? "#c8c8c8" : "#1a73e8",
                  color: "white",
                  fontWeight: 700,
                }}
              >
                {approved ? "Onaylandı" : approving ? "Onaylanıyor..." : "Okudum, Onaylıyorum"}
              </button>

              <div style={{ fontSize: 14, color: "#666" }}>
                {scrolledToBottom ? "Onay aktif." : "Aşağı kaydırıp sonuna ulaşınca onay aktif olur."}
              </div>
            </div>

            {err && <div style={{ marginTop: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
