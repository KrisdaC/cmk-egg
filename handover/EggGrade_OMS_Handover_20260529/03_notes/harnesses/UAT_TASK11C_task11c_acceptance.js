const vm = require('vm');
const fs = require('fs');
const helper = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_tray_helper.js','utf8');
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok, MASTER_V3: null };
vm.createContext(ctx);
const tests = `
MASTER_V3 = { items: [
  { sku:'C19999P301', name:'ถาดเล็ก',  item_role:'PACKAGING', item_type:'tray',     is_active:true  },
  { sku:'C19999P302', name:'ถาดใหญ่',  item_role:'PACKAGING', item_type:'tray',     is_active:true  },
  { sku:'C19999C001', name:'ฝาครอบ',   item_role:'PACKAGING', item_type:'cover',    is_active:true  },
  { sku:'C19999L001', name:'ฉลาก A',   item_role:'PACKAGING', item_type:'label',    is_active:true  },
  { sku:'C19999S001', name:'สติ๊กเกอร์', item_role:'PACKAGING', item_type:'sticker', is_active:true  },
  { sku:'C19999K001', name:'แพ็ค',     item_role:'PACKAGING', item_type:'pack',     is_active:true  },
  { sku:'B1BC00001',  name:'ตะกร้า',   item_role:'PACKAGING', item_type:'basket',   is_active:true  },
  { sku:'F0001',      name:'FG egg',   item_role:'FG',        item_type:'packed_egg', is_active:true },
  { sku:'C19999P303', name:'ถาดเลิกใช้', item_role:'PACKAGING', item_type:'tray',   is_active:false },
  { sku:'C19999P304', name:'ถาด stub', item_role:'PACKAGING', item_type:'tray',     is_active:true, is_placeholder:true },
]};

// T1 — filters to PACKAGING + tray only
var cands = _bomPkgTrayCandidateItems('');
ok('T1a 2 tray rows (active, non-placeholder)', cands.length === 2);
ok('T1b sorted by sku P301 then P302', cands[0].sku === 'C19999P301' && cands[1].sku === 'C19999P302');
ok('T1c excludes cover',   !cands.some(x => x.sku === 'C19999C001'));
ok('T1d excludes label',   !cands.some(x => x.sku === 'C19999L001'));
ok('T1e excludes sticker', !cands.some(x => x.sku === 'C19999S001'));
ok('T1f excludes pack',    !cands.some(x => x.sku === 'C19999K001'));
ok('T1g excludes basket',  !cands.some(x => x.sku === 'B1BC00001'));
ok('T1h excludes FG',      !cands.some(x => x.sku === 'F0001'));
ok('T1i excludes inactive tray when not current', !cands.some(x => x.sku === 'C19999P303'));
ok('T1j excludes placeholder tray',               !cands.some(x => x.sku === 'C19999P304'));

// T2 — inactive tray IS included when it is the currently-paired SKU
var keep = _bomPkgTrayCandidateItems('C19999P303');
ok('T2a 3 rows (2 active + 1 inactive that is current)', keep.length === 3);
ok('T2b inactive current sku included',                  keep.some(x => x.sku === 'C19999P303'));

// T3 — placeholder tray stays excluded even when current
var stub = _bomPkgTrayCandidateItems('C19999P304');
ok('T3 placeholder never included regardless of current', !stub.some(x => x.sku === 'C19999P304'));

// T4 — empty MASTER_V3
MASTER_V3 = { items: [] };
ok('T4 empty MASTER_V3 -> []', _bomPkgTrayCandidateItems('').length === 0);

// T5 — case-insensitive item_role and item_type matching
MASTER_V3 = { items: [
  { sku:'A', item_role:'packaging', item_type:'TRAY', is_active:true },
  { sku:'B', item_role:'Packaging', item_type:'Tray', is_active:true },
]};
var ci = _bomPkgTrayCandidateItems('');
ok('T5 case-insensitive role/type match', ci.length === 2);
`;
try { vm.runInContext(helper + '\n' + tests, ctx, { filename:'task11c.js' }); }
catch(e){ console.log('  HARNESS ERROR: '+(e&&e.stack||e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
