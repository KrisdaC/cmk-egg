const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync('/sessions/kind-wonderful-shannon/mnt/outputs/extracted_11d.js','utf8');
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n);} }
const ctx = { console, ok };
vm.createContext(ctx);
const tests = `
// T1 — _BOM_PACKAGING_SLOTS shape
ok('T1a 7 slots',                          _BOM_PACKAGING_SLOTS.length === 7);
ok('T1b first slot is pack_base + ready',  _BOM_PACKAGING_SLOTS[0].role === 'pack_base' && _BOM_PACKAGING_SLOTS[0].ready === true);
ok('T1c six placeholder slots',            _BOM_PACKAGING_SLOTS.filter(function(s){return s.ready===false;}).length === 6);
ok('T1d pack_base allowed_types=[tray]',   JSON.stringify(_BOM_PACKAGING_SLOTS[0].allowed_types) === JSON.stringify(['tray']));
ok('T1e cover -> [cover]',                 JSON.stringify(_BOM_PACKAGING_SLOTS[1].allowed_types) === JSON.stringify(['cover']));
ok('T1f barcode_sku_label -> [label]',     JSON.stringify(_BOM_PACKAGING_SLOTS[2].allowed_types) === JSON.stringify(['label']));
ok('T1g product_label_sticker -> [sticker,label]', JSON.stringify(_BOM_PACKAGING_SLOTS[3].allowed_types) === JSON.stringify(['sticker','label']));
ok('T1h closer_1 allowed_types=[]',        Array.isArray(_BOM_PACKAGING_SLOTS[4].allowed_types) && _BOM_PACKAGING_SLOTS[4].allowed_types.length === 0);
ok('T1i closer_2 allowed_types=[]',        Array.isArray(_BOM_PACKAGING_SLOTS[5].allowed_types) && _BOM_PACKAGING_SLOTS[5].allowed_types.length === 0);
ok('T1j bulk_barcode_label -> [label]',    JSON.stringify(_BOM_PACKAGING_SLOTS[6].allowed_types) === JSON.stringify(['label']));

// T2 — _bomSlotTypeDisplay
ok('T2a tray label',     _bomSlotTypeDisplay({allowed_types:['tray']})     === 'ถาด · tray');
ok('T2b cover label',    _bomSlotTypeDisplay({allowed_types:['cover']})    === 'ฝาครอบ · cover');
ok('T2c label label',    _bomSlotTypeDisplay({allowed_types:['label']})    === 'ฉลาก · label');
ok('T2d sticker label',  _bomSlotTypeDisplay({allowed_types:['sticker']})  === 'สติ๊กเกอร์ · sticker');
ok('T2e pack label',     _bomSlotTypeDisplay({allowed_types:['pack']})     === 'แพ็ค · pack');
ok('T2f basket label',   _bomSlotTypeDisplay({allowed_types:['basket']})   === 'ตะกร้า · basket');
ok('T2g multi sticker+label', _bomSlotTypeDisplay({allowed_types:['sticker','label']}) === 'สติ๊กเกอร์ · sticker / ฉลาก · label');
ok('T2h empty -> "—"',   _bomSlotTypeDisplay({allowed_types:[]})            === '—');
ok('T2i missing field -> "—"', _bomSlotTypeDisplay({})                     === '—');
ok('T2j null arg -> "—"', _bomSlotTypeDisplay(null)                        === '—');
ok('T2k undefined arg -> "—"', _bomSlotTypeDisplay()                       === '—');
ok('T2l unknown code passes through', _bomSlotTypeDisplay({allowed_types:['xyz']}) === 'xyz · xyz');

// T3 — every active slot has a non-empty allowed_types
var active = _BOM_PACKAGING_SLOTS.filter(function(s){return s.ready===true;});
ok('T3 every active slot has allowed_types', active.every(function(s){ return Array.isArray(s.allowed_types) && s.allowed_types.length > 0; }));
`;
try { vm.runInContext(code + '\n' + tests, ctx, { filename:'task11d.js' }); }
catch(e){ console.log('  HARNESS ERROR: ' + (e && e.stack || e)); fail++; }
console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
