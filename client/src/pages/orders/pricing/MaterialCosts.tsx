import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  X,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ──────────────────────────────────────────────
// CSV parsing
// ──────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  "5000000": "5M",
  "1000000": "1M",
  "500000": "500K",
  "400000": "400K",
  "300000": "300K",
  "200000": "200K",
  "100000": "100K",
  "80000": "80K",
  "70000": "70K",
  "50000": "50K",
  "40000": "40K",
  "30000": "30K",
  "20000": "20K",
  "10000": "10K",
  "5000": "5K",
};

const TIER_KEYS = Object.keys(TIER_LABELS);

const CSV_TIER_COLS = [
  "จำนวน 5000000",
  "จำนวน 1000000",
  "จำนวน 500000",
  "จำนวน 400000",
  "จำนวน 300000",
  "จำนวน 200000",
  "จำนวน 100000",
  "จำนวน 80000",
  "จำนวน 70000",
  "จำนวน 50000",
  "จำนวน 40000",
  "จำนวน 30000",
  "จำนวน 20000",
  "จำนวน 10000",
  "จำนวน 5000",
];

interface ParsedRow {
  sku: string;
  effectiveDate: string;
  supplierName: string;
  partner: string;
  itemDescription: string;
  tieredPrices: Record<string, number | null>;
  notes: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseThaiDate(d: string): string {
  const parts = d.split("/");
  if (parts.length !== 3) return d;
  const [dd, mm, buddhistYear] = parts;
  const year = parseInt(buddhistYear) - 543;
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) =>
    h.replace(/﻿/g, "").trim()
  );

  const colIdx = (name: string) => header.findIndex((h) => h === name);
  const skuIdx = colIdx("sku");
  const dateIdx = colIdx("วันที่เริ่มต้นกำหนด");
  const supplierIdx = colIdx("Suppliers");
  const partnerIdx = colIdx("ผู้ค้า");
  const descIdx = colIdx("รายการ");
  const notesIdx = colIdx("ยกเลิก");
  const tierIdxs = CSV_TIER_COLS.map((c) => colIdx(c));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCSVLine(line);
    const sku = cells[skuIdx]?.trim();
    if (!sku) continue;

    const tieredPrices: Record<string, number | null> = {};
    tierIdxs.forEach((idx, pos) => {
      const val = cells[idx]?.trim();
      const num = val ? parseFloat(val) : NaN;
      tieredPrices[TIER_KEYS[pos]] = val && val !== "" && !isNaN(num) ? num : null;
    });

    rows.push({
      sku,
      effectiveDate: parseThaiDate(cells[dateIdx]?.trim() ?? ""),
      supplierName: cells[supplierIdx]?.trim() ?? "",
      partner: cells[partnerIdx]?.trim() || "ALL",
      itemDescription: cells[descIdx]?.trim() ?? "",
      tieredPrices,
      notes: cells[notesIdx]?.trim() ?? "",
    });
  }
  return rows;
}

// ──────────────────────────────────────────────
// Helper: best price (lowest qty tier with a value)
// ──────────────────────────────────────────────
function bestPrice(tiers: Record<string, number | null>): number | null {
  for (const k of [...TIER_KEYS].reverse()) {
    if (tiers[k] != null) return tiers[k];
  }
  return null;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// History types
// ──────────────────────────────────────────────

interface HistoryRecord {
  id: number;
  sku: string | null;
  effectiveDate: string;
  supplierName: string;
  partner: string;
  itemDescription: string | null;
  tieredPrices: Record<string, number | null>;
  notes: string | null;
  isCurrent: boolean;
  uploadedAt: string;
}

const PARTNER_COLORS: Record<string, string> = {
  ALL: "bg-slate-100 text-slate-700",
  Makro: "bg-blue-100 text-blue-700",
  "Big-c": "bg-amber-100 text-amber-700",
  Lotus: "bg-green-100 text-green-700",
  "Mother's Egg": "bg-pink-100 text-pink-700",
  "CJ MORE": "bg-purple-100 text-purple-700",
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function MaterialCosts() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skuStatus, setSkuStatus] = useState<Record<string, { found: boolean; name?: string }>>({});
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());

  const { data: history = [], refetch: refetchHistory } = useQuery<HistoryRecord[]>({
    queryKey: ["/api/material-costs"],
    queryFn: () => fetch("/api/material-costs").then((r) => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: ParsedRow[]) =>
      apiRequest("POST", "/api/material-costs/upload", { rows: data }),
    onSuccess: (res: any) => {
      toast({ title: "บันทึกสำเร็จ", description: `บันทึก ${res.inserted} รายการแล้ว` });
      setRows([]);
      setSkuStatus({});
      setFileName("");
      refetchHistory();
      setHistoryOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      toast({ title: "ไม่พบข้อมูล", description: "ตรวจสอบรูปแบบไฟล์อีกครั้ง", variant: "destructive" });
      return;
    }
    setRows(parsed);

    // validate SKUs
    setValidating(true);
    try {
      const skuSet = new Set(parsed.map((r) => r.sku));
      const unique = Array.from(skuSet);
      const res = await apiRequest("POST", "/api/material-costs/validate-skus", { skus: unique });
      setSkuStatus(res as unknown as Record<string, { found: boolean; name?: string }>);
    } finally {
      setValidating(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const invalidSkus = rows.filter((r) => skuStatus[r.sku] && !skuStatus[r.sku].found);
  const allValid = rows.length > 0 && !validating && invalidSkus.length === 0;

  const partnerColors: Record<string, string> = {
    ALL: "bg-slate-100 text-slate-700",
    Makro: "bg-blue-100 text-blue-700",
    "Big-c": "bg-amber-100 text-amber-700",
    Lotus: "bg-green-100 text-green-700",
    "Mother's Egg": "bg-pink-100 text-pink-700",
    "CJ MORE": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Material Costs · ต้นทุนวัสดุ</h1>
          <p className="text-muted-foreground">
            อัปโหลดราคาวัสดุบรรจุภัณฑ์จากผู้ขาย — สติ๊กเกอร์, ถาด, กล่อง
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/import/material-costs-test.csv" download>
            <Download className="w-4 h-4 mr-2" />
            ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </Button>
      </div>

      {/* Drop zone */}
      {rows.length === 0 && (
        <Card
          className="border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-base font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-sm text-muted-foreground">รองรับ CSV (UTF-8) ตามรูปแบบในไฟล์ตัวอย่าง</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {fileName} — {rows.length} รายการ
              </CardTitle>
              <div className="flex items-center gap-2">
                {validating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!validating && invalidSkus.length > 0 && (
                  <Badge variant="destructive">{invalidSkus.length} SKU ไม่พบ</Badge>
                )}
                {!validating && invalidSkus.length === 0 && rows.length > 0 && (
                  <Badge className="bg-green-100 text-green-800">SKU ถูกต้องทั้งหมด</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRows([]); setSkuStatus({}); setFileName(""); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="w-32">SKU</TableHead>
                    <TableHead>ชื่อวัสดุ</TableHead>
                    <TableHead className="w-28">วันที่มีผล</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-24">ผู้ค้า</TableHead>
                    <TableHead className="w-20 text-right">ราคาต่ำสุด</TableHead>
                    <TableHead className="w-20 text-right">ราคาสูงสุด</TableHead>
                    <TableHead className="w-24">หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const status = skuStatus[row.sku];
                    const prices = Object.values(row.tieredPrices).filter((v): v is number => v != null && !isNaN(v));
                    const minP = prices.length ? Math.min(...prices) : null;
                    const maxP = prices.length ? Math.max(...prices) : null;

                    return (
                      <TableRow key={i} className={status && !status.found ? "bg-red-50" : ""}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {status ? (
                              status.found ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              )
                            ) : (
                              <div className="w-3.5 h-3.5" />
                            )}
                            <span className="font-mono text-xs">{row.sku}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {status?.name ? (
                            <span>{status.name}</span>
                          ) : (
                            <span className="text-muted-foreground italic">{row.itemDescription}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{row.effectiveDate}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate" title={row.supplierName}>
                          {row.supplierName}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${partnerColors[row.partner] ?? "bg-slate-100 text-slate-700"}`}>
                            {row.partner}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {minP != null ? minP.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {maxP != null ? maxP.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.notes}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {invalidSkus.length > 0
              ? `แก้ไข SKU ที่ไม่พบก่อนบันทึก (${invalidSkus.length} รายการ)`
              : `พร้อมบันทึก ${rows.length} รายการ`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              เปลี่ยนไฟล์
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
            </Button>
            <Button
              disabled={!allValid || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate(rows)}
            >
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              บันทึก {rows.length} รายการ
            </Button>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4" />
                    ประวัติราคาวัสดุ
                    <Badge variant="outline" className="text-xs">{history.length} รายการ</Badge>
                  </CardTitle>
                  {historyOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <HistoryTable
                  records={history}
                  expandedSkus={expandedSkus}
                  onToggle={(sku) =>
                    setExpandedSkus((prev) => {
                      const next = new Set(prev);
                      if (next.has(sku)) next.delete(sku); else next.add(sku);
                      return next;
                    })
                  }
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// History table sub-component
// ──────────────────────────────────────────────

function HistoryTable({
  records,
  expandedSkus,
  onToggle,
}: {
  records: HistoryRecord[];
  expandedSkus: Set<string>;
  onToggle: (key: string) => void;
}) {
  // Group by SKU (or "—" if null), then sort by effectiveDate DESC within each group
  const grouped = new Map<string, HistoryRecord[]>();
  for (const r of records) {
    const key = r.sku ?? `no-sku-${r.id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  // Sort groups by most recent effectiveDate
  const sortedGroups = Array.from(grouped.entries()).sort(([, a], [, b]) => {
    const aDate = a[0].effectiveDate;
    const bDate = b[0].effectiveDate;
    return bDate.localeCompare(aDate);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead className="w-36">SKU</TableHead>
          <TableHead>รายการ</TableHead>
          <TableHead className="w-28">วันที่ล่าสุด</TableHead>
          <TableHead className="w-24">ผู้ค้า</TableHead>
          <TableHead className="w-40">Supplier</TableHead>
          <TableHead className="text-right w-24">ราคาต่ำสุด</TableHead>
          <TableHead className="text-right w-24">ราคาสูงสุด</TableHead>
          <TableHead className="w-12 text-center">เวอร์ชัน</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedGroups.map(([key, recs]) => {
          const latest = recs[0];
          const expanded = expandedSkus.has(key);
          const allPrices = recs.flatMap((r) =>
            Object.values(r.tieredPrices).filter((v): v is number => v != null && !isNaN(v))
          );
          const minP = allPrices.length ? Math.min(...allPrices) : null;
          const maxP = allPrices.length ? Math.max(...allPrices) : null;

          return (
            <>
              <TableRow
                key={key}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onToggle(key)}
              >
                <TableCell className="pr-0">
                  {expanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{latest.sku ?? "—"}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {latest.itemDescription ?? <span className="text-muted-foreground italic">ไม่มีข้อมูล</span>}
                </TableCell>
                <TableCell className="tabular-nums text-sm">{latest.effectiveDate}</TableCell>
                <TableCell>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PARTNER_COLORS[latest.partner] ?? "bg-slate-100 text-slate-700"}`}>
                    {latest.partner}
                  </span>
                </TableCell>
                <TableCell className="text-sm max-w-[160px] truncate text-muted-foreground" title={latest.supplierName}>
                  {latest.supplierName}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {minP != null ? `฿${minP.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {maxP != null ? `฿${maxP.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={recs.length > 1 ? "secondary" : "outline"} className="text-xs tabular-nums">
                    {recs.length}
                  </Badge>
                </TableCell>
              </TableRow>

              {expanded && recs.map((r) => {
                const prices = Object.entries(r.tieredPrices)
                  .filter(([, v]) => v != null && !isNaN(v as number))
                  .map(([k, v]) => ({ tier: TIER_LABELS[k] ?? k, val: v as number }));

                return (
                  <TableRow key={r.id} className="bg-muted/20 text-xs">
                    <TableCell />
                    <TableCell className="text-muted-foreground pl-6">{r.effectiveDate}</TableCell>
                    <TableCell className="text-muted-foreground" colSpan={2}>
                      {r.supplierName}
                      {r.notes && <span className="ml-2 italic opacity-60">{r.notes}</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PARTNER_COLORS[r.partner] ?? "bg-slate-100 text-slate-700"}`}>
                        {r.partner}
                      </span>
                    </TableCell>
                    <TableCell colSpan={3}>
                      <div className="flex flex-wrap gap-1.5">
                        {prices.map(({ tier, val }) => (
                          <span key={tier} className="inline-flex items-center gap-0.5 bg-background border rounded px-1.5 py-0.5 text-xs tabular-nums">
                            <span className="text-muted-foreground">{tier}</span>
                            <span className="font-medium">฿{val.toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.isCurrent && <Badge className="bg-green-100 text-green-700 text-xs">ปัจจุบัน</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
