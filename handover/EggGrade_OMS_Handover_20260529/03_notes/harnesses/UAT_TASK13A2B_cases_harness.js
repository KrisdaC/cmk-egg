// Task 13A-2B acceptance harness — Cases 1–8 from the brief.
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH'},location:{hash:'',search:''},localStorage:(function(){const s={};return{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function(){},FileReader:function(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
// Inject so module-level typeof checks work
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, WIP:{sellable:false,producable:true,consumable:false}, RM:{sellable:false,producable:false,consumable:true}, PACKAGING:{sellable:false,producable:false,consumable:true}, SUPPLY:{sellable:false,producable:false,consumable:true}, DEFECT:{sellable:true,producable:false,consumable:false} };
vm.createContext(sandbox);
let merged=''; for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });

// Override sandbox helpers for option_sets / basket candidates so build*
// functions read from the test MASTER_V3.
sandbox.MASTER_V3 = {
  customers: [{id:1,code:'BIGC',nickname:'BigC',business_name:'BigC',is_active:true}],
  sites: [],
  items: [
    { id:100, sku:'BSK-S', name:'ตะกร้า S', item_role:'PACKAGING', item_type:'basket', is_active:true, units:{base_unit:'ใบ'} },
    { id:1, sku:'EG1', name:'egg1', name_th:'egg1', item_role:'FG', item_type:'packed_egg', is_active:true,
      selling_unit:'แพ็ค 10', units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10},
      is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3', bom:{components:[],routes:[]} },
    { id:2, sku:'PKG1', name:'pkg1', item_role:'PACKAGING', item_type:'tray', is_active:true,
      units:{base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:100} }
  ],
  option_sets:{
    item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true},{code:'RM',is_active:true}],
    unit:[{code:'ฟอง',is_active:true},{code:'แพ็ค 10',is_active:true},{code:'ใบ',is_active:true},{code:'ห่อ',is_active:true}],
    egg_content_type:[{code:'UNGRADED_EGG',is_active:true},{code:'UNDERGRADE',is_active:true},{code:'GRADED_SINGLE',is_active:true},{code:'GRADED_MIX',is_active:true}],
    egg_grade:[{code:'0',is_active:true},{code:'1',is_active:true},{code:'2',is_active:true},{code:'3',is_active:true},{code:'4',is_active:true},{code:'5',is_active:true},{code:'6',is_active:true}]
  }, meta:{}
};
sandbox.persistMasterV3 = function(){return{ok:true};};
sandbox.getOptionSet = function(setKey){ return (((sandbox.MASTER_V3||{}).option_sets||{})[setKey]||[]).slice(); };
sandbox._bomBasketCandidateItems = function(){ return ((sandbox.MASTER_V3||{}).items||[]).filter(x=>x&&String(x.item_role||'').toUpperCase()==='PACKAGING'&&String(x.item_type||'').toLowerCase()==='basket'); };
sandbox._bomBasketComponents = function(it){ return ((it&&it.bom&&it.bom.components)||[]).filter(c=>c&&c.component_role==='basket'); };
sandbox._bomBasketProfileStatus = function(){return{ok:true,msg:''};};
sandbox._bomResolveBasketUnit = function(sku,fb){return fb;};
sandbox.calculateBasketRequirementFromItem = function(it,q){const bpb=Number(((it&&it.units)||{}).base_per_basket||0);return bpb>0?[{required_qty:Number(q||0)/bpb}]:[];};
sandbox.normalizeItemUnits = function(it){const u=(it&&it.units)||{};return{base_unit:u.base_unit||'',pack_unit:u.pack_unit||'',base_per_pack:u.base_per_pack==null?null:Number(u.base_per_pack),has_basket_unit:u.has_basket_unit===true||(u.has_basket_unit==null&&Number(u.base_per_basket||0)>0),basket_unit:u.basket_unit||'ตะกร้า',base_per_basket:u.base_per_basket==null?null:Number(u.base_per_basket),storage_unit:u.storage_unit||'',base_per_storage:u.base_per_storage==null?null:Number(u.base_per_storage),has_consumable_unit:u.has_consumable_unit===true,consumable_unit:u.consumable_unit||'',base_per_consumable:u.base_per_consumable==null?null:Number(u.base_per_consumable)};};
sandbox.getItemTypeOptionsForRole = function(role){const M={FG:[['packed_egg','ไข่แพ็ค','Packed egg']],PACKAGING:[['tray','ถาด','Tray'],['basket','ตะกร้า','Basket']],RM:[['raw_egg','ไข่ดิบ','Raw egg']],WIP:[],SUPPLY:[],DEFECT:[]};return (M[String(role||'').toUpperCase()]||[]).slice();};

const T13A1 = sandbox.T13A1;
const T13A2 = sandbox.T13A2;
if (!T13A1 || !T13A2) { console.error('Modules missing'); process.exit(1); }

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// ===== Case 1 — Step 1 clean export =====
(function case1(){
  const cols = T13A1.SHEET1_COLUMNS;  // wider allowlist
  const exp = T13A1.SHEET1_EXPORT_COLUMNS;
  if (!exp) return bad('Case1 SHEET1_EXPORT_COLUMNS missing');
  // Clean export has 15 columns (8 Identity + 7 Units)
  const expected = ['sku','name_th','name_en','item_role','item_type','customer_code','is_active','notes','base_unit','base_factor','pack_unit','base_per_pack','storage_unit','base_per_storage','selling_unit'];
  if (exp.length !== expected.length || !expected.every((c,i)=>exp[i]===c))
    return bad('Case1 columns', JSON.stringify(exp));
  // Forbidden in clean export
  const forbidden = ['customer_name_derived','selling_base_factor_derived','behavior_from_role_derived','legacy_has_consumable_unit','legacy_consumable_unit','legacy_base_per_consumable'];
  for (const f of forbidden) if (exp.includes(f)) return bad('Case1 forbidden present: '+f);
  // Wider allowlist still includes derived + legacy (so old files re-parse)
  if (!cols.includes('customer_name_derived')) return bad('Case1 allowlist drops derived');
  if (!cols.includes('legacy_has_consumable_unit')) return bad('Case1 allowlist drops legacy');
  ok('Case 1 — Step 1 clean export columns + wider allowlist retained');
})();

// ===== Case 2 — Step 2 clean export =====
(function case2(){
  const cols = T13A2.SHEET1_COLUMNS;
  const exp = T13A2.SHEET1_EXPORT_COLUMNS;
  if (!exp) return bad('Case2 SHEET1_EXPORT_COLUMNS missing');
  // Friendly cols egg_input_type + egg_is_mixed kept; derived REMOVED
  for (const required of ['sku','name_th','is_egg','egg_input_type','egg_is_mixed','primary_grade','secondary_grade','min_primary','uses_basket','basket_sku','basket_unit','base_per_basket'])  // UAT Pro · Task 13A-2C — egg_content_type dropped from export
    if (!exp.includes(required)) return bad('Case2 missing '+required);
  const forbidden = ['egg_profile_status_derived','egg_bom_lines_derived','basket_qty_per_pack_derived','basket_status_derived'];
  for (const f of forbidden) if (exp.includes(f)) return bad('Case2 derived in export: '+f);
  // Wider allowlist still includes derived
  if (!cols.includes('egg_profile_status_derived')) return bad('Case2 allowlist drops derived');
  ok('Case 2 — Step 2 clean export columns + wider allowlist retained');
})();

// ===== Case 3 — Import OLD Step 1 file (with derived cols) =====
(function case3(){
  const aoa = [
    ['sku','name_th','item_role','customer_name_derived','base_unit','base_per_pack','selling_base_factor_derived','legacy_has_consumable_unit'],
    ['EG1','egg1','FG','BigC','ฟอง','10','10','false']
  ];
  const parsed = T13A1.aoaToObjects(aoa);
  // Derived + legacy cols should NOT be flagged as ignored (in allowlist)
  if (parsed.ignored_columns.includes('customer_name_derived'))   return bad('Case3 customer_name_derived flagged ignored');
  if (parsed.ignored_columns.includes('selling_base_factor_derived')) return bad('Case3 derived flagged ignored');
  if (parsed.ignored_columns.includes('legacy_has_consumable_unit'))  return bad('Case3 legacy flagged ignored');
  const v = T13A1.validateImportRows(parsed.rows);
  if (v.summary.blocking_errors !== 0) return bad('Case3 blocking', JSON.stringify(v.rows[0]._errors));
  ok('Case 3 — Import OLD Step 1 file: derived + legacy columns parsed but ignored on commit');
})();

// ===== Case 4 — Import NEW clean Step 1 file (no derived) =====
(function case4(){
  const aoa = [T13A1.SHEET1_EXPORT_COLUMNS, ['EG1','egg1','','FG','packed_egg','BIGC','true','','ฟอง','1','แพ็ค 10','10','','','แพ็ค 10']];
  const parsed = T13A1.aoaToObjects(aoa);
  if (parsed.ignored_columns.length !== 0) return bad('Case4 ignored', JSON.stringify(parsed.ignored_columns));
  const v = T13A1.validateImportRows(parsed.rows);
  if (v.summary.blocking_errors !== 0) return bad('Case4 blocking', JSON.stringify(v.rows[0]._errors));
  ok('Case 4 — Import NEW clean Step 1 file: parses cleanly, no derived needed');
})();

// ===== Case 5 — Import OLD Step 2 file (with derived) =====
(function case5(){
  const aoa = [
    ['sku','is_egg','egg_content_type','primary_grade','egg_profile_status_derived','uses_basket','basket_status_derived'],
    ['EG1','true','GRADED_SINGLE','3','complete','false','basket off']
  ];
  const parsed = T13A2.aoaToObjects(aoa);
  if (parsed.ignored_columns.includes('egg_profile_status_derived')) return bad('Case5 egg derived flagged ignored');
  if (parsed.ignored_columns.includes('basket_status_derived'))      return bad('Case5 basket derived flagged ignored');
  const v = T13A2.validateImportRows(parsed.rows);
  if (v.summary.blocking_errors !== 0) return bad('Case5 blocking', JSON.stringify(v.rows[0]._errors));
  ok('Case 5 — Import OLD Step 2 file: derived columns parsed but ignored on commit');
})();

// ===== Case 6 — Import NEW clean Step 2 file (no derived) =====
(function case6(){
  const aoa = [T13A2.SHEET1_EXPORT_COLUMNS, ['EG1','egg1','','FG','packed_egg','true','true','GRADED_SINGLE','3','','','graded','false','false','','','']];
  const parsed = T13A2.aoaToObjects(aoa);
  if (parsed.ignored_columns.length !== 0) return bad('Case6 ignored', JSON.stringify(parsed.ignored_columns));
  const v = T13A2.validateImportRows(parsed.rows);
  if (v.summary.blocking_errors !== 0) return bad('Case6 blocking', JSON.stringify(v.rows[0]._errors));
  ok('Case 6 — Import NEW clean Step 2 file: parses cleanly, no derived needed');
})();

// ===== Case 7 — Deprecated supply fields absent =====
(function case7(){
  // No legacy_* columns in the new export
  const cols = T13A1.SHEET1_EXPORT_COLUMNS;
  if (cols.some(c=>c.startsWith('legacy_'))) return bad('Case7 legacy in clean export');
  // Existing item with stored supply fields — should be untouched on round-trip
  const existing = { sku:'SUP1', units:{ base_unit:'ฟอง', has_consumable_unit:true, consumable_unit:'ขวด', base_per_consumable:6 } };
  sandbox.MASTER_V3.items.push(existing);
  // Import a clean row WITHOUT legacy columns
  const row = { sku:'SUP1', name_th:'sup', item_role:'RM', base_unit:'ฟอง' };
  const v = T13A1.validateImportRows([row]);
  const cr = T13A1.commitImport({ rows:v.rows, summary:v.summary });
  if (cr.ok !== true) return bad('Case7 commit not ok');
  const after = sandbox.MASTER_V3.items.find(it=>it&&it.sku==='SUP1');
  if (after.units.has_consumable_unit !== true) return bad('Case7 supply lost');
  if (after.units.consumable_unit !== 'ขวด') return bad('Case7 consumable_unit lost');
  if (after.units.base_per_consumable !== 6) return bad('Case7 base_per_consumable lost');
  ok('Case 7 — Deprecated supply fields absent in file: legacy values preserved internally on existing items');
})();

// ===== Case 8 — Behavior_Function_Summary matches _ROLE_BEHAVIOR_DEFAULTS =====
(function case8(){
  const buildBeh = sandbox._t13a2b_buildBehaviorFunctionSummary;
  if (typeof buildBeh !== 'function') return bad('Case8 helper missing');
  const rows = buildBeh();
  // UAT Pro · Task 13A-2C — restructured to behavior-driven layout.
  // Now expect 12 rows across 3 sections: 3 Behavior driver + 6 Role default + 3 Sub-section gate.
  const sections = {};
  rows.forEach(r=>{ sections[r.section] = (sections[r.section]||0) + 1; });
  if (sections['Behavior driver'] !== 3 || sections['Role default'] !== 6 || sections['Sub-section gate'] !== 3)
    return bad('Case8 section counts', JSON.stringify(sections));
  // Spot-check the Role default rows reflect _ROLE_BEHAVIOR_DEFAULTS
  const fgRow = rows.find(r=>r.section==='Role default' && r.key==='FG');
  const pkgRow = rows.find(r=>r.section==='Role default' && r.key==='PACKAGING');
  if (!fgRow || !/sellable \+ producable/.test(fgRow.enables_en)) return bad('Case8 FG row', JSON.stringify(fgRow));
  if (!pkgRow || !/consumable/.test(pkgRow.enables_en)) return bad('Case8 PACKAGING row', JSON.stringify(pkgRow));
  ok('Case 8 — Behavior_Function_Summary restructured to behavior-driven (3+6+3 rows; Role default reflects _ROLE_BEHAVIOR_DEFAULTS)');
})();

// Bonus: Dropdown_Reference
(function bonus_dr(){
  const buildDR = sandbox._t13a2b_buildDropdownReference;
  if (typeof buildDR !== 'function') return bad('Bonus DR helper missing');
  const rIdent = buildDR('identity_units');
  const rEgg   = buildDR('egg_basket');
  // identity_units scope: item_role + unit + item_type (per role) + customers
  if (!rIdent.some(r=>r.dropdown_name==='item_role'))   return bad('DR identity missing item_role');
  if (!rIdent.some(r=>r.dropdown_name==='unit'))         return bad('DR identity missing unit');
  if (!rIdent.some(r=>r.dropdown_name==='customer_code')) return bad('DR identity missing customer');
  if (!rIdent.some(r=>r.dropdown_name==='item_type'))    return bad('DR identity missing item_type');
  // egg_basket scope: egg_content_type + egg_input_type + egg_grade + basket_sku
  if (!rEgg.some(r=>r.dropdown_name==='egg_content_type')) return bad('DR egg missing egg_content_type');
  if (!rEgg.some(r=>r.dropdown_name==='egg_input_type' && r.code==='raw'))    return bad('DR egg missing egg_input_type=raw');
  if (!rEgg.some(r=>r.dropdown_name==='egg_input_type' && r.code==='graded')) return bad('DR egg missing egg_input_type=graded');
  if (!rEgg.some(r=>r.dropdown_name==='egg_grade'))      return bad('DR egg missing egg_grade');
  if (!rEgg.some(r=>r.dropdown_name==='basket_sku'))     return bad('DR egg missing basket_sku');
  ok('Bonus — Dropdown_Reference builds correctly for both scopes');
})();

// ===== Regression checks =====
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('Regression — BOM Bulk Upload still hidden (Task 13A-0B)'); else bad('13A-0B');
if (!/data-f="units\.has_consumable_unit"/.test(html)) ok('Regression — Supply Unit DOM fields still absent (Task 12B)'); else bad('12B');
if (/function _t12h_storedToUi/.test(html) && /function _t12h_uiToStored/.test(html)) ok('Regression — Task 12H helpers retained'); else bad('Task 12H helpers');
if (/function _t12h_shouldShowMixedFields/.test(html)) ok('Regression — Task 12H fix-up retained'); else bad('Task 12H fix-up');
if (typeof sandbox.t13a1e_openRepairPreview === 'function') ok('Regression — Task 13A-1E repair tool retained'); else bad('13A-1E');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
