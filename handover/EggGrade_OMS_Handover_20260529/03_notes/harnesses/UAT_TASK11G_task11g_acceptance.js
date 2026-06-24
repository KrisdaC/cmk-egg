const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_11g.js','utf8');
let pass=0, fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok, MASTER_V3: null };
vm.createContext(ctx);
const tests = `
MASTER_V3 = { items: [
  { sku:'C19999P301', name:'ถาดเล็ก', item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ'} },
  { sku:'C19999P302', name:'ถาดใหญ่', item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ'} }
]};

function ppItem(slotObj, ext){
  var it = ext || {};
  it.packaging_profile = { pack_base: slotObj };
  it.bom = { components: [] };
  return it;
}

// === T1 — basket-selling FG (replicates the screenshot B0002) ===
// selling_unit = ตะกร้า, base_per_basket = 60, base_per_pack = 30
// Expected: tray qty = 60 / 30 = 2.
var it1 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 1 /* operator's default — should be overwritten by rule */ },
  { primary_grade:'3', is_egg:true, selling_unit:'ตะกร้า',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30,
            has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60 } }
);
_bomSyncProfileSlot('pack_base', it1, it1);
var L1 = it1.bom.components;
ok('T1a basket-selling FG -> 1 line', L1.length === 1);
ok('T1b sku P301 (size 3)',           L1[0].component_sku === 'C19999P301');
ok('T1c tray qty = 2 (60/30)',         L1[0].qty_per_selling_unit === 2);
ok('T1d unit = ใบ',                   L1[0].unit === 'ใบ');
ok('T1e profile pp.qty written back', it1.packaging_profile.pack_base.qty_per_selling_unit === 2);
ok('T1f needs_review false',          L1[0].needs_review === false);

// === T2 — pack-selling FG (selling_unit = ถาด) ===
var it2 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 1 },
  { primary_grade:'3', is_egg:true, selling_unit:'ถาด',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30 } }
);
_bomSyncProfileSlot('pack_base', it2, it2);
ok('T2 pack-selling -> qty 1 (30/30)', it2.bom.components[0].qty_per_selling_unit === 1);

// === T3 — base-selling FG (selling_unit = ฟอง) ===
var it3 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 1 },
  { primary_grade:'3', is_egg:true, selling_unit:'ฟอง',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30 } }
);
_bomSyncProfileSlot('pack_base', it3, it3);
ok('T3 base-selling -> qty 1/30', Math.abs(it3.bom.components[0].qty_per_selling_unit - (1/30)) < 1e-9);

// === T4 — missing base_per_pack -> rule cannot derive qty, falls back to pp.qty ===
var it4 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 7 /* legacy value */ },
  { primary_grade:'3', is_egg:true, selling_unit:'ตะกร้า',
    units:{ base_unit:'ฟอง', has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60 } }
);
_bomSyncProfileSlot('pack_base', it4, it4);
ok('T4 missing base_per_pack -> falls back to pp.qty (7)',
   it4.bom.components[0].qty_per_selling_unit === 7);

// === T5 — missing selling_unit factor (selling_unit unset) -> falls back ===
var it5 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 5 },
  { primary_grade:'3', is_egg:true,
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30 } }
);
_bomSyncProfileSlot('pack_base', it5, it5);
ok('T5 no selling_unit -> falls back to pp.qty (5)',
   it5.bom.components[0].qty_per_selling_unit === 5);

// === T6 — manual mode: rule qty ignored, pp.qty used ===
var it6 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'manual', rule_id:null,
    component_sku:'C19999P301', qty_per_selling_unit: 9 },
  { primary_grade:'3', is_egg:true, selling_unit:'ตะกร้า',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30,
            has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60 } }
);
_bomSyncProfileSlot('pack_base', it6, it6);
ok('T6 manual mode -> pp.qty (9) used, rule ignored',
   it6.bom.components[0].qty_per_selling_unit === 9);

// === T7 — size 0 FG (large tray, basket of 60 fong) ===
var it7 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'tray',
    selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size',
    qty_per_selling_unit: 1 },
  { primary_grade:'0', is_egg:true, selling_unit:'ตะกร้า',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30,
            has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60 } }
);
_bomSyncProfileSlot('pack_base', it7, it7);
ok('T7a size 0 -> P302', it7.bom.components[0].component_sku === 'C19999P302');
ok('T7b qty 2 (60/30)',  it7.bom.components[0].qty_per_selling_unit === 2);

// === T8 — non-egg packaging item type still works (returns null cleanly) ===
var it8 = ppItem(
  { enabled:true, item_role:'PACKAGING', item_type:'cover',
    selection_mode:'manual', component_sku:'C19999P301', qty_per_selling_unit: 2 },
  { primary_grade:'3', selling_unit:'ตะกร้า',
    units:{ base_unit:'ฟอง', pack_unit:'ถาด', base_per_pack:30,
            has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60 } }
);
_bomSyncProfileSlot('pack_base', it8, it8);
// Cover slot/type — no rule applies, qty stays at operator's manual value (and SKU mismatches type → needs_review)
ok('T8 non-tray type in manual mode -> qty 2 preserved',
   it8.bom.components[0].qty_per_selling_unit === 2);
`;
try { vm.runInContext(code + '\n' + tests, ctx, { filename:'task11g.js' }); }
catch(e){ console.log('  HARNESS ERROR: ' + (e && e.stack || e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
