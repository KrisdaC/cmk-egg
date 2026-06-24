// Dry-run the user's new upload.xlsx through the Task 13A-1 + 13A-1A + 13A-1B
// importer, including the basket-selling-unit merge fix.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const ROOT = '/sessions/tender-eager-knuth/mnt/uat-handover';
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const SCRIPT_RE = /<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks = []; let m;
while ((m = SCRIPT_RE.exec(html)) !== null) {
  const a = m.groups.attrs || '';
  if (a.includes('application/octet-stream')) continue;
  if (a.includes('src=') && a.includes('http')) continue;
  blocks.push(m.groups.body);
}
const sandbox = {
  console, setTimeout, clearTimeout,
  document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},
  window:undefined,navigator:{language:'th-TH',userAgent:'node'},location:{hash:'',search:'',pathname:'/',href:'file:///'},
  localStorage:(function(){const s={};return{getItem:k=>(k in s?s[k]:null),setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),
  XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function Blob(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function File(){},FileReader:function FileReader(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},
  matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){},
};
sandbox.window=sandbox; sandbox.globalThis=sandbox; vm.createContext(sandbox);
for (const b of blocks) { try { vm.runInContext(b, sandbox, { timeout:10000 }); } catch(e){} }
const T13A1 = sandbox.T13A1; if (!T13A1) { console.error('FAIL: T13A1 missing'); process.exit(1); }
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'demand_master_v3.json'),'utf8'));
sandbox.MASTER_V3 = { customers:(seed.customers||[]).slice(), sites:(seed.sites||[]).slice(), items:(seed.items||[]).slice(), option_sets:seed.option_sets||{}, meta:seed.meta||{version:3,updated:Date.now()} };
sandbox.persistMasterV3 = function(){ return { ok:true }; };

const envelope = JSON.parse(fs.readFileSync('/sessions/tender-eager-knuth/mnt/outputs/upload_envelope_b.json','utf8'));
const parsed = T13A1.parseJsonImport(JSON.stringify(envelope));
console.log('=== Parse result (new upload.xlsx) ===');
console.log('  detected_sheets:', parsed.detected_sheets);
console.log('  used_sheet:     ', parsed.used_sheet);
console.log('  ignored_sheets: ', parsed.ignored_sheets);
console.log('  sheet_name_mismatch:', parsed.sheet_name_mismatch);
console.log('  rows.length:    ', parsed.rows.length);

const v = T13A1.validateImportRows(parsed.rows);
console.log('\n=== Validation summary (with merged-units fix) ===');
console.log(JSON.stringify(v.summary, null, 2));

// Specifically look at B0001-B0013 rows
console.log('\n=== B0001–B0017 rows (basket selling_unit case) ===');
const bRows = v.rows.filter(r => /^B00\d\d$/.test(r.sku));
bRows.forEach(r => {
  const errs = (r._errors||[]).map(e => e.field+':'+e.msg.split('·')[0].trim()).join('; ');
  const warns = (r._warnings||[]).filter(w => w.field === 'selling_unit').map(w => w.msg.split('·')[0].trim()).join('; ');
  console.log(`  ${r.sku}  action=${r._action}  errors=[${errs}]  selling_unit_warn=[${warns}]`);
});

// Error breakdown
const errorRows = v.rows.filter(r => (r._errors||[]).length);
const errKindCounts = {};
errorRows.forEach(r => r._errors.forEach(e => { errKindCounts[e.field] = (errKindCounts[e.field] || 0) + 1; }));
console.log('\nRows with blocking errors:', errorRows.length);
console.log('Error breakdown by field:', errKindCounts);

// Assertions
let pass = 0, fail = 0;
function ok(L){ pass++; console.log('PASS · '+L); }
function bad(L,d){ fail++; console.log('FAIL · '+L+' :: '+(d||'')); }

if (parsed.sheet_name_mismatch === true && parsed.used_sheet === 'Sheet1') ok('A0 — fallback path triggered (workbook renamed to Sheet1)');
else bad('A0', JSON.stringify({m:parsed.sheet_name_mismatch, u:parsed.used_sheet}));

if (parsed.rows.length === 202) ok('A1 — 202 data rows parsed');
else bad('A1', 'rows.length='+parsed.rows.length);

// Critical: B0001-B0013 must no longer have selling_unit blocking errors.
const bRowsBlocked = bRows.filter(r => (r._errors||[]).some(e => e.field === 'selling_unit'));
if (bRowsBlocked.length === 0) ok(`A2 — Basket SKUs (B0001..) no longer blocked on selling_unit (was 17, now ${bRowsBlocked.length})`);
else bad('A2', `still blocked: ${bRowsBlocked.map(r=>r.sku).join(',')}`);

// Selling_unit error count should be much lower
if ((errKindCounts.selling_unit || 0) <= 5) ok(`A3 — selling_unit errors dropped to ${errKindCounts.selling_unit || 0} (was 18)`);
else bad('A3', 'selling_unit errors still ' + errKindCounts.selling_unit);

// Total blocking errors should drop
if (v.summary.blocking_errors < 139) ok(`A4 — total blocking errors reduced from 139 to ${v.summary.blocking_errors}`);
else bad('A4', 'blocking_errors='+v.summary.blocking_errors);

// to_update should reflect that 125 SKUs match
if (v.summary.to_update === 125 && v.summary.to_create === 77) ok('A5 — split: create=77, update=125 (matches Python cross-check)');
else bad('A5', JSON.stringify(v.summary));

// Sanity: non-basket selling_unit blocking should still trigger
const nonBasketBad = v.rows.find(r => {
  return (r._errors||[]).some(e => e.field === 'selling_unit');
});
if (nonBasketBad) {
  const isBasket = /^(ตะกร้า|ตระกร้า|basket)$/i.test(String(nonBasketBad.selling_unit||'').trim());
  if (!isBasket) ok('A6 — non-basket unresolvable selling_unit still blocks (e.g. ' + nonBasketBad.sku + ')');
  else bad('A6', 'basket-named selling_unit is wrongly blocking ' + nonBasketBad.sku);
} else {
  ok('A6 — no remaining selling_unit blocking errors (vacuously true)');
}

// Static regressions
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('A7 — BOM Bulk Upload still hidden (Task 13A-0B)');
else bad('A7');
const supplyActive = /data-f="units\.has_consumable_unit"|data-f="units\.consumable_unit"|data-f="units\.base_per_consumable"/.test(html);
if (!supplyActive) ok('A8 — Supply Unit DOM fields still absent (Task 12B)');
else bad('A8');

// Verify a B0001-style row has the new warning instead of error
const b0001 = v.rows.find(r => r.sku === 'B0001');
if (b0001) {
  const errSu = (b0001._errors||[]).some(e => e.field === 'selling_unit');
  const warnSu = (b0001._warnings||[]).some(w => w.field === 'selling_unit' && /basket/i.test(w.msg));
  if (!errSu && warnSu) ok('A9 — B0001 selling_unit downgraded to warning ("basket preserved")');
  else if (!errSu && !warnSu) ok('A9 — B0001 selling_unit resolved cleanly (no error, no warning needed)');
  else bad('A9', `errSu=${errSu} warnSu=${warnSu}`);
}

// Verify B0001 with existing basket resolves via mergedUnits
const existing = sandbox.MASTER_V3.items.find(it => it && it.sku === 'B0001');
if (existing && existing.units && existing.units.base_per_basket > 0) {
  // Re-validate the B0001 row via the helper directly
  const tmp = { selling_unit:'ตะกร้า', units:JSON.parse(JSON.stringify(existing.units)) };
  if (typeof sandbox.getSellingUnitBaseFactor === 'function') {
    const f = sandbox.getSellingUnitBaseFactor(tmp);
    if (f != null) ok('A10 — getSellingUnitBaseFactor against merged units returns ' + f + ' (basket conv works)');
    else bad('A10', 'still null');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
