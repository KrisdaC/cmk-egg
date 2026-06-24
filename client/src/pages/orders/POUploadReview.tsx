import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";

// ── Types (shared via sessionStorage) ─────────────────────────────────────────

export interface UploadReviewLine {
  customerItemCode: string;
  itemNameFromFile: string;
  poQty: number;
  poPrice: number;
  itemId: number | null;
  internalSku: string | null;
  internalName: string | null;
  primarySize: string | null;
  secondarySize: string | null;
  eggsPerPack: number | null;
  sellingUnit: string | null;
  mapped: boolean;
}

export interface UploadReviewPO {
  poNumber: string;
  orderDate: string;
  deliveryDate: string;
  lines: UploadReviewLine[];
  deliverySiteId?: number | null;
  branchCode?: string;
}

export interface UploadReviewData {
  partnerId: number;
  partnerName: string;
  deliverySiteId: number;
  deliverySiteName: string;
  pos: UploadReviewPO[];
}

export const UPLOAD_REVIEW_KEY = "po_upload_review";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateLong(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("th-TH");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function POUploadReview() {
  const [, navigate] = useLocation();

  const [data, setData] = useState<UploadReviewData | null>(null);
  const [poHeaders, setPoHeaders] = useState<{ poNumber: string; orderDate: string; deliveryDate: string }[]>([]);
  const [lineEdits, setLineEdits] = useState<Record<string, { qty: string; price: string }>>({});
  const [includedPos, setIncludedPos] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ orderNumber: string; poNumber: string }[]>([]);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UPLOAD_REVIEW_KEY);
      if (!raw) { navigate("/orders/input"); return; }
      const parsed: UploadReviewData = JSON.parse(raw);
      setData(parsed);
      setPoHeaders(parsed.pos.map(p => ({
        poNumber: p.poNumber,
        orderDate: p.orderDate,
        deliveryDate: p.deliveryDate,
      })));
      const inc: Record<number, boolean> = {};
      parsed.pos.forEach((_, i) => { inc[i] = true; });
      setIncludedPos(inc);
      const edits: Record<string, { qty: string; price: string }> = {};
      parsed.pos.forEach((po, pi) => {
        po.lines.forEach((l, li) => {
          edits[`${pi}-${li}`] = { qty: String(l.poQty), price: l.poPrice > 0 ? l.poPrice.toFixed(2) : "" };
        });
      });
      setLineEdits(edits);
    } catch {
      navigate("/orders/input");
    }
  }, [navigate]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!data) return null;
    let matched = 0, unmatched = 0;
    data.pos.forEach((po, pi) => {
      if (!includedPos[pi]) return;
      po.lines.forEach(l => { l.mapped ? matched++ : unmatched++; });
    });
    return { matched, unmatched, includedCount: Object.values(includedPos).filter(Boolean).length };
  }, [data, includedPos]);

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!data) return;
    setCreating(true);
    setError("");
    const results: { orderNumber: string; poNumber: string }[] = [];
    try {
      for (let pi = 0; pi < data.pos.length; pi++) {
        if (!includedPos[pi]) continue;
        const po = data.pos[pi];
        const header = poHeaders[pi];
        const mappedLines = po.lines.map((l, li) => {
          if (!l.mapped || !l.itemId) return null;
          const qty = parseInt(lineEdits[`${pi}-${li}`]?.qty ?? String(l.poQty), 10);
          const price = parseFloat(lineEdits[`${pi}-${li}`]?.price ?? "0");
          if (!qty || qty <= 0) return null;
          return { itemId: l.itemId, unitPrice: isNaN(price) ? 0 : price, quantity: qty };
        }).filter(Boolean) as { itemId: number; unitPrice: number; quantity: number }[];

        if (!mappedLines.length) continue;

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: data.partnerId,
            deliverySiteId: data.deliverySiteId,
            orderDate: header.orderDate,
            deliveryDate: header.deliveryDate,
            status: "pending",
            source: "upload",
            poNumber: header.poNumber,
            totalAmount: mappedLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
            notes: `PO: ${header.poNumber}`,
            products: mappedLines,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).message ?? `Failed: ${header.poNumber}`);
        results.push({ orderNumber: (await res.json()).orderNumber, poNumber: header.poNumber });
      }
      setCreated(results);
      sessionStorage.removeItem(UPLOAD_REVIEW_KEY);
    } catch (err: any) {
      setError(err.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setCreating(false);
    }
  };

  // ── Success ────────────────────────────────────────────────────────────────

  if (created.length > 0) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", flexDirection:"column", gap:24 }}>
        <CheckCircle2 style={{ width:56, height:56, color:"#16a34a" }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:600 }}>สร้าง PO สำเร็จ</div>
          <div style={{ color:"#888", marginTop:4, fontSize:13 }}>สร้าง {created.length} ใบสั่งขาย</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden", minWidth:280 }}>
          {created.map(c => (
            <div key={c.orderNumber} style={{ padding:"10px 16px", borderBottom:"1px solid #f0f0f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:500, fontSize:13 }}>{c.orderNumber}</div>
                <div style={{ color:"#888", fontSize:11 }}>{c.poNumber}</div>
              </div>
              <CheckCircle2 style={{ width:16, height:16, color:"#16a34a" }} />
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate("/orders/input")}
          style={{ padding:"7px 20px", background:"#1a1a1a", color:"#fff", border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}
        >
          กลับ Orders
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"40vh" }}>
        <Loader2 style={{ width:24, height:24, animation:"spin 1s linear infinite", color:"#aaa" }} />
      </div>
    );
  }

  const canCreate = (summary?.includedCount ?? 0) > 0 && (summary?.matched ?? 0) > 0;

  return (
    /* Full-screen centering wrapper — mirrors handover .tk-mk-up-modal layout */
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "24px 16px 80px",
      minHeight: "100vh",
      background: "#F6F7F8",
    }}>
      {/* Card — exact .tk-mk-up-card dimensions */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        width: "100%",
        maxWidth: 720,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        border: "1px solid #ecedf0",
      }}>

        {/* ── Header — mirrors handover modal header div ── */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid #ecedf0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {data.partnerName} PO upload result
          </h2>
          <button
            onClick={() => navigate("/orders/input")}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888", lineHeight:1 }}
          >
            ×
          </button>
        </div>

        {/* ── Body — mirrors #mkUpResult content ── */}
        <div style={{ padding: "14px 18px", overflowY: "auto", flex: 1, maxHeight: "calc(88vh - 110px)" }}>

          {/* Per-PO sections */}
          {data.pos.map((po, pi) => {
            const header = poHeaders[pi];
            const included = includedPos[pi] ?? true;
            const matchedLines = po.lines.filter(l => l.mapped);
            const unmatchedLines = po.lines.filter(l => !l.mapped);

            return (
              <div key={pi} style={{ marginBottom: pi < data.pos.length - 1 ? 28 : 0, opacity: included ? 1 : 0.45 }}>

                {/* 4-column PO info row — exact from _showMakroUploadResult */}
                <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                  {[
                    { label: "PO #", value: header.poNumber || "(none)", mono: true },
                    { label: "Order date", value: fmtDateLong(header.orderDate) || "—" },
                    { label: "Delivery date", value: fmtDateLong(header.deliveryDate) || "—" },
                    { label: "Partner", value: data.partnerName },
                  ].map(({ label, value, mono }) => (
                    <div key={label} style={{ flex: 1 }}>
                      <b style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</b>
                      <div style={{
                        fontFamily: mono ? "ui-monospace,monospace" : undefined,
                        fontSize: 14,
                        fontWeight: 500,
                        marginTop: 2,
                      }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Site match — .tk-mk-result */}
                <div style={{
                  fontSize: 12, padding: "9px 12px",
                  border: "0.5px solid #e3e5e8", borderRadius: 6,
                  marginBottom: 6, background: "#fafbfc",
                }}>
                  <b>Delivery site:</b> [{data.deliverySiteId}] {data.deliverySiteName}
                </div>

                {/* Delivery date picker — .tk-mk-result */}
                <div style={{
                  fontSize: 12, padding: "9px 12px",
                  border: "0.5px solid #e3e5e8", borderRadius: 6,
                  marginBottom: 6, background: "#fafbfc",
                  display: "flex", alignItems: "center",
                }}>
                  <b>Delivery date for this ticket:</b>
                  <input
                    type="date"
                    value={header.deliveryDate}
                    onChange={e => setPoHeaders(prev => {
                      const next = [...prev];
                      next[pi] = { ...next[pi], deliveryDate: e.target.value };
                      return next;
                    })}
                    style={{
                      marginLeft: 8, padding: "3px 8px",
                      border: "0.5px solid #d6d8dc", borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                </div>

                {/* Lines count — exact margin from handover */}
                <div style={{ margin: "14px 0 8px", fontSize: 13, fontWeight: 500 }}>
                  Lines: {matchedLines.length} matched · {unmatchedLines.length} unmatched
                </div>

                {/* Matched lines table — exact from _showMakroUploadResult */}
                {matchedLines.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f6f7f9" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ecedf0" }}>
                          {data.partnerName === "Makro" ? "Makro code" : data.partnerName === "BigC" || data.partnerName === "Big C" ? "EAN / Item code" : "Item code"}
                        </th>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ecedf0" }}>SKU / Item</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #ecedf0" }}>PO qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedLines.map((ln, i) => (
                        <tr key={i}>
                          <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0", fontFamily: "ui-monospace,monospace" }}>
                            {ln.customerItemCode}
                          </td>
                          <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0" }}>
                            <span style={{ fontSize: 10, color: "#888" }}>{ln.internalSku}</span>{" "}
                            {ln.internalName}
                          </td>
                          <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {fmtNum(ln.poQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Unmatched lines table — exact from _showMakroUploadResult */}
                {unmatchedLines.length > 0 && (
                  <>
                    <div style={{ marginTop: 12, fontSize: 13, fontWeight: 500, color: "#854F0B" }}>
                      Unmatched lines ({data.partnerName} codes not in master data):
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                      <thead>
                        <tr style={{ background: "#fffbe6" }}>
                          <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #f0b400" }}>Code</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #f0b400" }}>Name from file</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #f0b400" }}>PO qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedLines.map((ln, i) => (
                          <tr key={i}>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0", fontFamily: "ui-monospace,monospace" }}>{ln.customerItemCode}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0" }}>{ln.itemNameFromFile}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #ecedf0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(ln.poQty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
                      เลือก SKU เพื่อ map → ระบบจะ <strong>จำ partner-code นี้ไว้</strong> สำหรับ PO ครั้งหน้า · ไม่ map = ระบบจะข้ามไป
                    </div>
                  </>
                )}

                {/* Include / exclude toggle */}
                <div style={{ marginTop: 10, textAlign: "right" }}>
                  <button
                    onClick={() => setIncludedPos(prev => ({ ...prev, [pi]: !prev[pi] }))}
                    style={{
                      padding: "4px 10px",
                      border: included ? "1px solid #d6d8dc" : "1px solid #86efac",
                      borderRadius: 5,
                      background: "#fff",
                      fontSize: 11,
                      color: included ? "#888" : "#166534",
                      cursor: "pointer",
                    }}
                  >
                    {included ? "ยกเว้น PO นี้" : "รวม PO นี้"}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 10, fontSize: 12, padding: "9px 12px",
              border: "0.5px solid #c0392b", borderRadius: 6,
              background: "#fdecea", color: "#c0392b",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer — exact from handover modal footer ── */}
        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid #ecedf0",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          background: "#fafbfc",
        }}>
          <button
            onClick={() => navigate("/orders/input")}
            disabled={creating}
            style={{
              padding: "5px 11px",
              border: "1px solid #d6d8dc",
              borderRadius: 5,
              background: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#f1f3f5")}
            onMouseOut={e => (e.currentTarget.style.background = "#fff")}
          >
            Close
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            style={{
              padding: "5px 11px",
              border: "1px solid #185FA5",
              borderRadius: 5,
              background: creating || !canCreate ? "#aaa" : "#185FA5",
              borderColor: creating || !canCreate ? "#aaa" : "#185FA5",
              color: "#fff",
              fontSize: 12,
              cursor: canCreate && !creating ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {creating && <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />}
            Create ticket
          </button>
        </div>
      </div>
    </div>
  );
}
