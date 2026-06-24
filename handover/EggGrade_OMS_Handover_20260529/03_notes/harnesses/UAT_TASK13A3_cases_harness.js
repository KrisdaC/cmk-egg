// Task 13A-3 acceptance harness — Cases 1–9 from the brief.
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH'},location:{hash:'',search:''},localStorage:(function(){const s={};return{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function(){},URL:{createObjectURL:()=>'x',revokeObjectURL(){}},File:function(){},FileReader:function(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, WIP:{sellable:false,producable:true,consumable:false}, RM:{sellable:false,producable:false,consumable:true}, PACKAGING:{sellable:false,producable:false,consumable:true}, SUPPLY:{sellable:false,producable:false,consumable:true}, DEFECT:{sellable:true,producable:false,consumable:false} };
sandbox._BOM_PACKAGING_SLOTS = [
  { role: 'pack_base', th: 'pack ฐาน', en: 'Base Pack', ready: true, allowed_types: ['tray'] },
  { role: 'cover',     th: 'ฝาครอบ',    en: 'Cover',     ready: false, allowed_types: ['cover'] },
  { role: 'barcode_sku_label', th:'ฉลาก barcode SKU', en:'SKU barcode label', ready:false, allowed_types:['label'] },
  { role: 'product_label_sticker', th:'ฉลาก/สติกเกอร์', en:'Product label / sticker', ready:false, allowed_types:['sticker','label'] },
  { role: 'closer_1',  th: 'Closer 1',  en: 'Closer 1',  ready: false, allowed_types: [] },
  { role: 'closer_2',  th: 'Closer 2',  en: 'Closer 2',  ready: false, allowed_types: [] },
  { role: 'bulk_barcode_label', th:'ฉลาก barcode Bulk', en:'Bulk barcode label', ready:false, allowed_types:['label'] },
  { role: 'other',     th: 'อื่นๆ',     en: 'Others',    ready: false, allowed_types: ['other'] }
];
sandbox._BOM_PKG_CATEGORIES = [
  { code:'tray', th:'ถาด', en:'Tray' }, { code:'cover', th:'ฝาครอบ', en:'Cover' },
  { code:'label', th:'ฉลาก', en:'Label' }, { code:'sticker', th:'สติกเกอร์', en:'Sticker' },
  { code:'pack', th:'วัสดุแพ็ค', en:'Pack material' }, { code:'other', th:'อื่นๆ', en:'Other' }
];
vm.createContext(sandbox);
let merged=''; for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });

sandbox.MASTER_V3 = {
  customers:[], sites:[], items:[
    // FG with everything: egg, basket, packaging profile, manual component
    { id:1, sku:'FG1', name_th:'FG one', item_role:'FG', item_type:'packed_egg', is_active:true,
      selling_unit:'แพ็ค 10', units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10, has_basket_unit:true, basket_unit:'ตะกร้า', base_per_basket:60},
      is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3',
      bom:{ enabled:true, no_bom_required:false, output_unit:'แพ็ค 10', notes:'',
            components:[
              { component_type:'packaging', component_role:'basket', component_sku:'BSK1', component_name:'basket', qty_per_selling_unit:1, unit:'ใบ', source:'basket_profile', required:true },
              { component_type:'packaging', component_role:'tray',   component_sku:'TRAY1', component_name:'tray1', qty_per_basis:1, qty_per_selling_unit:1, unit:'ใบ', source:'bom_setup', source_added:'packaging_profile_pack_base', required:true },
              { component_type:'packaging', component_role:'label',  component_sku:'LBL1', component_name:'manual label', qty_per_basis:1, unit:'ดวง', source:'bom_setup', source_added:'packaging_editor', required:true, notes:'' }
            ], routes:[{ route_code:'r1' }] },
      packaging_profile:{ pack_base:{ enabled:true, item_role:'PACKAGING', item_type:'tray', component_sku:'TRAY1', component_name:'tray1', qty_per_selling_unit:1, selection_mode:'manual', rule_id:null, packaging_key:'tray', requirement_status:'required' } },
      external_refs:{ partner:'foo' }
    },
    // Packaging candidates
    { id:101, sku:'TRAY1', name:'tray small',  item_role:'PACKAGING', item_type:'tray',  is_active:true,  units:{base_unit:'ใบ'} },
    { id:102, sku:'TRAY2', name:'tray big',    item_role:'PACKAGING', item_type:'tray',  is_active:true,  units:{base_unit:'ใบ'} },
    { id:103, sku:'LBL1',  name:'label one',   item_role:'PACKAGING', item_type:'label', is_active:true,  units:{base_unit:'ดวง'} },
    { id:104, sku:'BSK1',  name:'basket SKU',  item_role:'PACKAGING', item_type:'basket', is_active:true, units:{base_unit:'ใบ'} },
    { id:105, sku:'NOTPK', name:'an FG',       item_role:'FG',        item_type:'packed_egg', is_active:true, units:{base_unit:'ฟอง'} }
  ],
  option_sets:{
    item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true},{code:'RM',is_active:true}],
    unit:[{code:'ฟอง',is_active:true},{code:'ใบ',is_active:true},{code:'แพ็ค 10',is_active:true},{code:'ดวง',is_active:true}],
    egg_content_type:[{code:'GRADED_SINGLE',is_active:true}],
    egg_grade:[{code:'3',is_active:true}]
  }, meta:{}
};
sandbox.persistMasterV3 = function(){return{ok:true};};
sandbox.getOptionSet = function(setKey){ return (((sandbox.MASTER_V3||{}).option_sets||{})[setKey]||[]).slice(); };
sandbox.getItemTypeOptionsForRole = function(){return[];};
sandbox._bomSyncPackagingProfile = function(real, live){
  // Minimal sync: rewrite source_added='packaging_profile_<slot>' component for each enabled slot.
  if (!real || !real.bom || !Array.isArray(real.bom.components)) return;
  if (!real.packaging_profile) return;
  Object.keys(real.packaging_profile).forEach(function(slot){
    var pp = real.packaging_profile[slot];
    var tag = 'packaging_profile_' + slot;
    var idx = -1;
    for (var i=0;i<real.bom.components.length;i++){
      var c=real.bom.components[i]; if (c && (c.source_added===tag || c.source_added==='packaging_profile_pack_base_tray')) { idx=i; break; }
    }
    if (!pp.enabled) { if (idx>=0) real.bom.components.splice(idx,1); return; }
    var row = (idx>=0) ? real.bom.components[idx] : { component_type:'packaging', source:'bom_setup', source_added:tag, required:true };
    row.component_role = pp.item_type || row.component_role;
    row.component_sku = pp.component_sku;
    row.component_name = pp.component_name || pp.component_sku;
    row.qty_per_selling_unit = pp.qty_per_selling_unit;
    row.qty_per_basis = pp.qty_per_selling_unit;
    if (idx<0) real.bom.components.push(row);
  });
};

const T13A3 = sandbox.T13A3;
if (!T13A3) { console.error('T13A3 missing'); process.exit(1); }

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// ===== Case 1 — Export shape =====
(function c1(){
  const headers = { BOM:T13A3.BOM_HEADERS, SLOT:T13A3.SLOT_HEADERS, MANUAL:T13A3.MANUAL_HEADERS };
  // No deprecated supply fields anywhere
  const all = [].concat(headers.BOM, headers.SLOT, headers.MANUAL);
  if (all.some(h => /consumable|supply/i.test(h))) return bad('Case1 deprecated columns present');
  // No derived columns labelled *_derived in editable headers
  if (all.some(h => /_derived$/.test(h))) return bad('Case1 derived columns present');
  // Required columns
  if (!headers.BOM.includes('bom_enabled') || !headers.BOM.includes('bom_notes')) return bad('Case1 missing bom editable');
  if (!headers.SLOT.includes('slot_key') || !headers.SLOT.includes('packaging_sku')) return bad('Case1 missing slot editable');
  if (!headers.MANUAL.includes('component_sku') || !headers.MANUAL.includes('qty_per_basis')) return bad('Case1 missing manual editable');
  ok('Case 1 — Export shape: no deprecated, no derived columns; required editable headers present');
})();

// ===== Case 2 — Round-trip unchanged =====
(function c2(){
  // Derive rows from the master, then validate them — should be 0 blocking + 0 changes for each row
  const items = sandbox.MASTER_V3.items;
  const bomRows = items.map(T13A3.deriveBomRow);
  const slotRows = [].concat.apply([], items.map(T13A3.deriveSlotRows));
  const manualRows = [].concat.apply([], items.map(T13A3.deriveManualRows));
  const parsed = { bom:{rows:bomRows}, slots:{rows:slotRows}, manual:{rows:manualRows} };
  const v = T13A3.validateAll(parsed);
  if (v.summary.blocking_errors !== 0) return bad('Case2 blocking', JSON.stringify(v.summary));
  if (v.summary.bom_to_update + v.summary.slot_to_update + v.summary.manual_to_update !== 0)
    return bad('Case2 expected 0 updates', JSON.stringify(v.summary));
  ok('Case 2 — Round-trip unchanged: 0 blocking, 0 updates (everything matches)');
})();

// ===== Case 3 — Packaging slot update preserves Identity/Units/Egg/Basket =====
(function c3(){
  const before = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items.find(it=>it.sku==='FG1')));
  const parsed = {
    bom:{rows:[]}, manual:{rows:[]},
    slots:{ rows:[{ sku:'FG1', slot_key:'pack_base', slot_enabled:true, slot_item_type:'tray', packaging_sku:'TRAY2', qty_per_selling_unit:2 }] }
  };
  T13A3.validateAll(parsed);
  if (parsed.summary.blocking_errors !== 0) return bad('Case3 blocking', JSON.stringify(parsed.summary));
  const cr = T13A3.commitImport(parsed);
  if (!cr.ok) return bad('Case3 commit not ok', cr.error);
  const after = sandbox.MASTER_V3.items.find(it=>it.sku==='FG1');
  // Slot updated
  if (after.packaging_profile.pack_base.component_sku !== 'TRAY2') return bad('Case3 slot SKU not updated');
  if (after.packaging_profile.pack_base.qty_per_selling_unit !== 2) return bad('Case3 qty not updated');
  // Identity preserved
  if (after.name_th !== before.name_th) return bad('Case3 identity drift');
  if (after.item_role !== before.item_role) return bad('Case3 role drift');
  // Units preserved
  if (JSON.stringify(after.units) !== JSON.stringify(before.units)) return bad('Case3 units drift');
  // Egg preserved
  if (after.is_egg !== before.is_egg || after.primary_grade !== before.primary_grade) return bad('Case3 egg drift');
  // Basket component preserved (component_role=basket)
  const basketRow = after.bom.components.find(c=>c.component_role==='basket');
  if (!basketRow || basketRow.component_sku !== 'BSK1') return bad('Case3 basket row mutated');
  // External refs preserved
  if (!after.external_refs || after.external_refs.partner !== 'foo') return bad('Case3 external_refs lost');
  // BOM routes preserved
  if (!after.bom.routes || after.bom.routes.length !== 1) return bad('Case3 bom.routes lost');
  ok('Case 3 — Packaging slot update: applied; Identity/Units/Egg/Basket/External/bom.routes all preserved');
})();

// ===== Case 4 — Invalid packaging SKU (not in master) =====
(function c4(){
  const parsed = { bom:{rows:[]}, manual:{rows:[]},
    slots:{ rows:[{ sku:'FG1', slot_key:'cover', slot_enabled:true, slot_item_type:'cover', packaging_sku:'GHOST_SKU', qty_per_selling_unit:1 }] }
  };
  T13A3.validateAll(parsed);
  if (parsed.summary.blocking_errors === 0) return bad('Case4 expected blocking');
  if (!parsed.slots.rows[0]._errors.some(e=>e.field==='packaging_sku')) return bad('Case4 missing packaging_sku error');
  const cr = T13A3.commitImport(parsed);
  if (cr.ok !== false) return bad('Case4 commit accepted!');
  ok('Case 4 — Invalid packaging SKU: blocking error; commit refused');
})();

// ===== Case 5 — Non-PACKAGING SKU in packaging slot =====
(function c5(){
  const parsed = { bom:{rows:[]}, manual:{rows:[]},
    slots:{ rows:[{ sku:'FG1', slot_key:'cover', slot_enabled:true, slot_item_type:'cover', packaging_sku:'NOTPK', qty_per_selling_unit:1 }] }
  };
  T13A3.validateAll(parsed);
  if (parsed.summary.blocking_errors === 0) return bad('Case5 expected blocking (FG not eligible as packaging)');
  ok('Case 5 — Non-PACKAGING SKU rejected as packaging_sku (NOTPK is an FG)');
})();

// ===== Case 6 — Unknown SKU =====
(function c6(){
  const parsed = {
    bom:{ rows:[{ sku:'BRAND_NEW', bom_enabled:true }]},
    slots:{rows:[]}, manual:{rows:[]}
  };
  T13A3.validateAll(parsed);
  if (parsed.summary.blocking_errors === 0) return bad('Case6 expected blocking');
  if (!parsed.bom.rows[0]._errors.some(e=>/sku not found/.test(e.msg))) return bad('Case6 missing sku-not-found error');
  const beforeCount = sandbox.MASTER_V3.items.length;
  const cr = T13A3.commitImport(parsed);
  if (cr.ok !== false) return bad('Case6 commit accepted!');
  if (sandbox.MASTER_V3.items.length !== beforeCount) return bad('Case6 items count changed!');
  ok('Case 6 — Unknown SKU: blocking; no new SKU created');
})();

// ===== Case 7 — Out-of-scope columns ignored =====
(function c7(){
  const aoa = [['sku','bom_enabled','units.base_unit','egg_content_type','customer_code'],['FG1','true','ดวง','GRADED_MIX','BIGC']];
  const parsed = T13A3.aoaToObjects(aoa, T13A3.BOM_HEADERS);
  if (!parsed.ignored_columns.includes('units.base_unit')) return bad('Case7 missing units.base_unit ignore');
  if (!parsed.ignored_columns.includes('egg_content_type')) return bad('Case7 missing egg_content_type ignore');
  if (!parsed.ignored_columns.includes('customer_code')) return bad('Case7 missing customer_code ignore');
  ok('Case 7 — Out-of-scope columns (units / egg / customer) ignored on Step 3 import');
})();

// ===== Case 8 — Manual component classification safety =====
(function c8(){
  const item = sandbox.MASTER_V3.items.find(it=>it.sku==='FG1');
  const comps = item.bom.components;
  // Verify classification
  if (T13A3.classify(comps.find(c=>c.component_role==='basket')) !== 'basket') return bad('Case8 basket classified');
  if (T13A3.classify(comps.find(c=>c.source_added==='packaging_profile_pack_base')) !== 'packaging_profile') return bad('Case8 packaging_profile classified');
  if (T13A3.classify(comps.find(c=>c.source_added==='packaging_editor')) !== 'manual') return bad('Case8 manual classified');
  // Export only includes manual rows
  const rows = T13A3.deriveManualRows(item);
  if (rows.length !== 1) return bad('Case8 manual rows count', rows.length);
  if (rows[0].component_sku !== 'LBL1') return bad('Case8 wrong manual row exported');
  ok('Case 8 — Manual component classification: basket / packaging_profile / manual distinguishable; export includes manual only');
})();

// ===== Case 9 — Regression =====
(function c9(){
  if (typeof sandbox.t13a1_exportIdentityUnits !== 'function') return bad('Case9 13A-1 export missing');
  if (typeof sandbox.t13a2_exportEggBasket    !== 'function') return bad('Case9 13A-2 export missing');
  if (typeof sandbox.t13a1e_openRepairPreview !== 'function') return bad('Case9 13A-1E repair missing');
  if (/onclick="openBomBulkUpload\(\)"/.test(html))            return bad('Case9 BOM Bulk Upload reintroduced!');
  if (/data-f="units\.has_consumable_unit"/.test(html))        return bad('Case9 Supply DOM fields reintroduced!');
  ok('Case 9 — Regression: 13A-1/2/1E exports + Task 12B/13A-0B intact');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
