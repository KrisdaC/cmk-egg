const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_11e.js','utf8');
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok, MASTER_V3: null };
vm.createContext(ctx);
const tests = `
function master() { return { items: [
  // PACKAGING tray
  { sku:'C19999P301', name:'ถาดเล็ก',  item_role:'PACKAGING', item_type:'tray',  is_active:true, units:{base_unit:'ใบ'} },
  { sku:'C19999P302', name:'ถาดใหญ่',  item_role:'PACKAGING', item_type:'tray',  is_active:true, units:{base_unit:'ใบ'} },
  // PACKAGING cover
  { sku:'C29999P301', name:'ฝาครอบ 30 เล็ก', item_role:'PACKAGING', item_type:'cover', is_active:true, units:{base_unit:'ชิ้น'} },
  { sku:'C29999P302', name:'ฝาครอบ 30 ใหญ่', item_role:'PACKAGING', item_type:'cover', is_active:true, units:{base_unit:'ชิ้น'} },
  // PACKAGING label
  { sku:'L0001', name:'ฉลาก A', item_role:'PACKAGING', item_type:'label', is_active:true, units:{base_unit:'ดวง'} },
  // PACKAGING sticker
  { sku:'S0001', name:'สติ๊กเกอร์ A', item_role:'PACKAGING', item_type:'sticker', is_active:true, units:{base_unit:'ชิ้น'} },
  // PACKAGING basket (should be excluded from Packaging Profile)
  { sku:'B0001', name:'ตะกร้า', item_role:'PACKAGING', item_type:'basket', is_active:true },
  // SUPPLY
  { sku:'SUP0001', name:'น้ำยาทำความสะอาด', item_role:'SUPPLY', item_type:'cleaning', is_active:true, units:{base_unit:'ลิตร'} },
]}; }

// === T1 — _bomPkgTypesByRole ===
MASTER_V3 = master();
var packTypes = _bomPkgTypesByRole('PACKAGING', '', ['tray']);
ok('T1a PACKAGING types include tray, cover, label, sticker',
   packTypes.indexOf('tray') >= 0 && packTypes.indexOf('cover') >= 0 &&
   packTypes.indexOf('label') >= 0 && packTypes.indexOf('sticker') >= 0);
ok('T1b basket excluded', packTypes.indexOf('basket') === -1);
ok('T1c case-insensitive role', _bomPkgTypesByRole('packaging','',[]).indexOf('cover') >= 0);
ok('T1d preserves current type even if absent from master',
   _bomPkgTypesByRole('PACKAGING', 'unicorn', []).indexOf('unicorn') >= 0);
var supTypes = _bomPkgTypesByRole('SUPPLY', '', []);
ok('T1e SUPPLY types includes cleaning', supTypes.indexOf('cleaning') >= 0);

// === T2 — _bomPkgCandidatesByType (regression from 11D) ===
ok('T2a cover -> 2 SKUs', _bomPkgCandidatesByType('PACKAGING','cover','').length === 2);
ok('T2b tray -> 2 SKUs',  _bomPkgCandidatesByType('PACKAGING','tray','').length === 2);
ok('T2c label -> 1',      _bomPkgCandidatesByType('PACKAGING','label','').length === 1);
ok('T2d SUPPLY/cleaning -> 1', _bomPkgCandidatesByType('SUPPLY','cleaning','').length === 1);

// === T3 — _bomSyncProfileSlot for pack_base (tray auto rule) ===
function ppItem(slotId, slotObj){
  var pp = {}; pp[slotId] = slotObj;
  return { primary_grade:'3', packaging_profile: pp, bom:{ components:[] } };
}
var it3 = ppItem('pack_base', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 });
_bomSyncProfileSlot('pack_base', it3, it3);
var L3 = it3.bom.components;
ok('T3a pack_base/tray materialises 1 line', L3.length === 1);
ok('T3b component_role=pack_base, packaging_key=tray',
   L3[0].component_role === 'pack_base' && L3[0].packaging_key === 'tray');
ok('T3c rule resolves to small tray (size 3 -> P301)',
   L3[0].component_sku === 'C19999P301' && L3[0].needs_review === false);
ok('T3d source_added = packaging_profile_pack_base',
   L3[0].source_added === 'packaging_profile_pack_base');
ok('T3e unit from master', L3[0].unit === 'ใบ');

// size 0 -> large tray
var it3b = ppItem('pack_base', { enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 });
it3b.primary_grade = '0';
_bomSyncProfileSlot('pack_base', it3b, it3b);
ok('T3f size 0 -> C19999P302', it3b.bom.components[0].component_sku === 'C19999P302');

// === T4 — _bomSyncProfileSlot for cover (manual mode, the headline bug) ===
var it4 = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C29999P301', qty_per_selling_unit:2 });
_bomSyncProfileSlot('cover', it4, it4);
var L4 = it4.bom.components;
ok('T4a cover materialises 1 line', L4.length === 1);
ok('T4b component_role=cover, packaging_key=cover, sku correct',
   L4[0].component_role === 'cover' && L4[0].packaging_key === 'cover' && L4[0].component_sku === 'C29999P301');
ok('T4c source_added = packaging_profile_cover',
   L4[0].source_added === 'packaging_profile_cover');
ok('T4d needs_review false, unit from master',
   L4[0].needs_review === false && L4[0].unit === 'ชิ้น');
ok('T4e qty 2', L4[0].qty_per_selling_unit === 2);

// === T5 — inactive slot removes only its own line ===
it4.bom.components.push({ component_role:'tray', component_sku:'XYZ', component_name:'manual' });   // manual non-profile line
it4.packaging_profile.cover.enabled = false;
_bomSyncProfileSlot('cover', it4, it4);
ok('T5a cover disable removes profile line', !it4.bom.components.some(c => c.source_added === 'packaging_profile_cover'));
ok('T5b manual non-profile line preserved', it4.bom.components.some(c => c.component_sku === 'XYZ'));

// === T6 — invalid active slot -> needs_review ===
var it6a = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it6a, it6a);
ok('T6a no SKU -> needs_review', it6a.bom.components[0].needs_review === true);
var it6b = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C19999P301', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it6b, it6b);
ok('T6b SKU role/type mismatch (tray sku in cover slot) -> needs_review', it6b.bom.components[0].needs_review === true);
var it6c = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C29999P301', qty_per_selling_unit:0 });
_bomSyncProfileSlot('cover', it6c, it6c);
ok('T6c qty 0 -> needs_review', it6c.bom.components[0].needs_review === true);
var it6d = ppItem('cover', { enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C29999P301', qty_per_selling_unit:1 });
_bomSyncProfileSlot('cover', it6d, it6d);
ok('T6d all valid -> needs_review false', it6d.bom.components[0].needs_review === false);

// === T7 — legacy tag recognition ===
var it7 = { primary_grade:'3', packaging_profile:{ pack_base:{ enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 } },
  bom:{ components:[{ component_role:'pack_base', packaging_key:'tray', component_sku:'OLD', source_added:'packaging_profile_pack_base_tray', qty_per_selling_unit:999 }] } };
_bomSyncProfileSlot('pack_base', it7, it7);
ok('T7a legacy line found and updated in place (still 1 line)', it7.bom.components.length === 1);
ok('T7b legacy line rewritten with new tag', it7.bom.components[0].source_added === 'packaging_profile_pack_base');
ok('T7c rule applied (P301 for size 3, qty 1)',
   it7.bom.components[0].component_sku === 'C19999P301' && it7.bom.components[0].qty_per_selling_unit === 1);

// === T8 — backward-compat: old field spellings ===
var it8 = { primary_grade:'3', packaging_profile:{ pack_base:{ enabled:true, packaging_key:'tray', selection_mode:'auto_by_egg_size', qty_per_selling_unit:1 } },
  bom:{ components:[] } };
_bomSyncProfileSlot('pack_base', it8, it8);
ok('T8a auto_by_egg_size mapped to auto_by_rule + tray rule',
   it8.bom.components[0].component_sku === 'C19999P301' && it8.bom.components[0].needs_review === false);
ok('T8b backfilled canonical fields on profile',
   it8.packaging_profile.pack_base.item_role === 'PACKAGING' &&
   it8.packaging_profile.pack_base.item_type === 'tray' &&
   it8.packaging_profile.pack_base.rule_id === 'tray_by_egg_size');

// === T9 — _bomSyncPackagingProfile loops every slot ===
var it9 = { primary_grade:'3', packaging_profile:{
  pack_base:{ enabled:true,  item_role:'PACKAGING', item_type:'tray',  selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 },
  cover:    { enabled:true,  item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C29999P301', qty_per_selling_unit:1 },
  closer_1: { enabled:false }
}, bom:{ components:[] } };
_bomSyncPackagingProfile(it9, it9);
ok('T9a 2 active slots materialised', it9.bom.components.length === 2);
ok('T9b both have packaging_profile_<slot> tags',
   it9.bom.components.every(c => c.source_added && c.source_added.indexOf('packaging_profile_') === 0));

// === T10 — _bomProfileControlledSkus ===
var skus = _bomProfileControlledSkus(it9);
ok('T10a controlled SKU set includes tray + cover',
   skus['C19999P301'] === true && skus['C29999P301'] === true);
ok('T10b unrelated sku not in set', skus['ZZZ'] === undefined);

// === T11 — switching pack_base item_type away from tray disables auto rule (sync sees manual) ===
var it11 = { primary_grade:'3', packaging_profile:{
  pack_base:{ enabled:true, item_role:'PACKAGING', item_type:'cover', selection_mode:'manual', component_sku:'C29999P301', qty_per_selling_unit:1 }
}, bom:{ components:[] } };
_bomSyncProfileSlot('pack_base', it11, it11);
ok('T11 pack_base with cover type uses manual cover SKU (no tray rule)',
   it11.bom.components[0].component_sku === 'C29999P301' && it11.bom.components[0].needs_review === false);

// === T12 — basket components in bom.components are NOT touched by sync ===
var it12 = { primary_grade:'3', packaging_profile:{ pack_base:{ enabled:true, item_role:'PACKAGING', item_type:'tray', selection_mode:'auto_by_rule', rule_id:'tray_by_egg_size', qty_per_selling_unit:1 } },
  bom:{ components:[{ component_role:'basket', component_sku:'B001', qty_per_selling_unit:1 }] } };
_bomSyncProfileSlot('pack_base', it12, it12);
ok('T12 basket line preserved',
   it12.bom.components.some(c => c.component_role === 'basket' && c.component_sku === 'B001'));
`;
try { vm.runInContext(code + '\n' + tests, ctx, { filename:'task11e.js' }); }
catch(e){ console.log('  HARNESS ERROR: ' + (e && e.stack || e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
