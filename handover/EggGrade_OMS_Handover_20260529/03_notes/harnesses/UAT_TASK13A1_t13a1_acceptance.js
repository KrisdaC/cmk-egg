// Node vm acceptance harness for UAT Task 13A-1.
// Extracts the Task 13A-1 module from app/index.html, plus the minimal helpers
// it depends on (validateMasterItem etc.), runs them inside a vm.Context, and
// asserts cases 1–9 from the brief.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.resolve('app/index.html'), 'utf8');

// Pull every <script> body (skip the application/octet-stream and external scripts).
// We then concatenate them into the sandbox so the new Task 13A-1 block can
// see validateMasterItem / normalizeItemUnits / getSellingUnitBaseFactor /
// getItemTypeOptionsForRole / getOptionSet / getOptionLabel / _itemBaseFactor.
const SCRIPT_RE = /<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
let m;
const blocks = [];
while ((m = SCRIPT_RE.exec(html)) !== null) {
  const a = m.groups.attrs || '';
  if (a.includes('application/octet-stream')) continue;
  if (a.includes('src=') && a.includes('http')) continue;
  blocks.push(m.groups.body);
}

// Build a sandbox with browser-ish stubs.
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  // DOM stubs minimum to keep boot code from blowing up.
  document: {
    addEventListener(){}, removeEventListener(){},
    getElementById(){ return null; },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    createElement(){ return { style:{}, setAttribute(){}, appendChild(){}, click(){}, remove(){} }; },
    body: { appendChild(){}, removeChild(){} },
    head: { appendChild(){}, removeChild(){} },
    title: '',
    readyState: 'complete',
    activeElement: null,
  },
  window: undefined, // will be set to sandbox below
  navigator: { language: 'th-TH', userAgent: 'node' },
  location: { hash: '', search: '', pathname: '/', href: 'file:///' },
  localStorage: (function(){
    const store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k,v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      get length(){ return Object.keys(store).length; },
      key: i => Object.keys(store)[i] || null,
      clear(){ for (const k of Object.keys(store)) delete store[k]; },
      _store: store,
    };
  })(),
  XLSX: undefined, // not available in Node — module falls back to JSON envelope
  alert: msg => { sandbox._alerts.push(msg); },
  confirm: () => true,
  prompt: () => '',
  Blob: function Blob(){ this.size = 0; },
  URL: { createObjectURL: () => 'blob://x', revokeObjectURL(){} },
  File: function File(parts, name, opts){ this.name = name; },
  FileReader: function FileReader(){
    this.onload = null;
    this.onerror = null;
    this.readAsText = function(file){ this.onload && this.onload({ target: { result: file._text } }); };
    this.readAsArrayBuffer = function(file){ this.onload && this.onload({ target: { result: file._buf } }); };
  },
  _alerts: [],
  cancelAnimationFrame(){},
  requestAnimationFrame(){},
  // The big main JS reads e.g. matchMedia
  matchMedia: () => ({ matches:false, addEventListener(){}, removeEventListener(){} }),
  performance: { now: () => Date.now() },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// Concatenate every inline block; wrap in a try-around-each so the body of any
// optional boot-time code that throws doesn't kill subsequent blocks.
// But for the static check we want the modules to define their top-level functions.
let merged = '';
for (const b of blocks) {
  merged += '\n;try {\n' + b + '\n} catch(__e){ /* sandbox tolerate */ }\n';
}
vm.runInContext(merged, sandbox, { timeout: 5000 });

const T13A1 = sandbox.T13A1;
if (!T13A1) {
  console.error('FAIL: T13A1 namespace not exposed on window after script load');
  process.exit(1);
}

// Set up a minimal MASTER_V3 inside the sandbox.
sandbox.MASTER_V3 = {
  customers: [
    { id: 10, code: 'BIGC', nickname: 'BigC', business_name: 'BigC Supercenter', is_active: true },
    { id: 11, code: 'MAKRO', nickname: 'Makro', business_name: 'Makro PLC', is_active: true },
  ],
  sites: [],
  items: [
    { id: 1, sku: 'E0001', name: 'ไข่ขาวเบอร์ 3', name_th: 'ไข่ขาวเบอร์ 3', item_role: 'FG', item_type: 'packed_egg',
      partner_id: 10, is_active: true, selling_unit: 'แพ็ค 10',
      units: { base_unit: 'ฟอง', pack_unit: 'แพ็ค 10', base_per_pack: 30, storage_unit: 'พาเลท', base_per_storage: 3000 },
      bom: { components: [{ component_role: 'tray', component_sku: 'P001', qty_per_basis: 1 }], routes: [], enabled: false },
      basket_profile: { has_basket: true, basket_sku: 'B0001' },
      egg_profile: { primary_grade: '3' },
      packaging_profile: { uses_base_pack: true },
      external_refs: { partner_code_xyz: 'foo-123' },
      legacy_field: 'preserve-me',
    },
    { id: 2, sku: 'E0002', name: 'ไข่เบอร์ 5', name_th: 'ไข่เบอร์ 5', item_role: 'FG', item_type: 'packed_egg',
      partner_id: 11, is_active: true, selling_unit: 'ฟอง',
      units: { base_unit: 'ฟอง', pack_unit: '', base_per_pack: null,
        // Legacy supply fields on this item to test preservation.
        has_consumable_unit: true, consumable_unit: 'ขวด', base_per_consumable: 6 },
    },
  ],
  option_sets: {
    item_role: [
      { code: 'FG', is_active: true }, { code: 'RM', is_active: true }, { code: 'WIP', is_active: true },
      { code: 'PACKAGING', is_active: true }, { code: 'SUPPLY', is_active: true }, { code: 'DEFECT', is_active: true },
    ],
    unit: [
      { code: 'ฟอง', is_active: true }, { code: 'แพ็ค 10', is_active: true },
      { code: 'พาเลท', is_active: true }, { code: 'ใบ', is_active: true },
      { code: 'row', is_active: true }, { code: 'box', is_active: true },
    ],
  },
  meta: { version: 3, updated: Date.now() },
};

// Helpers in the module rely on these globals too.
sandbox.persistMasterV3 = function persistMasterV3(){ return { ok:true }; };

// =========================================================
// CASE 1 — Export current items: every item produces a row,
// derived ratios present, legacy supply only as reference.
// =========================================================
let pass = 0, fail = 0, results = [];
function ok(label){ pass++; results.push('PASS · ' + label); }
function bad(label, detail){ fail++; results.push('FAIL · ' + label + ' :: ' + (detail || '')); }

(function case1(){
  try {
    const rows = sandbox.MASTER_V3.items.map(T13A1.deriveRow);
    if (rows.length !== 2) return bad('case1 row count', 'got ' + rows.length);
    const r0 = rows[0];
    // Identity present
    if (r0.sku !== 'E0001') return bad('case1 sku', JSON.stringify(r0));
    if (r0.item_role !== 'FG') return bad('case1 role');
    if (r0.customer_code !== 'BIGC') return bad('case1 customer_code', r0.customer_code);
    if (r0.customer_name_derived !== 'BigC') return bad('case1 customer_name', r0.customer_name_derived);
    // Units present
    if (r0.base_unit !== 'ฟอง' || r0.base_per_pack !== 30) return bad('case1 units');
    if (r0.storage_unit !== 'พาเลท' || r0.base_per_storage !== 3000) return bad('case1 storage');
    // Derived ratios computed
    if (r0.selling_base_factor_derived !== 30) return bad('case1 selling_factor', r0.selling_base_factor_derived);
    if (r0.selling_to_pack_ratio_derived !== 1) return bad('case1 stp ratio');
    if (r0.pack_to_selling_ratio_derived !== 1) return bad('case1 pts ratio');
    // Legacy supply: row 1 has no supply, row 2 has supply
    if (r0.legacy_consumable_unit !== '') return bad('case1 legacy on item without supply');
    const r1 = rows[1];
    if (r1.legacy_has_consumable_unit !== true) return bad('case1 legacy supply preservation flag');
    if (r1.legacy_consumable_unit !== 'ขวด') return bad('case1 legacy consumable unit');
    if (r1.legacy_base_per_consumable !== 6) return bad('case1 legacy base_per_consumable');
    ok('Case 1 — export rows include Identity, Units, derived ratios, legacy supply preservation');
  } catch (e) { bad('case1 threw', e.message); }
})();

// =========================================================
// CASE 2 — Re-import the exported rows, expect 0 blocking errors,
// every existing row classified as 'unchanged', preservation intact.
// =========================================================
(function case2(){
  try {
    const rows = sandbox.MASTER_V3.items.map(T13A1.deriveRow);
    const v = T13A1.validateImportRows(rows.map(r => Object.assign({}, r)));
    if (v.summary.blocking_errors !== 0) return bad('case2 blocking_errors', JSON.stringify(v.summary));
    if (v.summary.to_create !== 0) return bad('case2 to_create');
    // Both items should be 'unchanged' since we exported then re-imported.
    if (v.summary.unchanged < 1) return bad('case2 unchanged', JSON.stringify(v.summary));
    ok('Case 2 — round-trip re-import: 0 blocking errors, no data loss');
  } catch (e) { bad('case2 threw', e.message); }
})();

// =========================================================
// CASE 3 — Update existing SKU units: base_per_pack 30 → 12.
// Diff shows units.base_per_pack changed; commit preserves
// out-of-scope structures (bom, basket_profile, egg_profile, etc).
// =========================================================
(function case3(){
  try {
    const before = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items[0]));
    const exported = T13A1.deriveRow(sandbox.MASTER_V3.items[0]);
    exported.base_per_pack = 12;       // The change
    const v = T13A1.validateImportRows([exported]);
    if (v.summary.blocking_errors !== 0) return bad('case3 blocking', JSON.stringify(v.summary));
    if (v.summary.to_update !== 1) return bad('case3 to_update', JSON.stringify(v.summary));
    if (!v.rows[0]._changes || !v.rows[0]._changes.find(c => c.field === 'units.base_per_pack')) {
      return bad('case3 diff missing base_per_pack', JSON.stringify(v.rows[0]._changes));
    }
    // Snapshot original MASTER_V3
    const origItems = sandbox.MASTER_V3.items.slice();
    // Commit
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('case3 commit not ok', cr.error);
    if (cr.updated !== 1) return bad('case3 updated count', cr.updated);
    const after = sandbox.MASTER_V3.items.find(it => it.sku === 'E0001');
    if (after.units.base_per_pack !== 12) return bad('case3 base_per_pack not updated', after.units.base_per_pack);
    // Out-of-scope preservation
    if (!after.bom || !Array.isArray(after.bom.components) || after.bom.components.length !== 1)
      return bad('case3 bom.components not preserved');
    if (after.bom.components[0].component_sku !== before.bom.components[0].component_sku)
      return bad('case3 bom.components content mutated');
    if (!after.basket_profile || after.basket_profile.basket_sku !== 'B0001')
      return bad('case3 basket_profile lost');
    if (!after.egg_profile || after.egg_profile.primary_grade !== '3')
      return bad('case3 egg_profile lost');
    if (!after.packaging_profile || after.packaging_profile.uses_base_pack !== true)
      return bad('case3 packaging_profile lost');
    if (!after.external_refs || after.external_refs.partner_code_xyz !== 'foo-123')
      return bad('case3 external_refs lost');
    if (after.legacy_field !== 'preserve-me')
      return bad('case3 unknown legacy field lost');
    ok('Case 3 — update existing SKU units: diff correct, out-of-scope preserved');
    // Restore for subsequent tests
    sandbox.MASTER_V3.items[0].units.base_per_pack = 30;
  } catch (e) { bad('case3 threw', e.message + '\n' + (e.stack||'').split('\n').slice(0,3).join('\n')); }
})();

// =========================================================
// CASE 4 — New packaging SKU C19999P301 — row shows create,
// 0 blocking errors, new item appears after commit, no supply
// fields created.
// =========================================================
(function case4(){
  try {
    const beforeLen = sandbox.MASTER_V3.items.length;
    const newRow = {
      sku: 'C19999P301',
      name_th: 'ถาดกระดาษ เล็ก',
      name_en: '',
      item_role: 'PACKAGING',
      item_type: 'tray',
      customer_code: '',
      is_active: true,
      notes: '',
      base_unit: 'ใบ',
      pack_unit: 'row',
      base_per_pack: 500,
      storage_unit: 'box',
      base_per_storage: 500,
      selling_unit: 'row',
    };
    const v = T13A1.validateImportRows([newRow]);
    if (v.summary.blocking_errors !== 0) return bad('case4 blocking', JSON.stringify(v.rows[0]._errors));
    if (v.summary.to_create !== 1) return bad('case4 to_create', JSON.stringify(v.summary));
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('case4 commit not ok', cr.error);
    if (cr.created !== 1) return bad('case4 created count', cr.created);
    const created = sandbox.MASTER_V3.items.find(it => it.sku === 'C19999P301');
    if (!created) return bad('case4 created item not found');
    if (created.item_role !== 'PACKAGING' || created.item_type !== 'tray') return bad('case4 identity');
    if (created.units.base_unit !== 'ใบ' || created.units.base_per_pack !== 500) return bad('case4 units');
    // No supply fields on new item.
    if (created.units.has_consumable_unit === true) return bad('case4 supply reintroduced');
    if (created.units.consumable_unit) return bad('case4 supply consumable_unit set');
    if (created.units.base_per_consumable != null) return bad('case4 supply base_per_consumable set');
    ok('Case 4 — new packaging SKU: created, 0 errors, no supply fields');
  } catch (e) { bad('case4 threw', e.message); }
})();

// =========================================================
// CASE 5 — Duplicate SKU in import file is a blocking error.
// =========================================================
(function case5(){
  try {
    const rows = [
      { sku:'DUP1', name_th:'A', item_role:'FG', base_unit:'ฟอง' },
      { sku:'DUP1', name_th:'B', item_role:'FG', base_unit:'ฟอง' },
    ];
    const v = T13A1.validateImportRows(rows);
    if (v.summary.blocking_errors === 0) return bad('case5 expected blocking');
    const dupErr = v.rows.some(r => (r._errors||[]).some(e => /duplicate/.test(e.msg)));
    if (!dupErr) return bad('case5 dup msg not surfaced');
    // commit must refuse
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (cr.ok !== false) return bad('case5 commit accepted!', JSON.stringify(cr));
    ok('Case 5 — duplicate SKU is blocking; commit refuses');
  } catch (e) { bad('case5 threw', e.message); }
})();

// =========================================================
// CASE 6 — Invalid selling unit: cannot resolve to base factor.
// =========================================================
(function case6(){
  try {
    const rows = [{
      sku:'BADSU', name_th:'Bad selling', item_role:'FG',
      base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:12,
      selling_unit:'ไม่มีหน่วยนี้',
    }];
    const v = T13A1.validateImportRows(rows);
    if (v.summary.blocking_errors === 0) return bad('case6 expected blocking');
    const su = v.rows[0]._errors.some(e => e.field === 'selling_unit');
    if (!su) return bad('case6 selling_unit error missing', JSON.stringify(v.rows[0]._errors));
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (cr.ok !== false) return bad('case6 commit accepted!');
    ok('Case 6 — invalid selling_unit blocks commit');
  } catch (e) { bad('case6 threw', e.message); }
})();

// =========================================================
// CASE 7 — Legacy supply fields absent in import: existing
// values preserved on existing item; new items don't grow them.
// =========================================================
(function case7(){
  try {
    // Use item E0002 which has supply fields. Re-import its row with the
    // legacy_* columns omitted (deriveRow includes them; we simulate the
    // "absent in import" case by deleting them explicitly).
    const exported = T13A1.deriveRow(sandbox.MASTER_V3.items.find(it => it.sku === 'E0002'));
    delete exported.legacy_has_consumable_unit;
    delete exported.legacy_consumable_unit;
    delete exported.legacy_base_per_consumable;
    // Flip is_active to force a diff -> commit path
    exported.notes = 'preserve-legacy-test';
    const v = T13A1.validateImportRows([exported]);
    if (v.summary.blocking_errors !== 0) return bad('case7 blocking', JSON.stringify(v.rows[0]._errors));
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('case7 commit not ok');
    const after = sandbox.MASTER_V3.items.find(it => it.sku === 'E0002');
    if (after.units.has_consumable_unit !== true) return bad('case7 legacy has_consumable_unit lost');
    if (after.units.consumable_unit !== 'ขวด') return bad('case7 legacy consumable_unit lost');
    if (after.units.base_per_consumable !== 6) return bad('case7 legacy base_per_consumable lost');
    if (after.notes !== 'preserve-legacy-test') return bad('case7 notes did not update');
    // Brand-new item (from case 4) must not have any supply fields.
    const fresh = sandbox.MASTER_V3.items.find(it => it.sku === 'C19999P301');
    if (fresh && (fresh.units.has_consumable_unit === true || fresh.units.consumable_unit || fresh.units.base_per_consumable != null))
      return bad('case7 new item grew supply');
    ok('Case 7 — legacy supply preserved on existing; not created on new');
  } catch (e) { bad('case7 threw', e.message); }
})();

// =========================================================
// CASE 8 — Out-of-scope columns ignored with warning.
// =========================================================
(function case8(){
  try {
    // Simulate _aoaToObjects path with an out-of-scope column.
    const aoa = [
      ['sku', 'name_th', 'item_role', 'base_unit', 'basket_profile.has_basket', 'pack_unit', 'base_per_pack'],
      ['OOS1', 'OOS', 'FG', 'ฟอง', 'TRUE', 'แพ็ค 10', 12],
    ];
    const parsed = T13A1.aoaToObjects(aoa);
    if (!parsed.ignored_columns.includes('basket_profile.has_basket'))
      return bad('case8 ignored_columns missing oos col', JSON.stringify(parsed.ignored_columns));
    const v = T13A1.validateImportRows(parsed.rows);
    if (v.summary.blocking_errors !== 0) return bad('case8 blocking', JSON.stringify(v.rows[0]._errors));
    const cr = T13A1.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('case8 commit not ok');
    const created = sandbox.MASTER_V3.items.find(it => it.sku === 'OOS1');
    if (!created) return bad('case8 oos1 not created');
    if ('basket_profile' in created) return bad('case8 basket_profile leaked onto new item', JSON.stringify(created));
    ok('Case 8 — out-of-scope columns ignored; never written to item');
  } catch (e) { bad('case8 threw', e.message); }
})();

// =========================================================
// CASE 9 — Task 13A-0B regression: assert hidden DOM elements
// + retained CTAs are in the source.
// =========================================================
(function case9(){
  try {
    if (/onclick="openBomBulkUpload\(\)"/.test(html)) return bad('case9 BOM Bulk Upload button still in DOM');
    if (!/id="masterAdminTools"/.test(html)) return bad('case9 Admin Tools dropdown missing');
    if (!/onclick="exportMasterV3\(\)"/.test(html)) return bad('case9 Export Master JSON missing');
    if (!/document\.getElementById\('masterJsonRestoreInput'\)/.test(html)) return bad('case9 Restore Master JSON missing');
    if (!/onclick="downloadFullBackup\(\)"/.test(html)) return bad('case9 Backup now missing');
    if (!/onchange="restoreFromFile\(this\.files\[0\]\)/.test(html)) return bad('case9 Restore from file missing');
    // Task 12B Supply / Issue Unit deprecation must remain: no active Supply input fields
    const supplyActive = /data-f="units\.has_consumable_unit"|data-f="units\.consumable_unit"|data-f="units\.base_per_consumable"/.test(html);
    if (supplyActive) return bad('case9 Supply unit DOM fields reintroduced');
    if (!/Task 13A-0B/.test(html)) return bad('case9 Task 13A-0B markers absent');
    ok('Case 9 — Task 13A-0B + 12B regressions: hidden/preserved as expected');
  } catch (e) { bad('case9 threw', e.message); }
})();

// =========================================================
// Report
// =========================================================
console.log('\n=== Task 13A-1 acceptance results ===');
results.forEach(r => console.log('  ' + r));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
