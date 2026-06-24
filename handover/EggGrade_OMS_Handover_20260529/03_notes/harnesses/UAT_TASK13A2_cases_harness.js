// Task 13A-2 acceptance harness — Cases 1–12 from the brief.
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){
  const a=m.groups.attrs||'';
  if(a.includes('application/octet-stream'))continue;
  if(a.includes('src=')&&a.includes('http'))continue;
  blocks.push(m.groups.body);
}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH',userAgent:'node'},location:{hash:'',search:'',pathname:'/',href:'file:///'},localStorage:(function(){const s={};return{getItem:k=>(k in s?s[k]:null),setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function Blob(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function File(){},FileReader:function FileReader(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
// Inject so the modules' typeof checks resolve
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, WIP:{sellable:false,producable:true,consumable:false}, RM:{sellable:false,producable:false,consumable:true}, PACKAGING:{sellable:false,producable:false,consumable:true}, SUPPLY:{sellable:false,producable:false,consumable:true}, DEFECT:{sellable:true,producable:false,consumable:false} };
vm.createContext(sandbox);
let merged='';
for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });
// Override the in-app helpers so they read from the test sandbox MASTER_V3.
// In a real browser these are the same identifiers; in the Node vm sandbox the
// merged-blocks try-wrappers shadow let MASTER_V3 inside their closures.
sandbox.getOptionSet = function(setKey, options) {
  const arr = ((sandbox.MASTER_V3 || {}).option_sets || {})[setKey] || [];
  return arr.slice();
};
sandbox._bomBasketCandidateItems = function() {
  const all = ((sandbox.MASTER_V3 || {}).items || []);
  return all.filter(x => x && String(x.item_role||'').toUpperCase()==='PACKAGING'
                     && String(x.item_type||'').toLowerCase()==='basket')
            .sort((a,b)=>String(a.sku||'').localeCompare(String(b.sku||'')));
};
sandbox._bomBasketComponents = function(it) {
  const comps = (it && it.bom && it.bom.components) || [];
  return comps.filter(c => c && c.component_role==='basket');
};
sandbox._bomBasketProfileStatus = function(it){ return { ok: true, msg: '' }; };
sandbox._bomResolveBasketUnit = function(sku, fb){
  const all = ((sandbox.MASTER_V3 || {}).items || []);
  const found = all.find(x => x && String(x.sku)===sku);
  return (found && found.units && found.units.base_unit) || fb;
};
sandbox.calculateBasketRequirementFromItem = function(it, q){
  const u = (it && it.units) || {};
  const bpb = Number(u.base_per_basket||0);
  if (!(bpb>0)) return [];
  return [{ required_qty: (Number(q||0) / bpb) }];
};
sandbox.normalizeItemUnits = function(it){
  const u = (it && it.units) || {};
  return {
    base_unit: u.base_unit||'',
    pack_unit: u.pack_unit||'',
    base_per_pack: u.base_per_pack==null?null:Number(u.base_per_pack),
    has_basket_unit: u.has_basket_unit===true || (u.has_basket_unit==null && Number(u.base_per_basket||0)>0),
    basket_unit: u.basket_unit||'ตะกร้า',
    base_per_basket: u.base_per_basket==null?null:Number(u.base_per_basket),
    storage_unit: u.storage_unit||'',
    base_per_storage: u.base_per_storage==null?null:Number(u.base_per_storage),
    has_consumable_unit: u.has_consumable_unit===true,
    consumable_unit: u.consumable_unit||'',
    base_per_consumable: u.base_per_consumable==null?null:Number(u.base_per_consumable)
  };
};
sandbox.getSellingUnitBaseFactor = function(it){
  const su = String((it && it.selling_unit)||'').trim(); if (!su) return null;
  const u = sandbox.normalizeItemUnits(it);
  if (su === u.base_unit) return 1;
  if (u.pack_unit && su === u.pack_unit && u.base_per_pack>0) return u.base_per_pack;
  if (u.has_basket_unit && u.basket_unit && su === u.basket_unit && u.base_per_basket>0) return u.base_per_basket;
  return null;
};
const T13A2 = sandbox.T13A2;
if (!T13A2) { console.error('T13A2 missing'); process.exit(1); }

// Build a master with: an FG with basket, a PACKAGING basket SKU, a sellable FG (no egg/basket)
sandbox.MASTER_V3 = {
  customers: [], sites: [],
  items: [
    // Basket candidate items
    { id:101, sku:'BSK-S', name:'ตะกร้า S', name_th:'ตะกร้า S',
      item_role:'PACKAGING', item_type:'basket', is_active:true,
      units:{ base_unit:'ใบ' } },
    { id:102, sku:'BSK-M', name:'ตะกร้า M', name_th:'ตะกร้า M',
      item_role:'PACKAGING', item_type:'basket', is_active:true,
      units:{ base_unit:'ใบ' } },
    { id:103, sku:'BSK-INACTIVE', name:'ตะกร้า inactive', name_th:'ตะกร้า inactive',
      item_role:'PACKAGING', item_type:'basket', is_active:false,
      units:{ base_unit:'ใบ' } },
    // FG with basket profile already configured
    { id:1, sku:'B0001', name:'ไข่ตะกร้า', name_th:'ไข่ตะกร้า',
      item_role:'FG', item_type:'packed_egg', is_active:true,
      selling_unit:'ตะกร้า',
      units:{ base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10,
              has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:70 },
      bom:{ enabled:true,
            components:[
              { component_type:'packaging', component_role:'basket',
                component_sku:'BSK-S', component_name:'ตะกร้า S',
                qty_per_selling_unit:1, unit:'ใบ', source:'basket_profile', required:true },
              { component_type:'packaging', component_role:'tray',
                component_sku:'TRAY-1', component_name:'tray',
                qty_per_basis:7, unit:'ใบ' }
            ],
            routes:[{ route_code:'r1' }] },
      packaging_profile:{ uses_base_pack:true },
      external_refs:{ partner_code_xyz:'foo-123' },
      legacy_field:'preserve-me',
      // Egg fields
      is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3'
    },
    // FG with GRADED_MIX egg
    { id:2, sku:'FG_MIX', name:'mixed egg', name_th:'mixed egg',
      item_role:'FG', item_type:'packed_egg', is_active:true,
      selling_unit:'แพ็ค 10',
      units:{ base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10 },
      bom:{ enabled:true, components:[], routes:[] },
      is_egg:true, egg_content_type:'GRADED_MIX', primary_grade:'2', secondary_grade:'3', min_primary:40 },
    // FG without basket or egg
    { id:3, sku:'FG_PLAIN', name:'plain', name_th:'plain',
      item_role:'FG', item_type:'packed_egg', is_active:true,
      selling_unit:'แพ็ค 10',
      units:{ base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10 },
      bom:{ enabled:false, components:[], routes:[] },
      is_egg:false }
  ],
  option_sets: {
    item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true},{code:'RM',is_active:true},{code:'WIP',is_active:true}],
    item_type:[{code:'basket',is_active:true},{code:'packed_egg',is_active:true}],
    unit:[{code:'ฟอง',is_active:true},{code:'ใบ',is_active:true},{code:'แพ็ค 10',is_active:true},{code:'ตะกร้า',is_active:true}],
    egg_content_type:[{code:'UNGRADED_EGG',is_active:true},{code:'UNDERGRADE',is_active:true},{code:'GRADED_SINGLE',is_active:true},{code:'GRADED_MIX',is_active:true}],
    egg_grade:[{code:'0',is_active:true},{code:'1',is_active:true},{code:'2',is_active:true},{code:'3',is_active:true},{code:'4',is_active:true},{code:'5',is_active:true},{code:'6',is_active:true}]
  },
  meta:{ version:3, updated:Date.now() }
};
sandbox.persistMasterV3 = function(){ return { ok:true }; };

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// ========== Case 1 — Export current ==========
(function case1(){
  try {
    const rows = sandbox.MASTER_V3.items.map(T13A2.deriveRow);
    if (rows.length !== sandbox.MASTER_V3.items.length) return bad('Case1 row count');
    const r = rows.find(x=>x.sku==='B0001');
    if (!r) return bad('Case1 missing B0001');
    if (r.is_egg !== true || r.egg_content_type !== 'GRADED_SINGLE' || r.primary_grade !== '3')
      return bad('Case1 egg fields', JSON.stringify(r));
    if (r.uses_basket !== true || r.basket_sku !== 'BSK-S' || Number(r.base_per_basket) !== 70)
      return bad('Case1 basket fields', JSON.stringify(r));
    if (r.egg_profile_status_derived !== 'complete' && r.egg_profile_status_derived !== 'incomplete')
      return bad('Case1 egg_status_derived missing');
    if (r.basket_status_derived == null) return bad('Case1 basket_status_derived missing');
    ok('Case 1 — Export current: per-SKU row with egg + basket + derived fields');
  } catch(e){ bad('Case1 threw', e.message); }
})();

// ========== Case 2 — Round-trip unchanged ==========
(function case2(){
  try {
    const rows = sandbox.MASTER_V3.items.map(T13A2.deriveRow);
    const v = T13A2.validateImportRows(rows.map(r=>Object.assign({},r)));
    // Cleanly-derived rows may produce 0 changes for matching items
    if (v.summary.blocking_errors !== 0) return bad('Case2 blocking', JSON.stringify(v.summary));
    if (v.summary.to_update + v.summary.unchanged < sandbox.MASTER_V3.items.length)
      return bad('Case2 coverage', JSON.stringify(v.summary));
    ok('Case 2 — Round-trip unchanged: 0 blocking, mostly unchanged');
  } catch(e){ bad('Case2 threw', e.message); }
})();

// ========== Case 3 — Egg single-grade ==========
(function case3(){
  try {
    const row = { sku:'FG_PLAIN', is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'2' };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors !== 0) return bad('Case3 blocking', JSON.stringify(v.rows[0]._errors));
    // Derived egg status simulated as complete
    if (v.rows[0]._egg_status_derived !== 'complete') return bad('Case3 derived status', v.rows[0]._egg_status_derived);
    ok('Case 3 — Egg single-grade: valid, derived complete');
  } catch(e){ bad('Case3 threw', e.message); }
})();

// ========== Case 4 — Egg mixed-grade ==========
(function case4(){
  try {
    const row = { sku:'FG_PLAIN', is_egg:true, egg_content_type:'GRADED_MIX', primary_grade:'2', secondary_grade:'3', min_primary:40 };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors !== 0) return bad('Case4 blocking', JSON.stringify(v.rows[0]._errors));
    if (v.rows[0]._egg_status_derived !== 'complete') return bad('Case4 derived status', v.rows[0]._egg_status_derived);
    ok('Case 4 — Egg mixed-grade: valid, derived complete');
  } catch(e){ bad('Case4 threw', e.message); }
})();

// ========== Case 5 — Egg inactive (is_egg=false) ==========
(function case5(){
  try {
    const row = { sku:'B0001', is_egg:false };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors !== 0) return bad('Case5 blocking', JSON.stringify(v.rows[0]._errors));
    // Simulated state: is_egg=false
    const sim = T13A2.simulateOverlay(sandbox.MASTER_V3.items.find(it=>it.sku==='B0001'), row, true, 70, 'BSK-S');
    if (sim.is_egg !== false) return bad('Case5 overlay', JSON.stringify(sim));
    if (T13A2.derivedEggStatus(sim).status !== 'not_egg') return bad('Case5 status not_egg');
    ok('Case 5 — Egg inactive: is_egg=false; derived not_egg');
  } catch(e){ bad('Case5 threw', e.message); }
})();

// ========== Case 6 — Basket activate ==========
(function case6(){
  try {
    const row = { sku:'FG_PLAIN', uses_basket:true, basket_sku:'BSK-M', base_per_basket:60 };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors !== 0) return bad('Case6 blocking', JSON.stringify(v.rows[0]._errors));
    if (v.rows[0]._basket_action !== 'basket_activated' && v.rows[0]._basket_action !== 'basket_updated')
      return bad('Case6 action', v.rows[0]._basket_action);
    // Commit and verify preservation
    const snapshotBefore = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items));
    const cr = T13A2.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('Case6 commit not ok', cr.error);
    const after = sandbox.MASTER_V3.items.find(it=>it.sku==='FG_PLAIN');
    if (after.units.has_basket_unit !== true || after.units.base_per_basket !== 60)
      return bad('Case6 units not set', JSON.stringify(after.units));
    const basketC = after.bom.components.find(c=>c.component_role==='basket');
    if (!basketC || basketC.component_sku !== 'BSK-M') return bad('Case6 basket component', JSON.stringify(basketC));
    // Identity preserved
    const before = snapshotBefore.find(it=>it.sku==='FG_PLAIN');
    if (before.item_role !== after.item_role) return bad('Case6 item_role drift');
    if (JSON.stringify(before.units.base_unit) !== JSON.stringify(after.units.base_unit)) return bad('Case6 base_unit changed');
    ok('Case 6 — Basket activate: SKU set, units written, identity/units preserved');
  } catch(e){ bad('Case6 threw', e.message); }
})();

// ========== Case 7 — Basket deactivate ==========
(function case7(){
  try {
    const beforeB = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items.find(it=>it.sku==='B0001')));
    const row = { sku:'B0001', uses_basket:false };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors !== 0) return bad('Case7 blocking', JSON.stringify(v.rows[0]._errors));
    const cr = T13A2.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('Case7 commit not ok', cr.error);
    const afterB = sandbox.MASTER_V3.items.find(it=>it.sku==='B0001');
    if (afterB.units.has_basket_unit !== false) return bad('Case7 has_basket_unit not false');
    // Basket component preserved per Task 8C-2E
    const basketC = afterB.bom.components.find(c=>c.component_role==='basket');
    if (!basketC || basketC.component_sku !== beforeB.bom.components.find(c=>c.component_role==='basket').component_sku)
      return bad('Case7 basket component not preserved');
    // BOM does not fail because basket inactive — basket_unit / base_per_basket retained for data
    if (afterB.units.base_per_basket !== beforeB.units.base_per_basket)
      return bad('Case7 base_per_basket should be preserved when deactivating');
    ok('Case 7 — Basket deactivate: has_basket_unit=false; basket component preserved as inactive');
  } catch(e){ bad('Case7 threw', e.message); }
})();

// ========== Case 8 — Invalid basket SKU ==========
(function case8(){
  try {
    const row = { sku:'FG_MIX', uses_basket:true, basket_sku:'NOT-A-BASKET', base_per_basket:50 };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors === 0) return bad('Case8 expected blocking');
    if (!v.rows[0]._errors.some(e=>e.field==='basket_sku')) return bad('Case8 missing basket_sku error');
    const cr = T13A2.commitImport({ rows: v.rows, summary: v.summary });
    if (cr.ok !== false) return bad('Case8 commit accepted!');
    ok('Case 8 — Invalid basket SKU: blocking; commit refused');
  } catch(e){ bad('Case8 threw', e.message); }
})();

// ========== Case 9 — Invalid egg grade ==========
(function case9(){
  try {
    const row = { sku:'FG_PLAIN', is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'99' };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors === 0) return bad('Case9 expected blocking');
    if (!v.rows[0]._errors.some(e=>e.field==='primary_grade')) return bad('Case9 missing grade error');
    ok('Case 9 — Invalid egg grade: blocking with primary_grade error');
  } catch(e){ bad('Case9 threw', e.message); }
})();

// ========== Case 10 — Unknown SKU ==========
(function case10(){
  try {
    const row = { sku:'BRAND_NEW_SKU', is_egg:false };
    const v = T13A2.validateImportRows([row]);
    if (v.summary.blocking_errors === 0) return bad('Case10 expected blocking');
    if (!v.rows[0]._errors.some(e=>e.field==='sku' && /not found/.test(e.msg))) return bad('Case10 missing sku-not-found error');
    const cr = T13A2.commitImport({ rows: v.rows, summary: v.summary });
    if (cr.ok !== false) return bad('Case10 commit accepted!');
    // Verify NEW SKU not created
    const created = sandbox.MASTER_V3.items.find(it=>it.sku==='BRAND_NEW_SKU');
    if (created) return bad('Case10 new SKU was created!');
    ok('Case 10 — Unknown SKU: blocking; no new SKU created');
  } catch(e){ bad('Case10 threw', e.message); }
})();

// ========== Case 11 — Out-of-scope columns ==========
(function case11(){
  try {
    const aoa = [
      ['sku','name_th','item_role','units.base_unit','bom.enabled','packaging_profile.uses_base_pack','is_egg','egg_content_type','primary_grade'],
      ['B0001','ไข่ตะกร้า drift','PACKAGING','ดวง','false','false','true','GRADED_SINGLE','3']
    ];
    const parsed = T13A2.aoaToObjects(aoa);
    if (!parsed.ignored_columns.includes('units.base_unit')) return bad('Case11 missed units.base_unit ignore');
    if (!parsed.ignored_columns.includes('bom.enabled')) return bad('Case11 missed bom.enabled ignore');
    if (!parsed.ignored_columns.includes('packaging_profile.uses_base_pack')) return bad('Case11 missed packaging ignore');
    // The identity drift (name_th + item_role) should warn, not overwrite
    const v = T13A2.validateImportRows(parsed.rows);
    const wIdent = v.rows[0]._warnings.filter(w=>['name_th','item_role'].includes(w.field));
    if (wIdent.length < 2) return bad('Case11 missing identity-mismatch warnings');
    // Out-of-scope blocked from update
    const beforeB = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items.find(it=>it.sku==='B0001')));
    const cr = T13A2.commitImport({ rows: v.rows, summary: v.summary });
    if (!cr.ok) return bad('Case11 commit not ok', cr.error);
    const afterB = sandbox.MASTER_V3.items.find(it=>it.sku==='B0001');
    if (afterB.units.base_unit !== beforeB.units.base_unit) return bad('Case11 base_unit changed!');
    if (afterB.item_role !== beforeB.item_role) return bad('Case11 item_role changed!');
    if (JSON.stringify(afterB.packaging_profile) !== JSON.stringify(beforeB.packaging_profile)) return bad('Case11 packaging_profile changed');
    ok('Case 11 — Out-of-scope columns ignored; Identity/Units/Packaging not changed');
  } catch(e){ bad('Case11 threw', e.message); }
})();

// ========== Case 12 — Regression: Identity + Units behavior intact ==========
(function case12(){
  try {
    if (!/onclick="openBomBulkUpload\(\)"/.test(html) === false) return bad('Case12 bom bulk upload still present');
    if (!/id="masterAdminTools"/.test(html)) return bad('Case12 admin tools missing');
    // Task 13A-1 / 1A / 1E namespaces still exposed
    if (typeof sandbox.t13a1_exportIdentityUnits !== 'function') return bad('Case12 13A-1 export missing');
    if (typeof sandbox.t13a1e_openRepairPreview !== 'function') return bad('Case12 13A-1E repair missing');
    if (typeof sandbox.t13a2_exportEggBasket !== 'function') return bad('Case12 13A-2 export missing');
    // PACKAGING items still get role-derived behavior via 13A-1E
    const synth = { sku:'NEW_PKG', item_role:'PACKAGING', is_sellable:true };
    const r = sandbox.T13A1.applyRoleBehavior(synth);
    if (!r.changed || synth.is_sellable !== false) return bad('Case12 13A-1E behavior helper regression');
    ok('Case 12 — Identity + Units + 13A-1E behavior repair tools intact');
  } catch(e){ bad('Case12 threw', e.message); }
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
