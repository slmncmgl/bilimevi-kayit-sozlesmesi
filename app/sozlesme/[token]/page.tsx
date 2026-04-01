"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

type ContractResp = {
  contract_html: string;
  approval_status?: string;
  contract_version?: string;
  kvkk_html?: string;
  signed_by?: string; // YENİ
};

type ApproveResp = {
  ok: boolean;
  kvkk_url?: string | null;
};

export default function ContractPage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractResp | null>(null);

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [approving, setApproving] = useState(false);
  const [contractApproved, setContractApproved] = useState(false);
  const [kvkkUrl, setKvkkUrl] = useState<string | null>(null);
  const [kvkkApproved, setKvkkApproved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");

  const [popupState, setPopupState] = useState<null | "contract-loading" | "contract-done" | "kvkk-loading" | "kvkk-done">(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const kvkkRef = useRef<HTMLDivElement | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  const SITE_KEY = "6Lel1m4sAAAAAKmTkqiiCqkpr8fELq9JzRGDX9gr";

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
    return () => { cancelled = true; };
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

    return () => { el.removeEventListener("scroll", onScroll); };
  }, [loading, contract]);

  useEffect(() => {
    if (kvkkUrl && kvkkRef.current) {
      setTimeout(() => {
        kvkkRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [kvkkUrl]);

  async function approve() {
    if (!fullName.trim()) {
      setErr("Lütfen adınızı ve soyadınızı girin.");
      return;
    }

    if (!recaptchaToken) {
      setErr("Lütfen robot olmadığınızı doğrulayın.");
      return;
    }

    setApproving(true);
    setErr(null);
    setPopupState(contractApproved ? "kvkk-loading" : "contract-loading");

    try {
      if (!contractApproved) {
        // Aşama 1: Sözleşmeyi onayla
        const res = await fetch(`/api/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            full_name: fullName.trim(),
            recaptcha_token: recaptchaToken,
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Approve failed (${res.status})`);
        }

        const data = (await res.json()) as ApproveResp;
        setContractApproved(true);
        setPopupState("contract-done");
        await new Promise((res) => setTimeout(res, 2000));
        setPopupState(null);

        const rawUrl = data.kvkk_url ?? null;
        if (rawUrl) {
          const match = rawUrl.match(/\/file\/d\/([^/]+)/);
          const fileId = match?.[1];
          setKvkkUrl(fileId ? `https://drive.google.com/file/d/${fileId}/preview` : rawUrl);
        } else {
          setKvkkUrl(null);
        }

        recaptchaRef.current?.reset();
        setRecaptchaToken("");

      } else {
        // Aşama 2: KVKK'yı onayla
        const res = await fetch(`/api/kvkk-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            full_name: fullName.trim(),
            recaptcha_token: recaptchaToken,
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `KVKK approve failed (${res.status})`);
        }

        setKvkkApproved(true);
        setPopupState("kvkk-done");
      }
    } catch (e: any) {
      setErr(e?.message || "Bilinmeyen hata");
      setPopupState(null);
      recaptchaRef.current?.reset();
      setRecaptchaToken("");
    } finally {
      setApproving(false);
    }
  }

  const normalizedHtml = useMemo(() => {
    const html = contract?.contract_html ?? "";
    if (!html) return "";

    return html
      .replace(
        /<\/head>/i,
        `<style>
          html, body { 
            max-width: 100%; 
            overflow-x: hidden; 
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
          }
          img, table { 
            max-width: 100% !important; 
            height: auto !important; 
          }
          * { 
            max-width: 100% !important; 
            box-sizing: border-box; 
          }
          body { margin: 0; padding: 0; }
          p, div, span { 
            white-space: normal !important; 
            overflow-wrap: anywhere; 
            word-break: break-word; 
          }
          strong, b, .bold,
          span[style*="font-weight:700"],
          span[style*="font-weight: 700"],
          span[style*="font-weight:bold"],
          span[style*="font-weight: bold"] {
            font-weight: 700 !important;
          }
          h1, h2, h3 {
            font-weight: 700 !important;
            margin: 16pt 0 12pt 0;
          }
        </style></head>`
      )
      .replace(/width:\s*\d+(px|pt);?/gi, "width:auto;")
      .replace(/max-width:\s*\d+(px|pt);?/gi, "max-width:100%;");
  }, [contract?.contract_html]);

  const isButtonDisabled =
    approving ||
    kvkkApproved ||
    !fullName.trim() ||
    !recaptchaToken ||
    (!contractApproved && !scrolledToBottom);

  const buttonLabel = approving
    ? "Onaylanıyor... SAYFAYI LÜTFEN KAPATMAYIN."
    : contractApproved
    ? "KVKK'yı Okudum ve Onaylıyorum"
    : "Okudum, Anladım ve Onaylıyorum";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6fa", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src="https://www.bilimevi.com/assets/images/bilimevi_logo_761.svg"
            alt="Bilimevi Logo"
            style={{ height: 60, width: "auto" }}
          />
        </div>

        {loading ? (
          <div style={{ padding: 16, background: "white", borderRadius: 12 }}>Yükleniyor...</div>
        ) : err && !contract ? (
          <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #f2c2c2" }}>
            <div style={{ color: "#b00020", fontWeight: 600, marginBottom: 8 }}>Hata</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
          </div>
        ) : (
          <>
            {/* Sözleşme scroll alanı */}
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

            {/* KVKK alanı — sözleşme onaylandıktan sonra görünür */}
            {contractApproved && contract?.kvkk_html && (
              <div
                ref={kvkkRef}
                style={{
                  marginTop: 16,
                  background: "white",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                  📄 KVKK Aydınlatma Metni ve Açık Rıza Beyanı
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: contract.kvkk_html }}
                  style={{
                    width: "100%",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    fontSize: 15,
                    lineHeight: "24px",
                  }}
                />
              </div>
            )}

            {/* SABİT ALAN */}
            {!kvkkApproved && (
              <div style={{
                marginTop: 16,
                background: "white",
                borderRadius: 12,
                padding: 16,
                border: "1px solid #eee",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}>

                {/* Ad Soyad */}
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                    ✍️ Onaylayan Kişinin Adı Soyadı
                  </label>

                  {contract?.signed_by && (
  <div style={{
    background: "#fff8e1",
    border: "1px solid #ffa000",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    color: "#e65100",
    marginBottom: 8
  }}>
    ⚠️ Bu sözleşme <strong>{contract.signed_by}</strong> adına düzenlenmiştir. Lütfen bu kişinin adını yazınız.
  </div>
)}
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={contractApproved}
                    placeholder="Örn: Ayşe Yılmaz"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      fontSize: 15,
                      boxSizing: "border-box",
                      outline: "none",
                      background: contractApproved ? "#f5f5f5" : "white",
                      color: contractApproved ? "#999" : "#000",
                    }}
                  />
                </div>

                {/* reCAPTCHA */}
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={SITE_KEY}
                  onChange={(t) => setRecaptchaToken(t ?? "")}
                  onExpired={() => setRecaptchaToken("")}
                />

                {/* Buton + mesaj */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    onClick={approve}
                    disabled={isButtonDisabled}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: "none",
                      cursor: isButtonDisabled ? "not-allowed" : "pointer",
                      background: isButtonDisabled ? "#c8c8c8" : "#1a73e8",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {buttonLabel}
                  </button>

                  <div style={{ fontSize: 14, color: "#666" }}>
                    {!contractApproved && !scrolledToBottom
                      ? "Sözleşmeyi sonuna kadar okuyun."
                      : !fullName.trim()
                      ? "Lütfen adınızı soyadınızı girin."
                      : !recaptchaToken
                      ? "Lütfen robot olmadığınızı doğrulayın."
                      : contractApproved
                      ? "KVKK onayı aktif."
                      : "Onay aktif."}
                  </div>
                </div>

                {err && (
                  <div style={{ color: "#b00020", whiteSpace: "pre-wrap", fontSize: 14 }}>
                    {err}
                  </div>
                )}
              </div>
            )}

            {/* POPUP OVERLAY */}
            {popupState && (
              <div style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999,
              }}>
                <div style={{
                  background: "white",
                  borderRadius: 16,
                  padding: "36px 40px",
                  maxWidth: 420,
                  width: "90%",
                  textAlign: "center",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                }}>
                  {(popupState === "contract-loading" || popupState === "kvkk-loading") && (
                    <>
                      <div style={{
                        width: 48, height: 48,
                        border: "5px solid #e0e0e0",
                        borderTop: "5px solid #1a73e8",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        margin: "0 auto 20px",
                      }} />
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#333" }}>
                        {popupState === "contract-loading"
                          ? "Sözleşme Onaylanıyor..."
                          : "KVKK Onaylanıyor..."}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 14, color: "#e53935", fontWeight: 600 }}>
                        Lütfen Sayfayı Kapatmayın
                      </div>
                    </>
                  )}

                  {popupState === "contract-done" && (
                    <>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                      <div style={{ fontWeight: 700, fontSize: 17, color: "#2e7d32", marginBottom: 8 }}>
                        Sözleşme Onaylandı!
                      </div>
                      <div style={{ fontSize: 15, color: "#555" }}>
                        Şimdi son olarak KVKK formunu onaylayınız.
                      </div>
                    </>
                  )}

                  {popupState === "kvkk-done" && (
                    <>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                      <div style={{ fontWeight: 700, fontSize: 17, color: "#2e7d32", marginBottom: 8 }}>
                        Kayıt İşleminiz Tamamlandı,
                      </div>
                      <div style={{ fontSize: 15, color: "#555" }}>
                        Bu Sayfayı Kapatabilirsiniz.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Tüm onaylar tamamlandı */}
            {kvkkApproved && (
              <div style={{
                marginTop: 16,
                padding: 16,
                background: "#e8f5e9",
                borderRadius: 12,
                border: "1px solid #a5d6a7",
                textAlign: "center",
                fontWeight: 600,
                color: "#2e7d32",
                fontSize: 16,
              }}>
                ✅ Sözleşmeniz ve KVKK onayınız başarıyla tamamlandı. BU SAYFAYI KAPATABİLİRSİNİZ.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
