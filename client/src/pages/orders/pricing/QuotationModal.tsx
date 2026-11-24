import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { SIZE_PILL } from "./_shared";
import type { PricingWeek, SiteGroup } from "./_shared";

import { todayBkk } from "@shared/date";
// ─── Types ────────────────────────────────────────────────────────────────────

interface EggItem {
  id: number;
  sku: string | null;
  name: string;
  primary_size: string | null;
  eggs_per_pack: number;
}

interface ScopeRow {
  key: string;
  siteGroupId: number | null;
  label: string;
  quantity: number;
  currentPrice: number | null;
}

interface SimItem {
  item: EggItem;
  costPrice: number | null;
  scopes: ScopeRow[];
}

interface PartnerDetail {
  id: number;
  nickname: string;
  businessName: string | null;
  taxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  district: string | null;
  subDistrict: string | null;
  province: string | null;
  postalCode: string | null;
  creditDays: number | null;
}

interface Props {
  simItems: SimItem[];
  siteGroups: SiteGroup[];
  partnerId: number;
  dateFrom: string;
  proposed: Record<string, string>;
  notes: Record<string, string>;
  pKey: (itemId: number, scopeKey: string) => string;
  getVal: (itemId: number, scopeKey: string, fallback: number | null) => string;
  onClose: () => void;
  makerName?: string | null;
  approverName?: string | null;
  status?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const SIZE_LABEL: Record<string, string> = {
  "0": "เบอร์ 0", "1": "เบอร์ 1", "2": "เบอร์ 2",
  "3": "เบอร์ 3", "4": "เบอร์ 4", "5": "เบอร์ 5",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotationModal({
  simItems, siteGroups, partnerId, dateFrom, proposed, notes, pKey, getVal, onClose,
  makerName, approverName, status,
}: Props) {
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/business-partners/${partnerId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setPartner(d));
  }, [partnerId]);

  const todayISO = todayBkk();

  // Group items by primary_size for section headers
  const sizes = Array.from(new Set(simItems.map(r => r.item.primary_size).filter(Boolean))) as string[];
  sizes.sort();

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>ใบเสนอราคา</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans Thai', sans-serif; font-size: 12px; color: #111; background: white; padding: 24px; }
        h1 { font-size: 20px; font-weight: 700; }
        h2 { font-size: 14px; font-weight: 600; }
        .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .doc-label { font-size: 22px; font-weight: 700; text-align: right; color: #222; }
        .quotation-word { font-size: 11px; letter-spacing: 2px; color: #888; text-align: right; }
        .divider { border-top: 2px solid #111; margin: 8px 0; }
        .thin { border-top: 1px solid #ccc; margin: 6px 0; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .meta-row { display: flex; justify-content: space-between; gap: 8px; }
        .meta-label { color: #666; width: 160px; flex-shrink: 0; }
        .doc-right { text-align: right; }
        .doc-status { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 12px; font-size: 10px; border: 1px solid #f59e0b; color: #b45309; background: #fffbeb; }
        .doc-addr { font-size: 10px; color: #6b7280; margin-top: 2px; }
        .doc-customer-label { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
        .doc-company { font-weight: 600; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f4f4f4; padding: 6px 8px; text-align: right; font-weight: 600; border-bottom: 2px solid #ccc; }
        th:first-child, th:nth-child(2) { text-align: left; }
        td { padding: 5px 8px; text-align: right; border-bottom: 1px solid #eee; }
        td:first-child, td:nth-child(2) { text-align: left; }
        .size-header td { background: #f8f8f8; font-weight: 600; color: #444; padding: 4px 8px; }
        .bold { font-weight: 700; }
        .neg { color: #c00; }
        .pos { color: #080; }
        .sep { border-left: 2px solid #ccc; }
        .draft-watermark {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 100px; color: rgba(0,0,0,0.06); font-weight: 900; letter-spacing: 8px; pointer-events: none;
          white-space: nowrap;
        }
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; margin-top: 0.5rem; font-size: 12px; }
        .sig-label-top { font-size: 10px; color: #9ca3af; margin-bottom: 24px; }
        .sig-line { border-bottom: 1px solid #9ca3af; margin-bottom: 4px; padding-bottom: 4px; min-height: 24px; }
        .sig-name { font-weight: 500; color: #374151; }
        .sig-role { font-size: 10px; color: #9ca3af; }
        .footer-note { border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #6b7280; }
      </style>
    </head><body>${content.innerHTML}<div class="draft-watermark">DRAFT</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="bg-white dark:bg-background rounded-xl shadow-2xl w-full max-w-4xl flex flex-col">

          {/* Modal chrome */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div>
              <h2 className="text-lg font-semibold">ใบเสนอราคาลูกค้า</h2>
              <p className="text-sm text-muted-foreground">
                {partner?.nickname ?? "..."} · เริ่มใช้ {fmtDate(dateFrom)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
                พิมพ์ PDF
              </Button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable document */}
          <div className="overflow-y-auto p-6">
            <div ref={printRef} className="bg-white text-black font-sans text-sm space-y-4" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>

              {/* Letterhead */}
              <div className="header flex justify-between items-start">
                <div>
                  <p className="text-lg font-bold">บริษัท ไชยมงคล จำกัด</p>
                  <p className="doc-addr text-xs text-gray-500 mt-0.5">เลขที่ 8 หมู่ที่ 8 ตำบลอาษา อำเภอบ้านนา จังหวัดนครนายก 26110</p>
                  <p className="doc-addr text-xs text-gray-500">โทร 092-9355526</p>
                </div>
                <div className="doc-right text-right">
                  <p className="doc-label text-2xl font-bold tracking-tight">ใบเสนอราคา</p>
                  <p className="quotation-word text-xs tracking-widest text-gray-400 uppercase">Quotation</p>
                  <span className="doc-status inline-block mt-1 px-2 py-0.5 rounded-full text-xs border border-amber-400 text-amber-700 bg-amber-50">
                    ฉบับร่าง · ยังไม่อนุมัติ
                  </span>
                </div>
              </div>

              <div className="divider border-t-2 border-black" />

              {/* Customer + meta */}
              <div className="meta grid grid-cols-2 gap-6">
                <div>
                  <p className="doc-customer-label text-xs text-gray-500 mb-1">นามลูกค้า</p>
                  <p className="doc-company font-semibold">{partner?.businessName ?? partner?.nickname ?? "—"}</p>
                  {partner?.addressLine1 && (
                    <p className="doc-addr text-xs text-gray-500 mt-0.5">
                      {partner.addressLine1}{partner.district ? " " + partner.district : ""}{partner.province ? " " + partner.province : ""}{partner.postalCode ? " " + partner.postalCode : ""}
                    </p>
                  )}
                  {partner?.taxId && <p className="doc-addr text-xs text-gray-500 mt-0.5">เลขประจำตัวผู้เสียภาษี: {partner.taxId}</p>}
                </div>
                <div className="space-y-1.5 text-sm">
                  {[
                    ["วันที่ส่งใบเสนอราคา", fmtDate(todayISO)],
                    ["วันที่มีผล", fmtDate(dateFrom)],
                    ["เครดิต", partner?.creditDays != null ? `${partner.creditDays} วัน` : "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="meta-row flex justify-between gap-4">
                      <span className="meta-label text-gray-500">{label}</span>
                      <span className="font-medium tabular-nums">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500">บริษัทฯ มีความยินดีขอเสนอราคาสินค้า ดังรายละเอียดต่อไปนี้</p>

              {/* Items table */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 pr-3 font-semibold text-gray-700">รหัส / รายการ</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคาเดิม</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคาเสนอ</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">เปลี่ยน</th>
                    <th className="text-right py-2 pl-2 pr-3 font-semibold text-gray-700">/ ฟอง</th>
                    {siteGroups.length > 0 && (
                      <th className="border-l-2 border-gray-300 py-2 px-2" />
                    )}
                    {siteGroups.map(sg => (
                      <th key={sg.id} className="text-right py-2 px-2 font-semibold text-gray-700 whitespace-nowrap">
                        {sg.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map(size => {
                    const rows = simItems.filter(r => r.item.primary_size === size);
                    if (!rows.length) return null;
                    return (
                      <>
                        <tr key={`size-${size}`} className="bg-gray-50">
                          <td colSpan={5 + (siteGroups.length > 0 ? siteGroups.length + 1 : 0)}
                            className="py-1.5 px-2 font-semibold text-gray-500 text-[10px] uppercase tracking-wide">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${SIZE_PILL[size] ?? "bg-gray-100 text-gray-600"}`}>
                              {SIZE_LABEL[size] ?? `เบอร์ ${size}`}
                            </span>
                          </td>
                        </tr>
                        {rows.map(row => {
                          const defaultPropVal = getVal(row.item.id, "default", row.scopes.find(s => s.key === "default")?.currentPrice ?? null);
                          const defaultPropNum = defaultPropVal !== "" ? parseFloat(defaultPropVal) : null;
                          const defaultCurrent = row.scopes.find(s => s.key === "default")?.currentPrice ?? null;
                          const delta = defaultPropNum != null && defaultCurrent != null ? defaultPropNum - defaultCurrent : null;
                          const perEgg = defaultPropNum != null ? defaultPropNum / row.item.eggs_per_pack : null;
                          const note = notes[pKey(row.item.id, "default")];

                          return (
                            <tr key={row.item.id} className="border-b border-gray-100">
                              <td className="py-2 pr-3">
                                <p className="text-[10px] text-blue-600 font-mono">{row.item.sku ?? "—"}</p>
                                <p className="font-medium">{row.item.name}</p>
                                {note && <p className="text-[10px] text-gray-400 italic mt-0.5">{note}</p>}
                              </td>
                              <td className="text-right py-2 px-2 tabular-nums text-gray-500">
                                {fmt2(defaultCurrent)}
                              </td>
                              <td className="text-right py-2 px-2 tabular-nums font-bold">
                                {fmt2(defaultPropNum)}
                              </td>
                              <td className={`text-right py-2 px-2 tabular-nums ${delta != null && delta < 0 ? "text-red-600" : delta != null && delta > 0 ? "text-green-700" : "text-gray-400"}`}>
                                {delta != null && delta !== 0 ? (delta > 0 ? "+" : "") + delta.toFixed(1) : "—"}
                              </td>
                              <td className="text-right py-2 pl-2 pr-3 tabular-nums text-gray-500">
                                {perEgg != null ? perEgg.toFixed(2) : "—"}
                              </td>
                              {siteGroups.length > 0 && (
                                <td className="border-l-2 border-gray-300" />
                              )}
                              {siteGroups.map(sg => {
                                const sgVal = getVal(row.item.id, String(sg.id), row.scopes.find(s => s.siteGroupId === sg.id)?.currentPrice ?? null);
                                const sgNum = sgVal !== "" ? parseFloat(sgVal) : null;
                                return (
                                  <td key={sg.id} className="text-right py-2 px-2 tabular-nums">
                                    {fmt2(sgNum)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer note */}
              <div className="footer-note border-t pt-3 text-xs text-gray-500 space-y-1">
                <p>ราคานี้มีผลตั้งแต่วันที่ {fmtDate(dateFrom)}</p>
              </div>

              {/* Signature */}
              <div className="sig-grid border-t pt-4 mt-2 grid grid-cols-2 gap-8 text-sm">
                <div>
                  <p className="sig-label-top text-xs text-gray-400 mb-6">ผู้จัดทำ</p>
                  <div className="sig-line border-b border-gray-400 mb-1 pb-1 min-h-[24px]">
                    {["reviewed", "approved", "active"].includes(status ?? "") && makerName && (
                      <p className="sig-name font-medium text-gray-700">{makerName}</p>
                    )}
                  </div>
                  <p className="sig-role text-xs text-gray-400">ผู้จัดทำ</p>
                </div>
                <div>
                  <p className="sig-label-top text-xs text-gray-400 mb-6">ผู้อนุมัติ</p>
                  <div className="sig-line border-b border-gray-400 mb-1 pb-1 min-h-[24px]">
                    {["approved", "active"].includes(status ?? "") && approverName && (
                      <p className="sig-name font-medium text-gray-700">{approverName}</p>
                    )}
                  </div>
                  <p className="sig-role text-xs text-gray-400">ผู้อนุมัติ</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
