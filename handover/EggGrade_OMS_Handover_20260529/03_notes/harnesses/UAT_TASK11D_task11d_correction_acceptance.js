const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_11d_correction.js','utf8');
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok, MASTER_V3: null };
vm.createContext(ctx);
const tests = `
MASTER_V3 = { items: [
  { sku:'C19999P301', name:'ถาดเล็ก', item_role:'PACKAGING', item_type:'tray',    is_active:true  },
  { sku:'C19999P302', name:'ถาดใหญ่', item_role:'PACKAGING', item_type:'tray',    is_active:true  },
  { sku:'C19999C001', name:'ฝาครอบ A', item_role:'PACKAGING', item_type:'cover',  is_active:true  },
  { sku:'C19999C002', name:'ฝาครอบ B', item_role:'PACKAGING', item_type:'cover',  is_active:true  },
  { sku:'C19999L001', name:'ฉลาก A',   item_role:'PACKAGING', item_type:'label',  is_active:true  },
  { sku:'C19999S001', name:'สติ๊กเกอร์', item_role:'PACKAGING', item_type:'sticker', is_active:true  },
  { sku:'C19999K001', name:'แพ็ค',     item_role:'PACKAGING', item_type:'pack',    is_active:true  },
  { sku:'B1BC00001',  name:'ตะกร้า',   item_role:'PACKAGING', item_type:'basket',  is_active:true  },
  { sku:'F0001',      name:'FG egg',   item_role:'FG',        item_type:'packed_egg', is_active:true },
  { sku:'C19999P303', name:'ถาดเลิกใช้', item_role:'PACKAGING', item_type:'tray', is_active:false },
  { sku:'C19999P304', name:'ถาด stub', item_role:'PACKAGING', item_type:'tray', is_active:true, is_placeholder:true },
]};

// T1 — tray filter
var trays = _bomPkgCandidatesByType('PACKAGING', 'tray', '');
ok('T1a 2 active trays',           trays.length === 2);
ok('T1b sorted',                   trays[0].sku === 'C19999P301' && trays[1].sku === 'C19999P302');
ok('T1c excludes inactive tray',   !trays.some(x => x.sku === 'C19999P303'));
ok('T1d excludes placeholder',     !trays.some(x => x.sku === 'C19999P304'));

// T2 — cover filter
var covers = _bomPkgCandidatesByType('PACKAGING', 'cover', '');
ok('T2a 2 covers',                covers.length === 2);
ok('T2b only covers',             covers.every(x => x.item_type === 'cover'));

// T3 — label filter
var labels = _bomPkgCandidatesByType('PACKAGING', 'label', '');
ok('T3a 1 label',                 labels.length === 1);
ok('T3b correct label sku',       labels[0].sku === 'C19999L001');

// T4 — sticker / pack / basket each filter cleanly
ok('T4a sticker -> 1',  _bomPkgCandidatesByType('PACKAGING','sticker','').length === 1);
ok('T4b pack -> 1',     _bomPkgCandidatesByType('PACKAGING','pack','').length === 1);
ok('T4c basket -> 1',   _bomPkgCandidatesByType('PACKAGING','basket','').length === 1);

// T5 — inactive tray IS included when it is the currently-paired SKU
var keep = _bomPkgCandidatesByType('PACKAGING', 'tray', 'C19999P303');
ok('T5a 3 trays incl current inactive', keep.length === 3);
ok('T5b inactive current included',     keep.some(x => x.sku === 'C19999P303'));

// T6 — case-insensitive role/type
ok('T6a lowercase role',         _bomPkgCandidatesByType('packaging','tray','').length === 2);
ok('T6b uppercase type',         _bomPkgCandidatesByType('PACKAGING','TRAY','').length === 2);
ok('T6c mixed case',             _bomPkgCandidatesByType('Packaging','Tray','').length === 2);

// T7 — empty type -> empty result; empty role defaults to PACKAGING
ok('T7a empty type -> []',       _bomPkgCandidatesByType('PACKAGING','','').length === 0);
ok('T7b empty role defaults to PACKAGING', _bomPkgCandidatesByType('','tray','').length === 2);

// T8 — different role
MASTER_V3.items.push({ sku:'S0001', name:'sup', item_role:'SUPPLY', item_type:'cleaning', is_active:true });
ok('T8a SUPPLY/cleaning -> 1',   _bomPkgCandidatesByType('SUPPLY','cleaning','').length === 1);

// T9 — _bomPkgTrayCandidateItems wrapper still works (delegates to _bomPkgCandidatesByType)
var wrap = _bomPkgTrayCandidateItems('');
ok('T9a wrapper 2 trays',        wrap.length === 2);
ok('T9b wrapper sorted',         wrap[0].sku === 'C19999P301' && wrap[1].sku === 'C19999P302');
var wrapKeep = _bomPkgTrayCandidateItems('C19999P303');
ok('T9c wrapper keeps current inactive', wrapKeep.some(x => x.sku === 'C19999P303'));

// T10 — empty MASTER_V3
MASTER_V3 = { items: [] };
ok('T10 empty master -> []', _bomPkgCandidatesByType('PACKAGING','tray','').length === 0);
`;
try { vm.runInContext(code + '\n' + tests, ctx, { filename:'task11d_correction.js' }); }
catch(e){ console.log('  HARNESS ERROR: ' + (e && e.stack || e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
