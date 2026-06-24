// Task 12H acceptance harness — legacy mapping + save round-trip +
// 13A-2 cohesion (egg_input_type / egg_is_mixed friendly columns).
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH',userAgent:'node'},location:{hash:'',search:'',pathname:'/',href:'file:///'},localStorage:(function(){const s={};return{getItem:k=>(k in s?s[k]:null),setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function Blob(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function File(){},FileReader:function FileReader(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, WIP:{sellable:false,producable:true,consumable:false}, RM:{sellable:false,producable:false,consumable:true}, PACKAGING:{sellable:false,producable:false,consumable:true}, SUPPLY:{sellable:false,producable:false,consumable:true}, DEFECT:{sellable:true,producable:false,consumable:false} };
vm.createContext(sandbox);
let merged='';
for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });
sandbox.getOptionSet = function(setKey){ return (((sandbox.MASTER_V3||{}).option_sets||{})[setKey]||[]).slice(); };
sandbox._bomBasketCandidateItems = function(){ const all=((sandbox.MASTER_V3||{}).items||[]); return all.filter(x=>x&&String(x.item_role||'').toUpperCase()==='PACKAGING'&&String(x.item_type||'').toLowerCase()==='basket'); };
sandbox._bomBasketComponents = function(it){ return ((it&&it.bom&&it.bom.components)||[]).filter(c=>c&&c.component_role==='basket'); };
sandbox._bomBasketProfileStatus = function(){ return {ok:true,msg:''}; };
sandbox._bomResolveBasketUnit = function(sku,fb){ return fb; };
sandbox.calculateBasketRequirementFromItem = function(it,q){ const bpb=Number(((it&&it.units)||{}).base_per_basket||0); return bpb>0?[{required_qty:Number(q||0)/bpb}]:[]; };
sandbox.normalizeItemUnits = function(it){ const u=(it&&it.units)||{}; return { base_unit:u.base_unit||'', pack_unit:u.pack_unit||'', base_per_pack:u.base_per_pack==null?null:Number(u.base_per_pack), has_basket_unit:u.has_basket_unit===true||(u.has_basket_unit==null&&Number(u.base_per_basket||0)>0), basket_unit:u.basket_unit||'ตะกร้า', base_per_basket:u.base_per_basket==null?null:Number(u.base_per_basket), storage_unit:u.storage_unit||'', base_per_storage:u.base_per_storage==null?null:Number(u.base_per_storage), has_consumable_unit:u.has_consumable_unit===true, consumable_unit:u.consumable_unit||'', base_per_consumable:u.base_per_consumable==null?null:Number(u.base_per_consumable) }; };

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// Sanity — Task 12H helpers exist
const storedToUi = sandbox._t12h_storedToUi;
const uiToStored = sandbox._t12h_uiToStored;
if (typeof storedToUi !== 'function') return bad('_t12h_storedToUi not exposed');
if (typeof uiToStored !== 'function') return bad('_t12h_uiToStored not exposed');

// ===== Load mapping (legacy → UI) =====
(function load1(){ const u=storedToUi('UNGRADED_EGG'); if (u.type==='raw' && u.mixed===false) ok('Load: UNGRADED_EGG → Raw / Mixed=false'); else bad('Load UNGRADED_EGG', JSON.stringify(u)); })();
(function load2(){ const u=storedToUi('UNDERGRADE');   if (u.type==='under' && u.mixed===false) ok('Load: UNDERGRADE → Under-grade / Mixed=false'); else bad('Load UNDERGRADE', JSON.stringify(u)); })();
(function load3(){ const u=storedToUi('GRADED_SINGLE'); if (u.type==='graded' && u.mixed===false) ok('Load: GRADED_SINGLE → Graded / Mixed=false'); else bad('Load GRADED_SINGLE', JSON.stringify(u)); })();
(function load4(){ const u=storedToUi('GRADED_MIX');    if (u.type==='graded' && u.mixed===true) ok('Load: GRADED_MIX → Graded / Mixed=true'); else bad('Load GRADED_MIX', JSON.stringify(u)); })();
(function load5(){ const u=storedToUi('GRADED_MIXED_ADJACENT'); if (u.type==='graded' && u.mixed===true) ok('Load: GRADED_MIXED_ADJACENT (legacy alt) → Graded / Mixed=true'); else bad('Load GRADED_MIXED_ADJACENT', JSON.stringify(u)); })();
(function load6(){ const u=storedToUi('SOMETHING_LEGACY'); if (u.type==='' && u.mixed===false && u.known===false) ok('Load: unknown legacy → blank UI + known=false'); else bad('Load unknown', JSON.stringify(u)); })();
(function load7(){ const u=storedToUi(''); if (u.type==='' && u.mixed===false && u.known===true) ok('Load: empty string → blank / Mixed=false / known=true'); else bad('Load empty', JSON.stringify(u)); })();
(function load8(){ const u=storedToUi(null); if (u.type==='' && u.known===true) ok('Load: null → blank / known=true'); else bad('Load null', JSON.stringify(u)); })();

// ===== Save mapping (UI → canonical) =====
if (uiToStored('raw',   false) === 'UNGRADED_EGG')  ok('Save: raw  → UNGRADED_EGG'); else bad('Save raw');
if (uiToStored('raw',   true)  === 'UNGRADED_EGG')  ok('Save: raw + mixed=true (ignored) → UNGRADED_EGG'); else bad('Save raw + mixed');
if (uiToStored('under', false) === 'UNDERGRADE')    ok('Save: under → UNDERGRADE'); else bad('Save under');
if (uiToStored('graded',false) === 'GRADED_SINGLE') ok('Save: graded + mixed=false → GRADED_SINGLE'); else bad('Save graded single');
if (uiToStored('graded',true)  === 'GRADED_MIX')    ok('Save: graded + mixed=true  → GRADED_MIX'); else bad('Save graded mixed');
if (uiToStored('',      false) === '')              ok('Save: blank → blank'); else bad('Save blank');

// ===== Calc engine parity: ensure splitBaseEggsByGrade output unchanged =====
const split = sandbox.splitBaseEggsByGrade;
if (typeof split === 'function') {
  // single (UNGRADED_EGG)
  const r1 = split({ is_egg:true, egg_content_type:'UNGRADED_EGG', primary_grade:'3' }, 100);
  if (r1.output_egg_targets[0].target_type === 'single' && r1.source_egg_requirements.length === 1)
    ok('Calc: UNGRADED_EGG single-target/single-source unchanged');
  else bad('Calc UNGRADED_EGG');
  // single (GRADED_SINGLE)
  const r2 = split({ is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3' }, 100);
  if (r2.output_egg_targets[0].target_type === 'single' && r2.source_egg_requirements.length === 1)
    ok('Calc: GRADED_SINGLE one egg requirement line');
  else bad('Calc GRADED_SINGLE');
  // mixed
  const r3 = split({ is_egg:true, egg_content_type:'GRADED_MIX', primary_grade:'2', secondary_grade:'3', min_primary:40 }, 100);
  if (r3.output_egg_targets[0].target_type === 'mixed' && r3.source_egg_requirements.length === 2)
    ok('Calc: GRADED_MIX → mixed target + 2 source lines (primary min + secondary balance)');
  else bad('Calc GRADED_MIX', JSON.stringify(r3));
} else bad('splitBaseEggsByGrade not exposed');

// ===== Task 13A-2 cohesion: friendly columns in export + import =====
const T13A2 = sandbox.T13A2;
if (!T13A2) bad('T13A2 missing'); else {
  // Set up MASTER_V3 with existing items spanning legacy codes
  sandbox.MASTER_V3 = {
    customers: [], sites: [], items: [
      { id:1, sku:'EG_RAW',   item_role:'RM', is_active:true, units:{base_unit:'ฟอง'}, is_egg:true, egg_content_type:'UNGRADED_EGG' },
      { id:2, sku:'EG_UNDER', item_role:'DEFECT', is_active:true, units:{base_unit:'ฟอง'}, is_egg:true, egg_content_type:'UNDERGRADE' },
      { id:3, sku:'EG_SING',  item_role:'FG', is_active:true, units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10}, selling_unit:'แพ็ค 10', is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'3', bom:{components:[],routes:[]} },
      { id:4, sku:'EG_MIX',   item_role:'FG', is_active:true, units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10}, selling_unit:'แพ็ค 10', is_egg:true, egg_content_type:'GRADED_MIX', primary_grade:'2', secondary_grade:'3', min_primary:40, bom:{components:[],routes:[]} },
      { id:5, sku:'EG_LEGACY',item_role:'FG', is_active:true, units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10}, selling_unit:'แพ็ค 10', is_egg:true, egg_content_type:'GRADED_MIXED_ADJACENT', primary_grade:'2', secondary_grade:'3', min_primary:35, bom:{components:[],routes:[]} },
    ],
    option_sets:{
      egg_content_type:[{code:'UNGRADED_EGG',is_active:true},{code:'UNDERGRADE',is_active:true},{code:'GRADED_SINGLE',is_active:true},{code:'GRADED_MIX',is_active:true}],
      egg_grade:[{code:'0',is_active:true},{code:'1',is_active:true},{code:'2',is_active:true},{code:'3',is_active:true},{code:'4',is_active:true},{code:'5',is_active:true},{code:'6',is_active:true}],
      item_role:[{code:'FG',is_active:true},{code:'RM',is_active:true},{code:'DEFECT',is_active:true}]
    }, meta:{} };
  sandbox.persistMasterV3 = function(){return{ok:true};};

  // Export-side: friendly columns populated correctly
  const rows = sandbox.MASTER_V3.items.map(T13A2.deriveRow);
  const r_raw = rows.find(r=>r.sku==='EG_RAW');
  const r_und = rows.find(r=>r.sku==='EG_UNDER');
  const r_sin = rows.find(r=>r.sku==='EG_SING');
  const r_mix = rows.find(r=>r.sku==='EG_MIX');
  const r_leg = rows.find(r=>r.sku==='EG_LEGACY');
  if (r_raw.egg_input_type==='raw'    && r_raw.egg_is_mixed===false) ok('13A-2 export: UNGRADED_EGG → egg_input_type=raw / mixed=false'); else bad('export raw', JSON.stringify(r_raw));
  if (r_und.egg_input_type==='under'  && r_und.egg_is_mixed===false) ok('13A-2 export: UNDERGRADE → under / mixed=false'); else bad('export under', JSON.stringify(r_und));
  if (r_sin.egg_input_type==='graded' && r_sin.egg_is_mixed===false) ok('13A-2 export: GRADED_SINGLE → graded / mixed=false'); else bad('export single', JSON.stringify(r_sin));
  if (r_mix.egg_input_type==='graded' && r_mix.egg_is_mixed===true)  ok('13A-2 export: GRADED_MIX → graded / mixed=true'); else bad('export mix', JSON.stringify(r_mix));
  if (r_leg.egg_input_type==='graded' && r_leg.egg_is_mixed===true)  ok('13A-2 export: GRADED_MIXED_ADJACENT → graded / mixed=true'); else bad('export legacy', JSON.stringify(r_leg));

  // Import-side: writing friendly columns produces canonical egg_content_type
  const row = { sku:'EG_RAW', egg_input_type:'graded', egg_is_mixed:true, primary_grade:'2', secondary_grade:'3', min_primary:40 };
  const v = T13A2.validateImportRows([row]);
  if (v.summary.blocking_errors===0 && v.rows[0].egg_content_type==='GRADED_MIX')
    ok('13A-2 import: egg_input_type=graded + egg_is_mixed=true ⇒ egg_content_type=GRADED_MIX');
  else bad('import friendly→canonical', JSON.stringify(v.rows[0]));

  const row2 = { sku:'EG_MIX', egg_input_type:'raw' };
  const v2 = T13A2.validateImportRows([row2]);
  if (v2.summary.blocking_errors===0 && v2.rows[0].egg_content_type==='UNGRADED_EGG')
    ok('13A-2 import: egg_input_type=raw ⇒ egg_content_type=UNGRADED_EGG (overrides existing)');
  else bad('import raw friendly', JSON.stringify(v2.rows[0]));

  // Friendly columns NOT in ignored_columns (allowlisted)
  const aoa = [
    ['sku','egg_input_type','egg_is_mixed','primary_grade','secondary_grade','min_primary'],
    ['EG_SING','graded','true','2','3','45']
  ];
  const parsed = T13A2.aoaToObjects(aoa);
  if (!parsed.ignored_columns.includes('egg_input_type') && !parsed.ignored_columns.includes('egg_is_mixed'))
    ok('13A-2 import: friendly columns in allowlist (not ignored)');
  else bad('friendly cols ignored', JSON.stringify(parsed.ignored_columns));

  // Round-trip: re-importing a freshly-exported file should still be 0-blocking
  const v3 = T13A2.validateImportRows(rows.map(r=>Object.assign({},r)));
  if (v3.summary.blocking_errors === 0)
    ok('13A-2 round-trip: re-importing exported rows = 0 blocking errors');
  else bad('round-trip', JSON.stringify(v3.summary));
}

// ===== Regression checks =====
const hasNewRenderer = /UAT Pro · Task 12H · 2026-05-28 — operator-friendly UI/.test(html);
if (hasNewRenderer) ok('Regression: Task 12H renderer marker present');
else bad('Task 12H marker missing');
const hasNewHelpers = /function _t12h_storedToUi/.test(html) && /function _t12h_uiToStored/.test(html);
if (hasNewHelpers) ok('Regression: _t12h_storedToUi + _t12h_uiToStored functions present');
else bad('Helpers not present');
// Old visible egg_content_type dropdown gone (the data-f is now on a hidden input)
const hasOldDropdown = /renderOptionSelect\('egg_content_type'/.test(html);
if (!hasOldDropdown) ok('Regression: old renderOptionSelect("egg_content_type") dropdown removed from Item editor');
else bad('Old egg_content_type dropdown still in DOM');
// Hidden data-f="egg_content_type" still present (so _readEditForm picks it up)
const hasHidden = /<input type="hidden" id="t12hEggContentTypeHidden" data-f="egg_content_type"/.test(html);
if (hasHidden) ok('Regression: hidden data-f="egg_content_type" present (form-save unchanged)');
else bad('Hidden egg_content_type missing');

// Other regressions
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('Task 13A-0B regression — BOM Bulk Upload still hidden');
else bad('Task 13A-0B regression');
if (!/data-f="units\.has_consumable_unit"/.test(html)) ok('Task 12B regression — Supply Unit DOM fields still absent');
else bad('Task 12B regression');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
