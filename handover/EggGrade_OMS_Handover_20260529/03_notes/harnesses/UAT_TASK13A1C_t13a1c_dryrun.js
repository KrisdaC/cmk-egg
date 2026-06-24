const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH',userAgent:'node'},location:{hash:'',search:'',pathname:'/',href:'file:///'},localStorage:(function(){const s={};return{getItem:k=>(k in s?s[k]:null),setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function Blob(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function File(){},FileReader:function FileReader(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox; vm.createContext(sandbox);
for (const b of blocks) { try { vm.runInContext(b,sandbox,{timeout:10000}); } catch(e){} }
const T13A1=sandbox.T13A1; if(!T13A1){console.error('T13A1 missing'); process.exit(1);}
const seed=JSON.parse(fs.readFileSync(path.join(ROOT,'demand_master_v3.json'),'utf8'));
// Add the four PACKAGING items as if operator had already created them in a previous commit
// — that's why the screenshot shows action=update. Give them realistic existing selling_units
// that wouldn't match the new pack_unit=ห่อ, to reproduce the user's exact blocking scenario.
const liveItems = seed.items.slice();
liveItems.push({ id: 9001, sku:'C19999P301', name:'ถาดกระดาษ เล็ก', name_th:'ถาดกระดาษ เล็ก',
  item_role:'PACKAGING', item_type:'tray', is_active:true,
  selling_unit:'แพ็ค',  // a stale selling_unit that no longer matches the file's new pack_unit
  units:{ base_unit:'ใบ', pack_unit:'แพ็ค', base_per_pack:50 } });
liveItems.push({ id: 9002, sku:'C19999P302', name:'ถาดกระดาษ ใหญ่', name_th:'ถาดกระดาษ ใหญ่',
  item_role:'PACKAGING', item_type:'tray', is_active:true,
  selling_unit:'แพ็ค',
  units:{ base_unit:'ใบ', pack_unit:'แพ็ค', base_per_pack:50 } });
liveItems.push({ id: 9003, sku:'C29999P301', name:'ฝาครอบ 30 เล็ก', name_th:'ฝาครอบ 30 เล็ก',
  item_role:'PACKAGING', item_type:'cover', is_active:true,
  selling_unit:'แพ็ค',
  units:{ base_unit:'ฝา', pack_unit:'แพ็ค', base_per_pack:50 } });
liveItems.push({ id: 9004, sku:'C29999P302', name:'ฝาครอบ 30 ใหญ่', name_th:'ฝาครอบ 30 ใหญ่',
  item_role:'PACKAGING', item_type:'cover', is_active:true,
  selling_unit:'แพ็ค',
  units:{ base_unit:'ฝา', pack_unit:'แพ็ค', base_per_pack:50 } });
sandbox.MASTER_V3={customers:seed.customers.slice(),sites:seed.sites.slice(),items:liveItems,option_sets:seed.option_sets||{},meta:seed.meta||{version:3,updated:Date.now()}};
sandbox.persistMasterV3=function(){return{ok:true};};

const env=JSON.parse(fs.readFileSync('/sessions/tender-eager-knuth/mnt/outputs/upload_envelope_c.json','utf8'));
const parsed=T13A1.parseJsonImport(JSON.stringify(env));
const v=T13A1.validateImportRows(parsed.rows);

console.log('=== Validation summary (Task 13A-1C — blank cells = preserve, no validation) ===');
console.log(JSON.stringify(v.summary,null,2));

const errCounts={}; const errorRows=v.rows.filter(r=>(r._errors||[]).length);
errorRows.forEach(r=>r._errors.forEach(e=>{errCounts[e.field]=(errCounts[e.field]||0)+1;}));
console.log('\nRemaining error breakdown by field:', errCounts);
console.log('Rows with blocking errors:', errorRows.length);

// The four PACKAGING rows from the screenshot
const targets=['C19999P301','C19999P302','C29999P301','C29999P302'];
console.log('\n=== The four problem PACKAGING rows ===');
targets.forEach(sku=>{
  const r=v.rows.find(x=>x.sku===sku);
  if(!r){console.log('  '+sku+' not in parsed rows'); return;}
  const errs=(r._errors||[]).map(e=>e.field+':'+e.msg.split('·')[0].trim()).join(' | ');
  const warns=(r._warnings||[]).filter(w=>w.field==='selling_unit'||w.field==='base_unit').map(w=>w.field+':'+w.msg.split('·')[0].trim().substring(0,60)).join(' | ');
  console.log('  '+sku+' action='+r._action+' errors=['+errs+'] notable warns=['+warns+']');
});

let pass=0,fail=0;
function ok(L){pass++;console.log('PASS · '+L);}
function bad(L,d){fail++;console.log('FAIL · '+L+' :: '+(d||''));}

// Assertions
if (errorRows.filter(r=>targets.includes(r.sku)).length===0) ok('A1 — none of C19999P301/P302 + C29999P301/P302 are blocked');
else bad('A1', errorRows.filter(r=>targets.includes(r.sku)).map(r=>r.sku).join(','));

if (v.summary.blocking_errors <= 5) ok('A2 — overall blocking errors very low ('+v.summary.blocking_errors+', was 139 pre-13A-1B)');
else bad('A2','blocking_errors='+v.summary.blocking_errors);

// Targeted: an M0002-like row with selling_unit DELIBERATELY set in the file to something invalid still blocks
const M0002 = v.rows.find(r=>r.sku==='M0002');
if (M0002) {
  console.log('\nM0002 row in file: selling_unit='+JSON.stringify(M0002.selling_unit)+' pack_unit='+JSON.stringify(M0002.pack_unit)+' bpp='+M0002.base_per_pack);
  console.log('M0002 action='+M0002._action+' errors='+JSON.stringify((M0002._errors||[]).map(e=>e.field)));
}

// Synthetic: a row where operator explicitly sets selling_unit to invalid → still blocks
const syn = [{sku:'SYN1', name_th:'Bad selling', item_role:'FG', base_unit:'ฟอง', pack_unit:'แพ็ค 10', base_per_pack:12, selling_unit:'ไม่มีหน่วยนี้'}];
const synV = T13A1.validateImportRows(syn);
if ((synV.rows[0]._errors||[]).some(e=>e.field==='selling_unit')) ok('A3 — explicit unresolvable selling_unit still blocks (synthetic SYN1)');
else bad('A3','no selling_unit error on SYN1');

// Static regressions
if (!/onclick="openBomBulkUpload\(\)"/.test(html)) ok('A4 — Task 13A-0B regression intact');
else bad('A4');
const supplyActive = /data-f="units\.has_consumable_unit"|data-f="units\.consumable_unit"|data-f="units\.base_per_consumable"/.test(html);
if (!supplyActive) ok('A5 — Task 12B regression intact');
else bad('A5');

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail===0?0:1);
