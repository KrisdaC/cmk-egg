// server/lib/bomResolve.ts
// Shared BOM/packaging_profile resolution — extracted from
// server/routes/bom.ts so both the whole-day BOM tab and Packing's
// round-scoped material check (server/routes/packing.ts) use the exact
// same resolution logic instead of two copies drifting apart.
// See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

export type PkgSlot = { enabled?: boolean; item_type?: string; component_sku?: string; qty_per_pack?: number };
export type AdditionalMaterial = { component_sku?: string; item_type?: string; qty_per_pack?: number; notes?: string };

export type ComponentLine = {
  componentSku: string;
  componentName: string | null;
  itemType: string | null;
  role: string;
  source: "profile" | "additional";
  qtyPerPack: number;
  qtyNeeded: number;
  resolved: boolean;
};

export const ISSUE_LABEL: Record<string, string> = {
  missing_master: "ไม่พบ SKU ใน Master Data",
  no_bom_lines: "ยังไม่ตั้งค่า BOM/Packaging Profile",
  missing_sku: "ยังไม่เลือก SKU วัตถุดิบ",
  missing_qty: "ยังไม่ระบุจำนวนต่อแพ็ก",
  unknown_component: "SKU วัตถุดิบไม่พบใน Master Data",
};

// packaging_profile/additional_materials are TEXT columns holding JSON (not
// jsonb) — same defensive parse server/routes/priceAdjustment.ts already
// uses, since the driver can hand back either a string or a pre-parsed value.
export function parseJsonColumn<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return val as T;
}

// additional_materials is declared as an array but real rows can hold a
// stray "{}" instead of "[]" (confirmed live: item 592) — normalize rather
// than let a bad shape crash the whole requirements computation.
export function parseAdditionalMaterials(val: unknown): AdditionalMaterial[] {
  const parsed = parseJsonColumn<unknown>(val, []);
  return Array.isArray(parsed) ? (parsed as AdditionalMaterial[]) : [];
}

// Pass 1 — parse one item's raw packaging_profile/additional_materials into
// usable slots/extras, before any component SKU has been resolved yet.
// Callers use this to collect every referenced component_sku across many
// items, batch-fetch them once, then call resolveBomComponents per item.
export function extractBomSlots(it: { packaging_profile: unknown; additional_materials: unknown }): { slots: PkgSlot[]; extras: AdditionalMaterial[] } {
  const profileRaw = parseJsonColumn<unknown>(it.packaging_profile, {});
  const profile: Record<string, PkgSlot> = profileRaw && typeof profileRaw === "object" && !Array.isArray(profileRaw) ? (profileRaw as Record<string, PkgSlot>) : {};
  const slots = Object.values(profile).filter(s => s && s.enabled && s.component_sku);
  const extras = parseAdditionalMaterials(it.additional_materials).filter(m => m && m.component_sku);
  return { slots, extras };
}

// Pass 2 — resolve one item's slots/extras into real component lines
// (qtyNeeded = qtyPerPack × plannedPacks) and classify setup issues, now
// that componentBySku is available.
export function resolveBomComponents(
  slots: PkgSlot[],
  extras: AdditionalMaterial[],
  plannedPacks: number,
  componentBySku: Map<string, { name: string; item_type: string | null }>,
): { components: ComponentLine[]; issueReasons: Set<string> } {
  const components: ComponentLine[] = [];
  const issueReasons = new Set<string>();

  const addLine = (role: string, source: "profile" | "additional", sku: string, qtyPerPack: number | undefined, itemType: string | undefined) => {
    if (!sku) { issueReasons.add("missing_sku"); return; }
    if (qtyPerPack == null || !Number.isFinite(qtyPerPack) || qtyPerPack <= 0) issueReasons.add("missing_qty");
    const comp = componentBySku.get(sku);
    if (!comp) issueReasons.add("unknown_component");
    components.push({
      componentSku: sku, componentName: comp?.name ?? null, itemType: comp?.item_type ?? itemType ?? null,
      role, source, qtyPerPack: qtyPerPack ?? 0, qtyNeeded: (qtyPerPack ?? 0) * plannedPacks, resolved: !!comp,
    });
  };
  for (const s of slots) addLine("packaging_profile", "profile", s.component_sku!, s.qty_per_pack, s.item_type);
  for (const m of extras) addLine(m.item_type || "other", "additional", m.component_sku!, m.qty_per_pack, m.item_type);

  if (components.length === 0) issueReasons.add("no_bom_lines");
  return { components, issueReasons };
}
