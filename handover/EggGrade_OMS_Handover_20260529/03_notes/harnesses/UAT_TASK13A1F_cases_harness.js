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
    { id:1, sku:'C19999P301', item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:100}, selling_unit:'แพ็ค' },
    { id:2, sku:'C19999P302', item_role:'PACKAGING', item_type:'tray', is_active:true, units:{base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:110}, selling_unit:'แพ็ค' },
    { id:3, sku:'C29999P301', item_role:'PACKAGING', item_type:'cover', is_active:true, units:{base_unit:'ฝา', pack_unit:'ห่อ', base_per_pack:200}, selling_unit:'แพ็ค' },
    { id:4, sku:'C29999P302', item_role:'PACKAGING', item_type:'cover', is_active:true, units:{base_unit:'ฝา', pack_unit:'ห่อ', base_per_pack:200}, selling_unit:'แพ็ค' },
    { id:10,sku:'FG_BAD_SU', item_role:'FG',        item_type:'packed_egg', is_active:true, units:{base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10}, selling_unit:'แพ็ค 10' },
    { id:11,sku:'RM_OK',     item_role:'RM',        item_type:'raw_egg',    is_active:true, units:{base_unit:'ฟอง'}, selling_unit:'ฟอง' },
  ],
  option_sets:{
    item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true},{code:'RM',is_active:true},{code:'WIP',is_active:true},{code:'SUPPLY',is_active:true},{code:'DEFECT',is_active:true}],
    unit:[{code:'ฟอง',is_active:true},{code:'ใบ',is_active:true},{code:'ฝา',is_active:true},{code:'ห่อ',is_active:true},{code:'แพ็ค 10',is_active:true},{code:'แพ็ค',is_active:true}]
  }, meta:{}
};
sandbox.persistMasterV3 = function(){return{ok:true};};
sandbox.getOptionSet = function(setKey){ return (((sandbox.MASTER_V3||{}).option_sets||{})[setKey]||[]).slice(); };
sandbox.normalizeItemUnits = function(it){const u=(it&&it.units)||{};return{base_unit:u.base_unit||'',pack_unit:u.pack_unit||'',base_per_pack:u.base_per_pack==null?null:Number(u.base_per_pack),has_basket_unit:u.has_basket_unit===true||(u.has_basket_unit==null&&Number(u.base_per_basket||0)>0),basket_unit:u.basket_unit||'ตะกร้า',base_per_basket:u.base_per_basket==null?null:Number(u.base_per_basket),storage_unit:u.storage_unit||'',base_per_storage:u.base_per_storage==null?null:Number(u.base_per_storage)};};
sandbox.getSellingUnitBaseFactor = function(it){const su=String((it&&it.selling_unit)||'').trim();if(!su)return null;const u=sandbox.normalizeItemUnits(it);if(su===u.base_unit)return 1;if(u.pack_unit&&su===u.pack_unit&&u.base_per_pack>0)return u.base_per_pack;if(u.has_basket_unit&&u.basket_unit&&su===u.basket_unit&&u.base_per_basket>0)return u.base_per_basket;return null;};
sandbox.getItemTypeOptionsForRole = function(role){const M={FG:[['packed_egg','','']],PACKAGING:[['tray','',''],['cover','','']],RM:[['raw_egg','','']]};return (M[String(role||'').toUpperCase()]||[]).slice();};
const T13A1 = sandbox.T13A1;

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// Case 1 — PACKAGING with unresolvable selling_unit → warning, not blocking
(function c1(){
  const rows = [
    { sku:'C19999P301', name_th:'tray small', item_role:'PACKAGING', item_type:'tray', base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:100, selling_unit:'แพ็ค' }
  ];
  const v = T13A1.validateImportRows(rows);
  const r = v.rows[0];
  if ((r._errors||[]).some(e=>e.field==='selling_unit'))
    return bad('Case 1 — PACKAGING blocking on selling_unit (should be warning)');
  if (!(r._warnings||[]).some(w=>w.field==='selling_unit' && /non-sellable role/.test(w.msg)))
    return bad('Case 1 — PACKAGING missing warning', JSON.stringify(r._warnings));
  ok('Case 1 — PACKAGING with unresolvable selling_unit: warning only, NOT blocking');
})();

// Case 2 — FG with unresolvable selling_unit → still blocks
(function c2(){
  const rows = [
    { sku:'FG_BAD_SU', item_role:'FG', selling_unit:'NOT_A_UNIT' }
  ];
  const v = T13A1.validateImportRows(rows);
  const r = v.rows[0];
  if ((r._errors||[]).some(e=>e.field==='selling_unit'))
    ok('Case 2 — FG with unresolvable selling_unit: still BLOCKING');
  else bad('Case 2', JSON.stringify(r._errors));
})();

// Case 3 — RM with unresolvable selling_unit → warning, not blocking
(function c3(){
  const rows = [
    { sku:'RM_OK', item_role:'RM', selling_unit:'NOT_A_UNIT' }
  ];
  const v = T13A1.validateImportRows(rows);
  const r = v.rows[0];
  if (!(r._errors||[]).some(e=>e.field==='selling_unit'))
    ok('Case 3 — RM with unresolvable selling_unit: NOT blocking');
  else bad('Case 3', JSON.stringify(r._errors));
})();

// Case 4 — action column shows 'error' for rows with errors (was 'unchanged')
(function c4(){
  // FG with bad selling_unit, otherwise matches existing
  const rows = [{ sku:'FG_BAD_SU', name_th:'fg', item_role:'FG', item_type:'packed_egg', base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:10, selling_unit:'NOT_A_UNIT' }];
  const v = T13A1.validateImportRows(rows);
  if (v.rows[0]._action === 'error')
    ok('Case 4 — Action column shows "error" for FG row with blocking error');
  else bad('Case 4', 'action='+v.rows[0]._action);
})();

// Case 5 — PACKAGING with 'แพ็ค' unchanged → action becomes 'unchanged' (no errors now)
(function c5(){
  const rows = [{ sku:'C19999P301', name_th:'tray small', item_role:'PACKAGING', item_type:'tray', base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:100, selling_unit:'แพ็ค' }];
  const v = T13A1.validateImportRows(rows);
  if (v.summary.blocking_errors === 0 && (v.rows[0]._action === 'unchanged' || v.rows[0]._action === 'update'))
    ok('Case 5 — PACKAGING row with stable selling_unit: 0 blocking errors (action=' + v.rows[0]._action + ')');
  else bad('Case 5', JSON.stringify({action:v.rows[0]._action, blocking:v.summary.blocking_errors, errors:v.rows[0]._errors}));
})();

// Case 6 — Dry-run the actual uploaded file
(function c6(){
  const env = JSON.parse(fs.readFileSync('/sessions/tender-eager-knuth/mnt/outputs/upload_envelope_1347.json','utf8'));
  const parsed = T13A1.parseJsonImport(JSON.stringify(env));
  if (!parsed) return bad('Case 6 parse failed');
  const v = T13A1.validateImportRows(parsed.rows);
  // The 4 PACKAGING rows should be unchanged (or update) with NO selling_unit errors
  const targets = ['C19999P301','C19999P302','C29999P301','C29999P302'];
  const blocked = v.rows.filter(r => targets.includes(r.sku) && (r._errors||[]).some(e=>e.field==='selling_unit'));
  if (blocked.length === 0)
    ok('Case 6 — Uploaded file: 4 PACKAGING rows no longer blocked on selling_unit (was 4, now 0)');
  else bad('Case 6', 'still blocked: '+blocked.map(r=>r.sku).join(','));
  console.log('       Live summary:', JSON.stringify(v.summary));
})();

// Regression
if (typeof sandbox.t13a1e_openRepairPreview === 'function') ok('Regression — Task 13A-1E repair tool retained');
else bad('13A-1E');
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('Regression — BOM Bulk Upload still hidden'); else bad('13A-0B');
if (!/data-f="units\.has_consumable_unit"/.test(html)) ok('Regression — Supply Unit DOM fields absent'); else bad('12B');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
