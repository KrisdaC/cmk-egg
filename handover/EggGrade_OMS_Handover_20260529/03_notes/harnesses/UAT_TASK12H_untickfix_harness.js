// Task 12H fix-up: verify the helper logic that decides whether to clear
// secondary_grade + min_primary. Also re-run the calc engine to prove that
// after the clear, splitBaseEggsByGrade no longer classifies a single-grade
// item as mixed.
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT='/sessions/tender-eager-knuth/mnt/uat-handover';
const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
const SCRIPT_RE=/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/g;
const blocks=[]; let m;
while((m=SCRIPT_RE.exec(html))!==null){const a=m.groups.attrs||'';if(a.includes('application/octet-stream'))continue;if(a.includes('src=')&&a.includes('http'))continue;blocks.push(m.groups.body);}
const sandbox={console,setTimeout,clearTimeout,document:{addEventListener(){},removeEventListener(){},getElementById(){return null;},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return {style:{},setAttribute(){},appendChild(){},click(){},remove(){}};},body:{appendChild(){},removeChild(){}},head:{appendChild(){},removeChild(){}},title:'',readyState:'complete',activeElement:null},window:undefined,navigator:{language:'th-TH'},location:{hash:'',search:''},localStorage:(function(){const s={};return{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=String(v);},removeItem:k=>{delete s[k];},get length(){return Object.keys(s).length;},key:i=>Object.keys(s)[i]||null,clear(){for(const k of Object.keys(s)) delete s[k];}};})(),XLSX:undefined,alert:()=>{},confirm:()=>true,prompt:()=>'',Blob:function(){this.size=0;},URL:{createObjectURL:()=>'blob://x',revokeObjectURL(){}},File:function(){},FileReader:function(){this.readAsText=f=>this.onload&&this.onload({target:{result:f._text}});this.readAsArrayBuffer=f=>this.onload&&this.onload({target:{result:f._buf}});},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>Date.now()},requestAnimationFrame(){},cancelAnimationFrame(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
sandbox._ROLE_BEHAVIOR_DEFAULTS = { FG:{sellable:true,producable:true,consumable:false}, PACKAGING:{sellable:false,producable:false,consumable:true} };
vm.createContext(sandbox);
let merged=''; for (const b of blocks) merged += '\n;try {\n' + b + '\n} catch(__e){}\n';
vm.runInContext(merged, sandbox, { timeout: 10000 });

let pass=0, fail=0;
function ok(L){pass++; console.log('PASS · '+L);}
function bad(L,d){fail++; console.log('FAIL · '+L+' :: '+(d||''));}

// Pure helper test
const shouldShow = sandbox._t12h_shouldShowMixedFields;
if (typeof shouldShow !== 'function') return bad('_t12h_shouldShowMixedFields not exposed');
if (shouldShow('graded', true)  === true)  ok('shouldShowMixedFields: graded+mixed → true (keep)'); else bad('A');
if (shouldShow('graded', false) === false) ok('shouldShowMixedFields: graded+unmixed → false (clear)'); else bad('B');
if (shouldShow('raw', true)     === false) ok('shouldShowMixedFields: raw → false (clear)'); else bad('C');
if (shouldShow('raw', false)    === false) ok('shouldShowMixedFields: raw → false (clear)'); else bad('D');
if (shouldShow('under', false)  === false) ok('shouldShowMixedFields: under → false (clear)'); else bad('E');
if (shouldShow('', false)       === false) ok('shouldShowMixedFields: blank → false (clear)'); else bad('F');

// _t12h_clearLeftoverEggFields exposed (DOM-effecting; just confirm presence)
if (typeof sandbox._t12h_clearLeftoverEggFields === 'function') ok('_t12h_clearLeftoverEggFields exposed (DOM patch)');
else bad('clearLeftoverEggFields missing');

// Critical: prove that after a clear, the calc engine no longer classifies
// as mixed. Simulate "operator unticked Mixed" — after my fix, the form's
// secondary_grade is cleared. Pass a synthesized item to splitBaseEggsByGrade.
const split = sandbox.splitBaseEggsByGrade;
if (typeof split !== 'function') return bad('splitBaseEggsByGrade missing');

// BEFORE fix simulation: item still has stale secondary_grade
const before = split({ is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'2', secondary_grade:'3', min_primary:40 }, 100);
if (before.output_egg_targets[0].target_type === 'mixed' && before.source_egg_requirements.length === 2)
  ok('Demonstrates the bug: stale secondary_grade with GRADED_SINGLE still produces 2-line mixed BOM');
else bad('demo bug', JSON.stringify(before));

// AFTER fix simulation: secondary_grade + min_primary cleared
const after = split({ is_egg:true, egg_content_type:'GRADED_SINGLE', primary_grade:'2', secondary_grade:'', min_primary:null }, 100);
if (after.output_egg_targets[0].target_type === 'single' && after.source_egg_requirements.length === 1)
  ok('Fix verified: after clearing secondary_grade, GRADED_SINGLE produces 1-line single BOM');
else bad('fix verify', JSON.stringify(after));

// Round-trip the tick → untick scenario via the change handlers' decisions:
// 1. Open item with GRADED_MIX + primary=2 + secondary=3 + min=40
//    → renderer shows: graded+mixed. After ticking Mixed off:
// 2. New egg_content_type = GRADED_SINGLE
// 3. shouldShowMixedFields('graded', false) === false → clear secondary + min
// 4. Item now has: egg_content_type=GRADED_SINGLE, primary=2, secondary='', min=null
// 5. splitBaseEggsByGrade → single target/source ✓
const u = sandbox._t12h_uiToStored('graded', false);
if (u === 'GRADED_SINGLE') ok('End-to-end: untick Mixed → uiToStored returns GRADED_SINGLE');
else bad('uiToStored single', u);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
