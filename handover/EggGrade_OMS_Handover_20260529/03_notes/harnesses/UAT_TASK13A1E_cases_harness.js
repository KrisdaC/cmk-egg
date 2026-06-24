// Task 13A-1E acceptance harness — Cases A, B, C, D from the brief.
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
// Inject _ROLE_BEHAVIOR_DEFAULTS so the module's typeof check sees it
// (the in-app const in block 1 is wrapped in a per-block try, so it doesn't
// leak out of that try block in the sandbox).
sandbox._ROLE_BEHAVIOR_DEFAULTS = {
  FG:         { sellable: true,  producable: true,  consumable: false },
  WIP:        { sellable: false, producable: true,  consumable: false },
  RM:         { sellable: false, producable: false, consumable: true  },
  PACKAGING:  { sellable: false, producable: false, consumable: true  },
  SUPPLY:     { sellable: false, producable: false, consumable: true  },
  DEFECT:     { sellable: true,  producable: false, consumable: false },
};
sandbox.window=sandbox; sandbox.globalThis=sandbox; vm.createContext(sandbox);
// Per-block runInContext so top-level `const _ROLE_BEHAVIOR_DEFAULTS` shares
// the lexical script realm — same as a real browser tab.
let merged = '';
for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });
const T13A1=sandbox.T13A1; if(!T13A1){console.error('T13A1 missing'); process.exit(1);}

// Build a small synthetic MASTER_V3 with the four cases.
sandbox.MASTER_V3 = {
  customers: [], sites: [],
  items: [
    // Case A — Existing wrong PACKAGING item
    { id:1, sku:'A1MKO4P410', name:'wrong PACKAGING', item_role:'PACKAGING',
      is_sellable:true, is_producable:false, is_consumable:false,
      bom:{components:[{component_role:'tray', qty_per_basis:1}]},
      basket_profile:{has_basket:true, basket_sku:'B0001'},
      egg_profile:{primary_grade:'3'},
      packaging_profile:{uses_base_pack:true},
      external_refs:{foo:'bar'},
      units:{base_unit:'ใบ', pack_unit:'ห่อ', base_per_pack:100} },
    // Case B — Existing correct PACKAGING item
    { id:2, sku:'PKG_OK', name:'correct PACKAGING', item_role:'PACKAGING',
      is_sellable:false, is_producable:false, is_consumable:true,
      units:{base_unit:'ใบ'} },
    // Case C — Existing FG item with wrong behavior
    { id:3, sku:'FG_BAD', name:'wrong FG', item_role:'FG',
      is_sellable:false, is_producable:false, is_consumable:true,
      units:{base_unit:'ฟอง'} },
    // Case D — Unknown role
    { id:4, sku:'X1', name:'unknown role', item_role:'XYZ',
      is_sellable:true, is_producable:true, is_consumable:true,
      units:{base_unit:'ใบ'} },
  ],
  option_sets:{ item_role:[{code:'FG',is_active:true},{code:'PACKAGING',is_active:true},{code:'RM',is_active:true},{code:'WIP',is_active:true},{code:'SUPPLY',is_active:true},{code:'DEFECT',is_active:true}], unit:[{code:'ใบ',is_active:true},{code:'ฟอง',is_active:true},{code:'ห่อ',is_active:true}] },
  meta:{ version:3, updated:Date.now() },
};
sandbox.persistMasterV3 = function(){ return { ok:true }; };

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// === Preview correctness ===
const preview = T13A1.previewRepair();
console.log('Preview:', JSON.stringify({total:preview.total, already_correct:preview.already_correct, to_repair_count:preview.to_repair.length, unknown_count:preview.unknown_role.length}));
if (preview.total === 4) ok('total === 4');
else bad('preview.total', preview.total);
if (preview.already_correct === 1) ok('already_correct === 1 (PKG_OK)');
else bad('preview.already_correct', preview.already_correct);
if (preview.to_repair.length === 2) ok('to_repair.length === 2 (A + C)');
else bad('to_repair.length', preview.to_repair.length);
if (preview.unknown_role.length === 1) ok('unknown_role === 1 (X1)');
else bad('unknown_role.length', preview.unknown_role.length);

// === Case A — wrong PACKAGING item ===
const A_preview = preview.to_repair.find(r=>r.sku==='A1MKO4P410');
if (A_preview && A_preview.expected_is_sellable === false && A_preview.expected_is_producable === false && A_preview.expected_is_consumable === true)
  ok('Case A — A1MKO4P410 preview: PACKAGING expected (false/false/true)');
else bad('Case A preview', JSON.stringify(A_preview));

// === Case B — correct PACKAGING item ===
const B_in_repair = preview.to_repair.find(r=>r.sku==='PKG_OK');
if (!B_in_repair) ok('Case B — PKG_OK NOT in to_repair (already correct)');
else bad('Case B', 'unexpectedly in to_repair');

// === Case C — FG wrong behavior ===
const C_preview = preview.to_repair.find(r=>r.sku==='FG_BAD');
if (C_preview && C_preview.expected_is_sellable === true && C_preview.expected_is_producable === true && C_preview.expected_is_consumable === false)
  ok('Case C — FG_BAD preview: FG expected (true/true/false)');
else bad('Case C preview', JSON.stringify(C_preview));

// === Case D — unknown role ===
const D_in_unknown = preview.unknown_role.find(r=>r.sku==='X1');
if (D_in_unknown) ok('Case D — X1 listed as unknown_role (skipped)');
else bad('Case D — X1 not skipped');

// === Apply repair ===
const snapshotBefore = JSON.parse(JSON.stringify(sandbox.MASTER_V3.items));
const result = T13A1.repair();
console.log('Repair result:', JSON.stringify(result));
if (result.ok && result.repaired === 2 && result.unknown_role === 1 && result.already_correct === 1)
  ok('repair() returned correct counts');
else bad('repair() counts', JSON.stringify(result));

// === Post-repair item state ===
const a_after = sandbox.MASTER_V3.items.find(it=>it.sku==='A1MKO4P410');
if (a_after.is_sellable===false && a_after.is_producable===false && a_after.is_consumable===true)
  ok('Case A POST: A1MKO4P410 fixed to PACKAGING flags (false/false/true)');
else bad('Case A POST', JSON.stringify({s:a_after.is_sellable,p:a_after.is_producable,c:a_after.is_consumable}));

const c_after = sandbox.MASTER_V3.items.find(it=>it.sku==='FG_BAD');
if (c_after.is_sellable===true && c_after.is_producable===true && c_after.is_consumable===false)
  ok('Case C POST: FG_BAD fixed to FG flags (true/true/false)');
else bad('Case C POST', JSON.stringify({s:c_after.is_sellable,p:c_after.is_producable,c:c_after.is_consumable}));

const d_after = sandbox.MASTER_V3.items.find(it=>it.sku==='X1');
const d_before = snapshotBefore.find(it=>it.sku==='X1');
if (d_after.is_sellable===d_before.is_sellable && d_after.is_producable===d_before.is_producable && d_after.is_consumable===d_before.is_consumable)
  ok('Case D POST: X1 behavior flags UNCHANGED (unknown role left alone)');
else bad('Case D POST', JSON.stringify(d_after));

// === Out-of-scope preservation (Case A) ===
const a_before = snapshotBefore.find(it=>it.sku==='A1MKO4P410');
const fields=['bom','basket_profile','egg_profile','packaging_profile','external_refs','units'];
let preserved=true;
fields.forEach(k=>{ if (JSON.stringify(a_before[k]||null) !== JSON.stringify(a_after[k]||null)) preserved=false; });
if (preserved) ok('Case A POST: out-of-scope sections (bom / basket / egg / packaging / external_refs / units) preserved');
else bad('Case A POST', 'out-of-scope mutation');

// === Re-preview shows nothing to repair ===
const preview2 = T13A1.previewRepair();
if (preview2.to_repair.length === 0 && preview2.already_correct === 3 && preview2.unknown_role.length === 1)
  ok('Re-preview after repair: 0 to_repair, 3 already_correct, 1 unknown_role');
else bad('Re-preview', JSON.stringify({rep:preview2.to_repair.length,ac:preview2.already_correct,uk:preview2.unknown_role.length}));

// === Future import path: applyRoleBehavior helper test ===
const synth = { sku:'NEW_PKG', item_role:'PACKAGING', is_sellable:true, is_producable:false, is_consumable:false };
const r = T13A1.applyRoleBehavior(synth);
if (r.changed && synth.is_sellable===false && synth.is_consumable===true)
  ok('applyRoleBehavior() helper: PACKAGING-fresh item gets flags applied');
else bad('applyRoleBehavior synth', JSON.stringify({r:r,synth:synth}));

// === Regression — 13A-1B / 13A-1C / 13A-1D ===
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('Task 13A-0B regression — BOM Bulk Upload still hidden');
else bad('Task 13A-0B regression');
const supplyActive = /data-f="units\.has_consumable_unit"|data-f="units\.consumable_unit"|data-f="units\.base_per_consumable"/.test(html);
if (!supplyActive) ok('Task 12B regression — Supply Unit DOM fields still absent');
else bad('Task 12B regression');
if (/UAT Pro · Task 13A-1D · 2026-05-28 — closes UAT-019/.test(html)) ok('Task 13A-1D regression — unit scanner fix retained');
else bad('Task 13A-1D regression');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
