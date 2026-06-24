const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_11f.js','utf8');
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok, MASTER_V3: null };
vm.createContext(ctx);
const tests = `
function master() { return { items: [
  // Tray with proper base_unit (ใบ); some have a supply unit / storage unit too
  { sku:'TRAY_A', name:'tray with base only', item_role:'PACKAGING', item_type:'tray',
    is_active:true, units:{ base_unit:'ใบ' } },
  { sku:'TRAY_B', name:'tray with base + supply (consumable)', item_role:'PACKAGING', item_type:'tray',
    is_active:true, units:{ base_unit:'ใบ', has_consumable_unit:true, consumable_unit:'มัด', base_per_consumable:100 } },
  { sku:'TRAY_C', name:'tray with base + storage', item_role:'PACKAGING', item_type:'tray',
    is_active:true, units:{ base_unit:'ใบ', storage_unit:'พาเลท', base_per_storage:1000 } },
  // Cover (different base unit)
  { sku:'COVER_X', name:'cover with base ใบ', item_role:'PACKAGING', item_type:'cover',
    is_active:true, units:{ base_unit:'ใบ' } },
  // Label with base ดวง
  { sku:'LABEL_Y', name:'label ดวง', item_role:'PACKAGING', item_type:'label',
    is_active:true, units:{ base_unit:'ดวง' } },
  // BROKEN — packaging item with NO base_unit (supply unit only)
  { sku:'NOBASE_Z', name:'no base unit', item_role:'PACKAGING', item_type:'cover',
    is_active:true, units:{ has_consumable_unit:true, consumable_unit:'มัด', base_per_consumable:50 } },
  // BROKEN — packaging item with EMPTY units object
  { sku:'EMPTY_W', name:'no units obj', item_role:'PACKAGING', item_type:'cover',
    is_active:true },
]}; }

function ppItem(slotId, slotObj){
  var pp = {}; pp[slotId] = slotObj;
  return { primary_grade:'3', packaging_profile: pp, bom:{ components:[] } };
}

// === T1 — materialised line uses SKU base_unit ===
MASTER_V3 = master();
var it1 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'COVER_X', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it1, it1);
ok('T1a cover line unit = ใบ (from SKU base_unit)', it1.bom.components[0].unit === 'ใบ');
ok('T1b cover line not needs_review', it1.bom.components[0].needs_review === false);

var it2 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'label', selection_mode:'manual', component_sku:'LABEL_Y', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it2, it2);
ok('T1c label line unit = ดวง', it2.bom.components[0].unit === 'ดวง');

// === T2 — supply_unit (consumable_unit) on SKU does NOT change BOM unit ===
var it3 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'manual', component_sku:'TRAY_B', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it3, it3);
ok('T2a tray with supply unit -> line still ใบ, NOT มัด', it3.bom.components[0].unit === 'ใบ');
ok('T2b qty unaffected by supply conversion (qty stays 1, not 1/100 or 100)', it3.bom.components[0].qty_per_selling_unit === 1);

// === T3 — storage_unit on SKU does NOT change BOM unit either ===
var it4 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'manual', component_sku:'TRAY_C', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it4, it4);
ok('T3 tray with storage unit -> line still ใบ, NOT พาเลท', it4.bom.components[0].unit === 'ใบ');

// === T4 — SKU with NO base_unit -> needs_review with explicit note ===
var it5 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'NOBASE_Z', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it5, it5);
ok('T4a missing base_unit -> needs_review true', it5.bom.components[0].needs_review === true);
ok('T4b note mentions base_unit', it5.bom.components[0].notes.indexOf('base_unit') !== -1);

// === T5 — SKU with EMPTY units object (no base_unit at all) -> needs_review ===
var it6 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'EMPTY_W', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it6, it6);
ok('T5 empty units obj -> needs_review', it6.bom.components[0].needs_review === true);

// === T6 — missing supply_unit on SKU does NOT block / does not flag ===
// TRAY_A has only base_unit (no consumable_unit). Should NOT trigger needs_review.
var it7 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'manual', component_sku:'TRAY_A', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it7, it7);
ok('T6a tray with only base_unit (no supply unit) -> needs_review false', it7.bom.components[0].needs_review === false);
ok('T6b line unit = ใบ', it7.bom.components[0].unit === 'ใบ');

// === T7 — regression: tray auto rule (size 0 -> large, others -> small) ===
MASTER_V3.items.push(
  { sku:'C19999P301', name:'ถาดเล็ก',  item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ'} },
  { sku:'C19999P302', name:'ถาดใหญ่',  item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ'} }
);
var it8 = ppItem('pack_base', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 });
_bomSyncProfileSlot('pack_base', it8, it8);
ok('T7a size 3 -> P301 + unit ใบ', it8.bom.components[0].component_sku === 'C19999P301' && it8.bom.components[0].unit === 'ใบ' && it8.bom.components[0].needs_review === false);
var it9 = ppItem('pack_base', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 });
it9.primary_grade = '0';
_bomSyncProfileSlot('pack_base', it9, it9);
ok('T7b size 0 -> P302', it9.bom.components[0].component_sku === 'C19999P302');

// === T8 — qty preserved exactly through sync, no conversion math applied ===
var it10 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'manual', component_sku:'TRAY_B', qty_per_selling_unit:3 });
_bomSyncProfileSlot('cover', it10, it10);
ok('T8 qty 3 preserved (no /100, no *100)', it10.bom.components[0].qty_per_selling_unit === 3);
`;
try { vm.runInContext(code + '\n' + tests, ctx, { filename:'task11f.js' }); }
catch(e){ console.log('  HARNESS ERROR: ' + (e && e.stack || e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
