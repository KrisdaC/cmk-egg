import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_TYPES, CUSTOMER_TYPES, PAYMENT_TERMS_OPTIONS, SITE_REGIONS,
  bomReadinessChecks, creditDaysForSave, gradeFromSize, hasValue, normalizeRegion, partnerFormToPayload,
  partnerRecordToForm, sellingUnitOptions, siteFormToPayload, siteRecordToForm, withStoredOption,
} from "./master-forms";

// ── records shaped like the real UAT rows that QA said "show empty" ──────────
const bigC = {
  id: 2, code: "C002", nickname: "BigC", businessName: "บริษัท บิ๊กซี ซูเปอร์เซ็นเตอร์ จำกัด (มหาชน)",
  businessType: "Corporation", customerType: "Modern Trade", branchCode: "00000", branchName: "สำนักงานใหญ่",
  taxId: "0107536000633", addressLine1: "88/9", addressLine2: null, district: "แขวงพระโขนง", subDistrict: "เขตคลองเตย",
  province: "กรุงเทพมหานคร", postalCode: "10110", country: "Thailand",
  paymentTerms: "Credit", creditDays: null, customerTier: null, isActive: true,
};
const noTerms = { ...bigC, id: 9, code: "C099", paymentTerms: null, creditDays: null, businessType: null, customerType: null };
const credit15 = { ...bigC, id: 10, code: "C100", paymentTerms: "Credit 15 Days", creditDays: 15 };

const tfBuriram = {
  id: 7, partnerId: 4, siteCode: "DS-C004-0001", displayName: "TF บุรีรัมย์", partnerBranchCode: "9405",
  branchName: null, deliveryType: "direct_to_store", addressLine1: null, addressLine2: null, district: "ในเมือง",
  subDistrict: "เมือง", province: "บุรีรัมย์", postalCode: "31000", country: "Thailand",
  deliveryRegion: "ภาคอีสาน", deliveryZone: null, preferredTimeSlot: null, accessInstructions: null,
  acceptableVehicles: ["4_wheel", "6_wheel"], googleMapsUrl: null, isActive: true,
};

test("hasValue: 0 and false are real values", () => {
  assert.equal(hasValue(0), true);
  assert.equal(hasValue(false), true);
  assert.equal(hasValue(""), false);
  assert.equal(hasValue(null), false);
  assert.equal(hasValue(undefined), false);
});

test("withStoredOption adds a stored value the list does not hold", () => {
  const o = withStoredOption(BUSINESS_TYPES, "Corporation");
  assert.deepEqual(o, BUSINESS_TYPES, "no change when the value is in the list");
  const legacy = withStoredOption(BUSINESS_TYPES, "customer");
  assert.equal(legacy.length, BUSINESS_TYPES.length + 1);
  assert.ok(legacy.some(x => x.value === "customer"));
  assert.deepEqual(withStoredOption(BUSINESS_TYPES, null), BUSINESS_TYPES);
});

test("partner: every stored value the form shows is selectable", () => {
  for (const rec of [bigC, credit15]) {
    const f = partnerRecordToForm(rec);
    assert.ok(withStoredOption(BUSINESS_TYPES, f.businessType).some(o => o.value === f.businessType) || !f.businessType);
    assert.ok(withStoredOption(CUSTOMER_TYPES, f.customerType).some(o => o.value === f.customerType) || !f.customerType);
    const terms = PAYMENT_TERMS_OPTIONS.map(o => ({ value: o.value as string, label: o.label }));
    assert.ok(withStoredOption(terms, f.paymentTerms).some(o => o.value === f.paymentTerms), `terms ${f.paymentTerms}`);
  }
});

test("partner: opening a record with no payment terms does NOT force COD", () => {
  assert.equal(partnerRecordToForm(noTerms).paymentTerms, "");
});

test("partner: open + save unchanged changes nothing", () => {
  for (const rec of [bigC, noTerms, credit15]) {
    const payload = partnerFormToPayload(partnerRecordToForm(rec), rec);
    for (const [k, v] of Object.entries(payload)) {
      if (k === "creditDays") continue;
      assert.equal(v ?? null, (rec as any)[k] ?? null, `${rec.code}.${k}`);
    }
    assert.equal(payload.creditDays, rec.creditDays ?? null, `${rec.code} creditDays`);
  }
});

test("creditDaysForSave: plain 'Credit' keeps its stored days; known terms set them", () => {
  assert.equal(creditDaysForSave("Credit", { paymentTerms: "Credit", creditDays: 45 }), 45);
  assert.equal(creditDaysForSave("Credit", { paymentTerms: "Credit", creditDays: null }), null);
  assert.equal(creditDaysForSave("Credit 30 Days", { paymentTerms: "Credit", creditDays: null }), 30);
  assert.equal(creditDaysForSave("COD", { paymentTerms: "Credit", creditDays: 45 }), 0);
});

test("site: the region is read from delivery_region and survives a round trip", () => {
  const f = siteRecordToForm(tfBuriram);
  assert.equal(f.deliveryRegion, "ภาคอีสาน");
  assert.ok(SITE_REGIONS.some(r => r.value === f.deliveryRegion), "stored region is in the option list");
  const payload = siteFormToPayload(f, tfBuriram);
  for (const k of ["deliveryRegion", "deliveryZone", "partnerBranchCode", "acceptableVehicles", "branchName", "addressLine1"]) {
    assert.deepEqual((payload as any)[k] ?? null, (tfBuriram as any)[k] ?? null, k);
  }
});

test("normalizeRegion maps old spellings and slugs to the stored Thai value", () => {
  assert.equal(normalizeRegion("ภาคตะวันออกเฉียงเหนือ"), "ภาคอีสาน");
  assert.equal(normalizeRegion("northeast"), "ภาคอีสาน");
  assert.equal(normalizeRegion("ภาคใต้ (เกาะ)"), "ภาคใต้ (เกาะ)");
  assert.equal(normalizeRegion(null), "");
  assert.equal(normalizeRegion("somewhere new"), "somewhere new");
});

test("every region the data holds today is offered", () => {
  for (const r of ["กรุงเทพและปริมณฑล", "ภาคกลาง", "ภาคตะวันออก", "ภาคอีสาน", "ภาคใต้", "ภาคใต้ (เกาะ)"]) {
    assert.ok(SITE_REGIONS.some(o => o.value === r), r);
  }
});

test("item: a stored selling unit outside base/pack/basket is still offered", () => {
  const opts = sellingUnitOptions({ base: "ฟอง", pack: "แพ็ค10", basket: null, stored: "แพ็ค" });
  assert.ok(opts.some(o => o.value === "แพ็ค"));
  assert.equal(sellingUnitOptions({ base: "ฟอง", stored: "ฟอง" }).length, 1);
  assert.equal(sellingUnitOptions({ stored: "" }).length, 0);
});

test("item: primary grade 0 counts as set", () => {
  const r = bomReadinessChecks({ role: "FG", sellingUnit: "แพ็ค", eggsPerPack: 4, isEgg: true, eggInputType: "graded", primaryGrade: 0 });
  assert.equal(r.checks.find(c => c.key === "complete")!.pass, true);
  const missing = bomReadinessChecks({ role: "FG", sellingUnit: "แพ็ค", eggsPerPack: 4, isEgg: true, eggInputType: "graded", primaryGrade: null });
  assert.equal(missing.checks.find(c => c.key === "complete")!.pass, false);
  assert.equal(missing.checks.find(c => c.key === "complete")!.hint, "ระบุ Primary grade");
});

test("item: BOM readiness reads the real BOM lines (not just 'is an egg')", () => {
  const profile = { pack_base: { enabled: true, component_sku: "C19999P301" }, cover: { enabled: false, component_sku: "" } };
  const withBom = bomReadinessChecks({ role: "FG", sellingUnit: "ถาด", eggsPerPack: 30, isEgg: false, packagingProfile: profile });
  assert.equal(withBom.ok, true);
  const empty = bomReadinessChecks({ role: "FG", sellingUnit: "ถาด", eggsPerPack: 30, isEgg: false, packagingProfile: {}, additionalMaterials: [] });
  assert.equal(empty.checks.find(c => c.key === "bom")!.pass, false);
  const viaExtra = bomReadinessChecks({ role: "FG", sellingUnit: "ถาด", eggsPerPack: 30, isEgg: false, additionalMaterials: [{ component_sku: "C49999P991" }] });
  assert.equal(viaExtra.checks.find(c => c.key === "bom")!.pass, true);
});

test("item: eggs-per-pack is not demanded of a packaging item", () => {
  const r = bomReadinessChecks({ role: "PACKAGING", sellingUnit: "ใบ", eggsPerPack: null, isEgg: false });
  assert.equal(r.checks.find(c => c.key === "units")!.pass, true);
});

test("gradeFromSize: the size text '0' is grade 0; labels are not grades", () => {
  assert.equal(gradeFromSize("0"), 0);
  assert.equal(gradeFromSize("4"), 4);
  assert.equal(gradeFromSize(" 3 "), 3);
  assert.equal(gradeFromSize("mixed"), null);
  assert.equal(gradeFromSize("M"), null);
  assert.equal(gradeFromSize(null), null);
  assert.equal(gradeFromSize(undefined), null);
});
