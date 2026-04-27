import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react"; // add this import at the top
import { z } from "zod";
import { HotTable } from "@handsontable/react";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

import Handsontable from "handsontable/base";
import { registerAllModules } from "handsontable/registry";
import * as XLSX from "xlsx";

registerAllModules();

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createOrder } from "@/lib/api/orders";
import { zodResolver } from "@hookform/resolvers/zod";

export default function OrderUploadPage() {
  // State for simplified upload page
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [excelText, setExcelText] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);

  const [orderDate, setOrderDate] = useState("");
  const [manufacturerCode, setManufacturerCode] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");

  const [gridData, setGridData] = useState<any[][]>([["", "", "", ""]]);

  const hotRef = useRef<any>(null);

  const defaultHeaders = ["รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "ราคา"];

  const makroHeaders = [
    "ผู้ซื้อ",
    "รายการ",
    "รหัสผู้ผลิต",
    "รหัสแม็คโคร",
    "บาร์โค้ด",
    "จำนวน (หน่วย)",
    "ชนิด (บรรจุ)",
    "จำนวนสั่งซื้อ",
    "ได้รับ",
  ];

  const headers = selectedCustomer === "makro" ? makroHeaders : defaultHeaders;

  const columnsConfig = headers.map(() => ({ type: "text" }));
  const colWidths = headers.map(() => 160);

  useEffect(() => {
    const emptyRow = headers.map(() => "");
    setGridData([emptyRow]);
  }, [selectedCustomer]);

  function parseExcelText(text: string) {
    const rows = text
      .trim()
      .split("\n")
      .map((row) => row.split("\t"));
    setParsedRows(rows);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to array of arrays
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        // Process Makro file structure
        const normalizedRows = processMakroFile(rows);

        // Validate barcodes after processing
        const { valid, missing } = await validateBarcodes(normalizedRows);

        if (!valid) {
          alert(`ไม่พบสินค้าจากบาร์โค้ดต่อไปนี้:\n${missing.join("\n")}`);
          setParsedRows([]);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
      setParsedRows([]);
    }
  }

  function processMakroFile(rows: any[][]) {
    if (!Array.isArray(rows)) {
      console.error("Invalid rows format. Expected array of arrays.");
      setParsedRows([]);
      return [];
    }

    const startIndex = 28; // Excel row 29

    if (rows.length <= startIndex) {
      setParsedRows([]);
      return [];
    }

    const remarksIndex = rows.findIndex((row, idx) => {
      if (idx <= startIndex) return false;
      return row.some((cell) => String(cell).toLowerCase().includes("remarks"));
    });

    const endIndex = remarksIndex === -1 ? rows.length : remarksIndex;
    const dataRows = rows.slice(startIndex, endIndex);

    const cleaned = dataRows.filter((row) =>
      row.some((cell) => cell !== null && cell !== ""),
    );

    const trimmed = cleaned.map((row) => {
      const newRow = [...row];

      if (newRow.length > 16) newRow.splice(16, 1);
      if (newRow.length > 14) newRow.splice(14, 1);
      if (newRow.length > 13) newRow.splice(13, 1);
      if (newRow.length > 11) newRow.splice(11, 1);
      if (newRow.length > 9) newRow.splice(9, 1);
      if (newRow.length > 7) newRow.splice(7, 1);
      if (newRow.length > 4) newRow.splice(4, 1);
      if (newRow.length > 2) newRow.splice(2, 1);

      return newRow;
    });

    const normalized = trimmed.map((row) => ({
      buyer: row[0] ?? "",
      description: row[1] ?? "",
      manufacturerCode: row[2] ?? "",
      makroCode: row[3] ?? "",
      barcode: row[4] ?? "",
      unitQty: row[5] ?? "",
      packType: row[6] ?? "",
      orderedQty: row[7] ?? "",
      receivedQty: row[8] ?? "",
    }));

    setParsedRows(normalized);
    return normalized;
  }

  // 1️⃣ Add handleCreateOrder helper function above the return statement
  async function handleCreateOrder() {
    if (!selectedCustomer || parsedRows.length === 0) return;

    try {
      // 1️⃣ Resolve partnerId from selected customer
      const partnerMap: Record<string, number> = {
        bigc: 1,
        makro: 2,
        cj: 3,
        thai_foods: 4,
      };

      const partnerId = partnerMap[selectedCustomer];

      // 2️⃣ Fetch products by barcode and build products array
      const products = await Promise.all(
        parsedRows.map(async (row: any) => {
          const barcode = row.barcode;

          const res = await fetch(`/api/finished-goods/barcode/${barcode}`);
          if (!res.ok) {
            throw new Error(`ไม่พบสินค้า Barcode: ${barcode}`);
          }

          const product = await res.json();

          return {
            productId: product.id,
            sellingUnits: product.sellingUnits,
            price: Number(product.price ?? 0),
            quantity: Number(row.orderedQty ?? 0),
          };
        }),
      );

      // 3️⃣ Build order payload
      const payload = {
        orderNumber: undefined,
        partnerId,
        deliverySiteId: 1, // temporarily fixed — can enhance later
        deliveryDate: orderDate,
        notes: `PO: ${purchaseOrderNo}`,
        products,
        status: "pending",
      };

      console.log("Order payload:", payload);

      await createOrder(payload);

      alert("สร้างใบสั่งขายสำเร็จ");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "เกิดข้อผิดพลาด");
    }
  }

  async function validateBarcodes(rows: any[]) {
    const uniqueBarcodes = [
      ...new Set(rows.map((row) => row.barcode).filter(Boolean)),
    ];

    if (uniqueBarcodes.length === 0) return { valid: true, missing: [] };

    const response = await fetch("/api/finished-goods/barcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcodes: uniqueBarcodes }),
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถตรวจสอบบาร์โค้ดได้");
    }

    const data = await response.json();

    return {
      valid: data.missingBarcodes.length === 0,
      missing: data.missingBarcodes,
    };
  }

  return (
    <div className="min-h-screen">
      <div className="space-y-6 py-8 px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">อัปโหลดใบสั่งขาย</h1>
            <p className="text-muted-foreground">นำเข้าข้อมูลจาก Excel</p>
          </div>
        </div>

        <Card className="w-full">
          <CardContent className="pt-6 space-y-6">
            {/* Customer Selection */}
            <div className="w-[300px]">
              <label className="text-sm font-medium">ลูกค้า *</label>
              <Select
                value={selectedCustomer}
                onValueChange={setSelectedCustomer}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bigc">Big C</SelectItem>
                  <SelectItem value="makro">Makro</SelectItem>
                  <SelectItem value="cj">CJ</SelectItem>
                  <SelectItem value="thai_foods">Thai Foods</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  selectedCustomer
                    ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                อัปโหลดไฟล์ Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={!selectedCustomer}
                />
              </label>
            </div>
            {/* Additional Order Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  วันที่สั่งสินค้า *
                </label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">รหัสผู้ผลิต</label>
                <Input
                  placeholder="กรอกรหัสผู้ผลิต"
                  value={manufacturerCode}
                  onChange={(e) => setManufacturerCode(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">เลขที่ใบสั่งซื้อ</label>
                <Input
                  placeholder="กรอกเลขที่ใบสั่งซื้อ"
                  value={purchaseOrderNo}
                  onChange={(e) => setPurchaseOrderNo(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Excel Paste Area */}
            {/* <div className="space-y-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  วางข้อมูลจาก Excel (Ctrl+V)
                </label>

                <HotTable
                  ref={hotRef}
                  data={gridData}
                  colHeaders={headers}
                  columns={columnsConfig}
                  colWidths={colWidths}
                  rowHeaders={true}
                  width="100%"
                  height="400"
                  stretchH="all"
                  minSpareRows={5}
                  copyPaste={{ rowsLimit: 1000, columnsLimit: 1000 }}
                  licenseKey="non-commercial-and-evaluation"
                  afterChange={(changes, source) => {
                    if (!changes || source === "loadData") return;

                    const hot = hotRef.current?.hotInstance;
                    if (!hot) return;

                    setGridData(hot.getData());
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                รองรับข้อมูลแบบคั่นด้วย Tab (Copy จาก Excel ได้เลย)
              </p>
            </div> */}

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="border rounded-lg overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 border-r">ผู้ซื้อ</th>
                      <th className="px-3 py-2 border-r">รายการ</th>
                      <th className="px-3 py-2 border-r">รหัสผู้ผลิต</th>
                      <th className="px-3 py-2 border-r">รหัสแม็คโคร</th>
                      <th className="px-3 py-2 border-r">บาร์โค้ด</th>
                      <th className="px-3 py-2 border-r">จำนวน (หน่วย)</th>
                      <th className="px-3 py-2 border-r">ชนิด (บรรจุ)</th>
                      <th className="px-3 py-2 border-r">จำนวนสั่งซื้อ</th>
                      <th className="px-3 py-2">ได้รับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row: any, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((cell: any, j: number) => (
                          <td key={j} className="px-3 py-2 border-r">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                disabled={!selectedCustomer || parsedRows.length === 0}
                onClick={handleCreateOrder}
                className="bg-gray-500 hover:bg-gray-600 text-white disabled:bg-gray-300"
              >
                สร้างใบสั่งขายจากไฟล์
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
