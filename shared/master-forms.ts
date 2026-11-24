// Pure helpers behind the item, partner and delivery-site edit forms.
//
// Rule (UAT finding K1): opening a record and saving it unchanged must change
// nothing, and a form must show every value it holds. The three forms broke
// that rule in four ways, each fixed here so it can be tested without React:
//   1. a <Select> only offered a fixed list, so a stored value outside the list
//      (e.g. 'Credit', a legacy unit) displayed as empty  → withStoredOption
//   2. truthiness checks treated the number 0 as "missing" (primary grade 0)
//      → hasValue
//   3. defaults and derived fields were re-applied on load/save (payment terms
//      forced to COD, credit days recalculated)            → creditDaysForSave
//   4. the site region select was bound to delivery_zone, but the data lives in
//      delivery_region                                      → siteRecordToForm

export type Option = { value: string; label: string };

/** True for any real value, including the number 0 and false. */
export function hasValue<T>(v: T | null | undefined | ""): v is T {
  return v !== null && v !== undefined && v !== "";
}

/** The options plus the stored value, if the list does not already contain it. */
export function withStoredOption(
  options: readonly Option[],
  stored: string | null | undefined,
  note = "ค่าที่บันทึกไว้",
): Option[] {
  const s = stored == null ? "" : String(stored);
  if (!s || options.some(o => o.value === s)) return [...options];
  return [...options, { value: s, label: `${s} (${note})` }];
}

// ── Partner ───────────────────────────────────────────────────────────────────

export const BUSINESS_TYPES: Option[] = [
  { value: "Individual", label: "บุคคลธรรมดา" },
  { value: "Corporation", label: "นิติบุคคล" },
];

export const CUSTOMER_TYPES: Option[] = [
  { value: "Traditional Trade", label: "ค้าปลีกดั้งเดิม" },
  { value: "Modern Trade", label: "ค้าปลีกสมัยใหม่" },
];

export const PAYMENT_TERMS_OPTIONS = [
  { value: "Cash", label: "เงินสด", creditDays: 0 },
  { value: "COD", label: "เก็บเงินปลายทาง (COD)", creditDays: 0 },
  { value: "Credit 7 Days", label: "เครดิต 7 วัน", creditDays: 7 },
  { value: "Credit 15 Days", label: "เครดิต 15 วัน", creditDays: 15 },
  { value: "Credit 30 Days", label: "เครดิต 30 วัน", creditDays: 30 },
] as const;

/**
 * Credit days to save. Terms the form knows (Credit 15 Days …) set the days;
 * for anything else (the stored plain "Credit") keep whatever the record had,
 * so saving never wipes a value the form cannot derive.
 */
export function creditDaysForSave(
  paymentTerms: string | null | undefined,
  original?: { paymentTerms?: string | null; creditDays?: number | null } | null,
): number | null {
  const known = PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms);
  if (known) return known.creditDays;
  if (original && (original.paymentTerms ?? "") === (paymentTerms ?? "")) return original.creditDays ?? null;
  return null;
}

const PARTNER_TEXT_FIELDS = [
  "businessName", "businessType", "customerType", "branchCode", "branchName", "taxId", "addressLine1",
  "addressLine2", "district", "subDistrict", "province", "postalCode", "country", "paymentTerms", "customerTier",
] as const;

/** Partner record → form values. Nothing is defaulted on edit (no forced "COD"). */
export function partnerRecordToForm(a: Record<string, any>) {
  return {
    nickname: a.nickname ?? "",
    code: a.code ?? "",
    businessName: a.businessName ?? "",
    businessType: a.businessType ?? "",
    customerType: a.customerType ?? "",
    branchCode: a.branchCode ?? "",
    branchName: a.branchName ?? "",
    taxId: a.taxId ?? "",
    addressLine1: a.addressLine1 ?? "",
    addressLine2: a.addressLine2 ?? "",
    district: a.district ?? "",
    subDistrict: a.subDistrict ?? "",
    province: a.province ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country ?? "Thailand",
    paymentTerms: a.paymentTerms ?? "",
    customerTier: a.customerTier ?? "",
    isActive: a.isActive ?? true,
  };
}

/** Form values → API payload. Blank fields go back to null where the record had null. */
export function partnerFormToPayload(form: Record<string, any>, original?: Record<string, any> | null) {
  const out: Record<string, any> = { ...form };
  if (original) {
    for (const k of PARTNER_TEXT_FIELDS) {
      if (out[k] === "" && original[k] == null) out[k] = null;
    }
  }
  out.creditDays = creditDaysForSave(out.paymentTerms, original);
  return out;
}

// ── Delivery site ─────────────────────────────────────────────────────────────

/** Region values as stored in delivery_sites.delivery_region (Thai text). */
export const SITE_REGIONS: Option[] = [
  "กรุงเทพและปริมณฑล", "ภาคกลาง", "ภาคเหนือ", "ภาคอีสาน", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้", "ภาคใต้ (เกาะ)",
].map(v => ({ value: v, label: v }));

const REGION_ALIASES: Record<string, string> = {
  "ภาคตะวันออกเฉียงเหนือ": "ภาคอีสาน",
  bangkok: "กรุงเทพและปริมณฑล", central: "ภาคกลาง", north: "ภาคเหนือ", northeast: "ภาคอีสาน",
  east: "ภาคตะวันออก", west: "ภาคตะวันตก", south: "ภาคใต้",
};

/** Map older spellings and slugs onto the stored Thai value. Unknown values pass through. */
export function normalizeRegion(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return REGION_ALIASES[s] ?? s;
}

const SITE_TEXT_FIELDS = [
  "partnerBranchCode", "branchName", "addressLine1", "addressLine2", "district", "subDistrict", "province",
  "postalCode", "country", "deliveryRegion", "deliveryZone", "preferredTimeSlot", "accessInstructions", "googleMapsUrl",
] as const;

export function siteRecordToForm(s: Record<string, any>) {
  return {
    partnerId: s.partnerId,
    siteCode: s.siteCode ?? "",
    displayName: s.displayName ?? "",
    partnerBranchCode: s.partnerBranchCode ?? "",
    branchName: s.branchName ?? "",
    deliveryType: s.deliveryType ?? "direct_to_store",
    addressLine1: s.addressLine1 ?? "",
    addressLine2: s.addressLine2 ?? "",
    district: s.district ?? "",
    subDistrict: s.subDistrict ?? "",
    province: s.province ?? "",
    postalCode: s.postalCode ?? "",
    country: s.country ?? "Thailand",
    // the region lives in delivery_region (what planning groups by); delivery_zone is kept untouched
    deliveryRegion: normalizeRegion(s.deliveryRegion),
    deliveryZone: s.deliveryZone ?? "",
    preferredTimeSlot: s.preferredTimeSlot ?? "",
    accessInstructions: s.accessInstructions ?? "",
    acceptableVehicles: s.acceptableVehicles ?? [],
    googleMapsUrl: s.googleMapsUrl ?? "",
    isActive: s.isActive ?? true,
  };
}

export function siteFormToPayload(form: Record<string, any>, original?: Record<string, any> | null) {
  const out: Record<string, any> = { ...form };
  if (original) {
    for (const k of SITE_TEXT_FIELDS) {
      // a normalised region ("ภาคตะวันออกเฉียงเหนือ" → "ภาคอีสาน") is a real change the user can see; blanks are not
      if (out[k] === "" && original[k] == null) out[k] = null;
    }
  }
  return out;
}

// ── Item form ─────────────────────────────────────────────────────────────────

/** "0".."6" (a size stored as text) → 0..6; anything else (null, "mixed", "M") → null. */
export function gradeFromSize(size: string | number | null | undefined): number | null {
  if (size === null || size === undefined) return null;
  const t = String(size).trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** Selling-unit choices: the item's own units, plus the stored value if it is none of them. */
export function sellingUnitOptions(u: {
  base?: string | null; pack?: string | null; basket?: string | null; stored?: string | null;
}): Option[] {
  const opts: Option[] = [];
  if (u.base) opts.push({ value: u.base, label: `${u.base} (ฐาน · base)` });
  if (u.pack) opts.push({ value: u.pack, label: `${u.pack} (แพ็ค · pack)` });
  if (u.basket) opts.push({ value: u.basket, label: `${u.basket} (ตะกร้า · basket)` });
  return withStoredOption(opts, u.stored);
}

type PkgSlotLike = { enabled?: boolean; component_sku?: string | null };
type AddMatLike = { component_sku?: string | null };

/** True if the item has at least one real BOM line (an enabled packaging slot with a SKU, or an extra material). */
export function hasBomLines(
  profile: Record<string, PkgSlotLike> | null | undefined,
  extras: AddMatLike[] | null | undefined,
): boolean {
  const slots = Object.values(profile ?? {}).some(s => s && s.enabled && !!s.component_sku);
  const more = (extras ?? []).some(m => m && !!m.component_sku);
  return slots || more;
}

/** BOM readiness checks for the item form. Primary grade 0 is a real grade. */
export function bomReadinessChecks(i: {
  role?: string | null;
  sellingUnit?: string | null;
  eggsPerPack?: number | null;
  isEgg?: boolean | null;
  eggInputType?: string | null;
  primaryGrade?: number | null;
  packagingProfile?: Record<string, PkgSlotLike> | null;
  additionalMaterials?: AddMatLike[] | null;
}) {
  const isEgg = !!i.isEgg;
  const needsEggsPerPack = isEgg || (i.role ?? "").toUpperCase() === "FG";
  const gradeOk = i.eggInputType !== "graded" || hasValue(i.primaryGrade);
  const checks = [
    {
      key: "units",
      label: "หน่วยขาย + การแปลงหน่วยฐาน · Selling unit & base conversion",
      pass: !!i.sellingUnit && (!needsEggsPerPack || (i.eggsPerPack ?? 0) > 0),
    },
    {
      key: "bom",
      label: "มีรายการ BOM อย่างน้อย 1 รายการ · BOM has at least one line",
      pass: isEgg || hasBomLines(i.packagingProfile, i.additionalMaterials),
    },
    {
      key: "complete",
      label: "ทุกบรรทัดข้อมูลครบถ้วน · All component lines complete",
      pass: !isEgg || (!!i.eggInputType && gradeOk),
      hint: isEgg && !i.eggInputType
        ? "เลือก Egg input type ก่อน — ดู ⚠ ในส่วน Egg inputs"
        : (i.eggInputType === "graded" && !hasValue(i.primaryGrade) ? "ระบุ Primary grade" : undefined),
    },
  ];
  const failCount = checks.filter(c => !c.pass).length;
  return { checks, ok: failCount === 0, failCount };
}
