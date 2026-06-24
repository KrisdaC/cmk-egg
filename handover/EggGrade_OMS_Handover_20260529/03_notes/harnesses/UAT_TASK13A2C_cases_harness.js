// Task 13A-2C acceptance harness — operator feedback (4 items + regressions).
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH'},location:{hash:'',search:''},localStorage:(function(){const s={};return{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function(){},FileReader:function(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, WIP:{sellable:false,producable:true,consumable:false}, RM:{sellable:false,producable:false,consumable:true}, PACKAGING:{sellable:false,producable:false,consumable:true}, SUPPLY:{sellable:false,producable:false,consumable:true}, DEFECT:{sellable:true,producable:false,consumable:false} };
vm.createContext(sandbox);
let merged=''; for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });
sandbox.MASTER_V3 = {
  customers: [], sites: [], items: [
    { id:1, sku:'EG1', name_th:'egg', item_role:'FG', item_type:'packed_egg', is_active:true, units:{base_unit:'ฟอง',pack_unit:'แพ็ค 10',base_per_pack:10}, selling_unit:'แพ็ค 10', is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3', bom:{components:[],routes:[]} },
    { id:100, sku:'BSK-S', name_th:'basket S', item_role:'PACKAGING', item_type:'basket', is_active:true, units:{base_unit:'ใบ'} }
  ],
  option_sets:{
    item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true}],
    unit:[{code:'ฟอง',is_active:true},{code:'ใบ',is_active:true},{code:'แพ็ค 10',is_active:true}],
    egg_content_type:[{code:'UNGRADED_EGG',is_active:true},{code:'UNDERGRADE',is_active:true},{code:'GRADED_SINGLE',is_active:true},{code:'GRADED_MIX',is_active:true}],
    egg_grade:[{code:'2',is_active:true},{code:'3',is_active:true}]
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
sandbox.getItemTypeOptionsForRole = function(role){const M={FG:[['packed_egg','ไข่แพ็ค','Packed egg']],PACKAGING:[['basket','ตะกร้า','Basket']]};return (M[String(role||'').toUpperCase()]||[]).slice();};

const T13A1 = sandbox.T13A1;
const T13A2 = sandbox.T13A2;
if (!T13A1 || !T13A2) { console.error('Modules missing'); process.exit(1); }

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// ===== Feedback #1 — Validation_Rules sheet =====
(function feedback1(){
  // Both modules still have _buildValidationRules defined (called by export)
  // After my edit, the export sheet lists include Validation_Rules.
  // Check by inspecting source for the sheet name in exports.
  const t13a1ExportHasVR = /name: 'Validation_Rules'.*\n.*\n.*\n.*\n.*\n.*\n.*identity-units'/.test(html.replace(/^/,'')) ||
    /name: 'Validation_Rules',[\s\S]*?identity-units'/.test(html);
  const t13a2ExportHasVR = /name: 'Validation_Rules',[\s\S]*?bom-egg-basket'/.test(html);
  if (t13a1ExportHasVR) ok('Feedback #1a — Step 1 export includes Validation_Rules sheet');
  else bad('Feedback #1a');
  if (t13a2ExportHasVR) ok('Feedback #1b — Step 2 export includes Validation_Rules sheet');
  else bad('Feedback #1b');
})();

// ===== Feedback #2 — Column_Info sheet (read-only vs editable) =====
(function feedback2(){
  const buildColInfo = sandbox._t13a2b_buildColumnInfo;
  if (typeof buildColInfo !== 'function') return bad('Feedback #2 _t13a2b_buildColumnInfo not exposed');
  const idu = buildColInfo('identity_units');
  const eb  = buildColInfo('egg_basket');
  // Identity + Units: sku is read-only (match key); name_th is editable
  const sku1 = idu.find(r=>r.column_name==='sku');
  if (sku1 && /read-only/.test(sku1.usage)) ok('Feedback #2a — Step 1 Column_Info: sku is read-only (match key)');
  else bad('Feedback #2a', JSON.stringify(sku1));
  const nameTh = idu.find(r=>r.column_name==='name_th');
  if (nameTh && /editable/.test(nameTh.usage)) ok('Feedback #2b — Step 1 Column_Info: name_th is editable');
  else bad('Feedback #2b', JSON.stringify(nameTh));
  // Step 2: sku read-only, name_th review-only (not overwritten), is_egg editable
  const sku2 = eb.find(r=>r.column_name==='sku');
  if (sku2 && /read-only/.test(sku2.usage)) ok('Feedback #2c — Step 2 Column_Info: sku is read-only');
  else bad('Feedback #2c', JSON.stringify(sku2));
  const nameRev = eb.find(r=>r.column_name==='name_th');
  if (nameRev && /review-only/.test(nameRev.usage)) ok('Feedback #2d — Step 2 Column_Info: name_th is review-only (not overwritten)');
  else bad('Feedback #2d', JSON.stringify(nameRev));
  const ege = eb.find(r=>r.column_name==='egg_input_type');
  if (ege && /editable/.test(ege.usage)) ok('Feedback #2e — Step 2 Column_Info: egg_input_type is editable');
  else bad('Feedback #2e', JSON.stringify(ege));
  // base_factor in Step 1 is read-only derived (fixed = 1)
  const bf = idu.find(r=>r.column_name==='base_factor');
  if (bf && /read-only/.test(bf.usage)) ok('Feedback #2f — Step 1 Column_Info: base_factor flagged as read-only derived');
  else bad('Feedback #2f', JSON.stringify(bf));
})();

// ===== Feedback #3 — Behavior-driven summary (3 sections) =====
(function feedback3(){
  const build = sandbox._t13a2b_buildBehaviorFunctionSummary;
  if (typeof build !== 'function') return bad('Feedback #3 helper missing');
  const rows = build();
  const sections = {};
  rows.forEach(r=>{ sections[r.section] = (sections[r.section]||0) + 1; });
  // Expected: 3 behavior driver + 6 role default + 3 sub-section gate = 12
  if (sections['Behavior driver'] === 3) ok('Feedback #3a — Behavior driver section has 3 rows (sellable, producable, consumable)');
  else bad('Feedback #3a', JSON.stringify(sections));
  if (sections['Role default'] === 6) ok('Feedback #3b — Role default section has 6 rows (FG/WIP/RM/PACKAGING/SUPPLY/DEFECT)');
  else bad('Feedback #3b', JSON.stringify(sections));
  if (sections['Sub-section gate'] === 3) ok('Feedback #3c — Sub-section gate section has 3 rows (Egg/Basket/Packaging)');
  else bad('Feedback #3c', JSON.stringify(sections));
  // Order: Behavior driver first, then Role default, then Sub-section gate
  const firstRow = rows[0]; const lastRow = rows[rows.length-1];
  if (firstRow.section === 'Behavior driver' && lastRow.section === 'Sub-section gate')
    ok('Feedback #3d — Section order: Behavior driver → Role default → Sub-section gate');
  else bad('Feedback #3d', `first=${firstRow.section}, last=${lastRow.section}`);
  // Behavior driver rows match the canonical behavior flags
  const sellable = rows.find(r=>r.section==='Behavior driver' && r.key==='is_sellable=true');
  if (sellable && /Orders/.test(sellable.enables_en)) ok('Feedback #3e — is_sellable=true → enables Orders/Sales');
  else bad('Feedback #3e');
  // Role default reflects _ROLE_BEHAVIOR_DEFAULTS
  const fgDef = rows.find(r=>r.section==='Role default' && r.key==='FG');
  if (fgDef && /sellable \+ producable/.test(fgDef.enables_en)) ok('Feedback #3f — FG role default = sellable + producable');
  else bad('Feedback #3f', JSON.stringify(fgDef));
  const pkgDef = rows.find(r=>r.section==='Role default' && r.key==='PACKAGING');
  if (pkgDef && /consumable/.test(pkgDef.enables_en)) ok('Feedback #3g — PACKAGING role default = consumable');
  else bad('Feedback #3g', JSON.stringify(pkgDef));
})();

// ===== Feedback #4 — egg_content_type dropped from export; egg_input_type first =====
(function feedback4(){
  const exp = T13A2.SHEET1_EXPORT_COLUMNS;
  if (!exp) return bad('Feedback #4 SHEET1_EXPORT_COLUMNS missing');
  if (exp.includes('egg_content_type')) return bad('Feedback #4a — egg_content_type STILL in export columns', JSON.stringify(exp));
  ok('Feedback #4a — egg_content_type removed from Step 2 export columns');
  // egg_input_type comes FIRST in the egg group
  const idxIsEgg = exp.indexOf('is_egg');
  const idxEIT = exp.indexOf('egg_input_type');
  const idxEIM = exp.indexOf('egg_is_mixed');
  const idxPG = exp.indexOf('primary_grade');
  const idxSG = exp.indexOf('secondary_grade');
  const idxMP = exp.indexOf('min_primary');
  if (idxIsEgg < idxEIT && idxEIT < idxEIM && idxEIM < idxPG && idxPG < idxSG && idxSG < idxMP)
    ok('Feedback #4b — Egg fields in chronological order: is_egg → egg_input_type → egg_is_mixed → primary → secondary → min_primary');
  else bad('Feedback #4b', `is_egg=${idxIsEgg}, eit=${idxEIT}, eim=${idxEIM}, pg=${idxPG}, sg=${idxSG}, mp=${idxMP}`);
  // egg_content_type STILL in the wider import allowlist (SHEET1_COLUMNS)
  const all = T13A2.SHEET1_COLUMNS;
  if (all.includes('egg_content_type')) ok('Feedback #4c — egg_content_type STILL in wider import allowlist (old files re-parse)');
  else bad('Feedback #4c');
  // Old file with egg_content_type still parses
  const aoa = [
    ['sku','is_egg','egg_content_type','primary_grade'],
    ['EG1','true','GRADED_SINGLE','3']
  ];
  const parsed = T13A2.aoaToObjects(aoa);
  if (!parsed.ignored_columns.includes('egg_content_type')) ok('Feedback #4d — OLD file with egg_content_type: column NOT flagged as ignored');
  else bad('Feedback #4d', JSON.stringify(parsed.ignored_columns));
  // New file with egg_input_type only (no egg_content_type) parses
  const aoa2 = [
    ['sku','is_egg','egg_input_type','egg_is_mixed','primary_grade'],
    ['EG1','true','graded','false','3']
  ];
  const parsed2 = T13A2.aoaToObjects(aoa2);
  if (parsed2.ignored_columns.length === 0) ok('Feedback #4e — NEW clean file without egg_content_type: parses cleanly');
  else bad('Feedback #4e', JSON.stringify(parsed2.ignored_columns));
})();

// ===== Step 1 export columns unchanged =====
(function step1unchanged(){
  const exp = T13A1.SHEET1_EXPORT_COLUMNS;
  const expected = ['sku','name_th','name_en','item_role','item_type','customer_code','is_active','notes','base_unit','base_factor','pack_unit','base_per_pack','storage_unit','base_per_storage','selling_unit'];
  if (exp.length === expected.length && expected.every((c,i)=>exp[i]===c))
    ok('Step 1 export columns unchanged (15 clean columns)');
  else bad('Step 1 export columns', JSON.stringify(exp));
})();

// ===== Behavior_Function_Summary headers updated =====
(function headers(){
  const hdr = sandbox._t13a2b_BEHAVIOR_FN_HEADERS;
  const expected = ['section','key','label_th','label_en','enables_th','enables_en','notes_th','notes_en'];
  if (hdr.length === expected.length && expected.every((c,i)=>hdr[i]===c))
    ok('Headers: Behavior_Function_Summary uses new behavior-driven layout (section, key, ...)');
  else bad('Headers', JSON.stringify(hdr));
})();

// ===== Regression checks =====
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('Regression — BOM Bulk Upload still hidden (Task 13A-0B)'); else bad('13A-0B');
if (!/data-f="units\.has_consumable_unit"/.test(html)) ok('Regression — Supply Unit DOM fields still absent (Task 12B)'); else bad('12B');
if (/function _t12h_storedToUi/.test(html) && /function _t12h_shouldShowMixedFields/.test(html)) ok('Regression — Task 12H + fix-up helpers retained'); else bad('12H');
if (typeof sandbox.t13a1e_openRepairPreview === 'function') ok('Regression — Task 13A-1E repair tool retained'); else bad('13A-1E');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
