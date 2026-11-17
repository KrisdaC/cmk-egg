/* @ds-bundle: {"format":3,"namespace":"CMKFactoryDesignSystem_e4dc70","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"BubbleTable","sourcePath":"components/data/BubbleTable.jsx"},{"name":"CUSTOMERS","sourcePath":"components/lib/categorical.js"},{"name":"SIZES","sourcePath":"components/lib/categorical.js"},{"name":"PACK","sourcePath":"components/lib/categorical.js"},{"name":"DELIVERY","sourcePath":"components/lib/categorical.js"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"CustomerPill","sourcePath":"components/pills/CustomerPill.jsx"},{"name":"DeliveryTypePill","sourcePath":"components/pills/DeliveryTypePill.jsx"},{"name":"FilterChip","sourcePath":"components/pills/FilterChip.jsx"},{"name":"PackPill","sourcePath":"components/pills/PackPill.jsx"},{"name":"RoundChip","sourcePath":"components/pills/RoundChip.jsx"},{"name":"SizePill","sourcePath":"components/pills/SizePill.jsx"},{"name":"StatusPill","sourcePath":"components/pills/StatusPill.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"KpiTile","sourcePath":"components/surfaces/KpiTile.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"69ae07fdf37d","components/data/BubbleTable.jsx":"7bfa339083e7","components/lib/categorical.js":"75d15896e742","components/navigation/Tabs.jsx":"741e6d022b33","components/pills/CustomerPill.jsx":"09c184dde3bd","components/pills/DeliveryTypePill.jsx":"104ab22ce91c","components/pills/FilterChip.jsx":"830711efadd2","components/pills/PackPill.jsx":"87ab98c3fa57","components/pills/RoundChip.jsx":"2eeab699af3f","components/pills/SizePill.jsx":"891e9dddd455","components/pills/StatusPill.jsx":"950be6a86516","components/surfaces/Card.jsx":"69ae92f2c86b","components/surfaces/KpiTile.jsx":"3490432c0547","ui_kits/daily_planning/DemandBoard.jsx":"cf63437dda0a","ui_kits/daily_planning/MaterialBoard.jsx":"779ad4c86f55","ui_kits/order_management/MasterDataScreen.jsx":"72fc850d6e64","ui_kits/order_management/OrdersScreen.jsx":"80cb8d11bc9a"},"inlinedExternals":[],"unexposedExports":[{"name":"customerBg","sourcePath":"components/lib/categorical.js"},{"name":"customerColor","sourcePath":"components/lib/categorical.js"},{"name":"customerKey","sourcePath":"components/lib/categorical.js"},{"name":"deliveryColors","sourcePath":"components/lib/categorical.js"},{"name":"packColors","sourcePath":"components/lib/categorical.js"},{"name":"sizeColors","sourcePath":"components/lib/categorical.js"}]} */

(() => {

const __ds_ns = (window.CMKFactoryDesignSystem_e4dc70 = window.CMKFactoryDesignSystem_e4dc70 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  primary: {
    background: '#1a1a1a',
    color: '#fff',
    borderColor: '#1a1a1a'
  },
  danger: {
    background: '#c0392b',
    color: '#fff',
    borderColor: '#c0392b'
  },
  default: {
    background: '#fff',
    color: '#1a1a1a',
    borderColor: '#d6d8dc'
  },
  cta: {
    background: '#185FA5',
    color: '#fff',
    borderColor: '#185FA5'
  } // MRP page CTA
};
const SIZES = {
  sm: {
    padding: '3px 9px',
    fontSize: 11
  },
  md: {
    padding: '5px 11px',
    fontSize: 12
  },
  lg: {
    padding: '8px 18px',
    fontSize: 13
  }
};

/**
 * Action button. primary = filled black · danger = filled red ·
 * default = outlined white · cta = filled blue (MRP page action).
 */
function Button({
  variant = 'default',
  size = 'md',
  disabled = false,
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const s = SIZES[size] || SIZES.md;
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...v,
      ...s,
      border: `1px solid ${v.borderColor}`,
      borderRadius: 5,
      fontFamily: 'inherit',
      fontWeight: variant === 'cta' ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.1s',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/data/BubbleTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Bubble-row table: each row is a card-style bubble (white, bordered, soft
 * shadow, rounded ends) separated by spacing. Column order convention:
 * identity left · spec middle · quantity right (hero) · status far right.
 *
 * `columns`: [{ key, label, align?, hero?, render? }]
 * `rows`: array of row objects; cell value is row[col.key] unless render() given.
 */
function BubbleTable({
  columns = [],
  rows = [],
  onRowClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("table", _extends({
    style: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: '0 6px',
      background: 'transparent',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      fontWeight: 500,
      fontSize: 10,
      color: '#999',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      padding: '6px 12px 4px',
      textAlign: c.align || 'left',
      whiteSpace: 'nowrap',
      borderBottom: '1px solid #ecedf0'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: row.id ?? ri,
    onClick: () => onRowClick && onRowClick(row),
    style: {
      cursor: onRowClick ? 'pointer' : 'default'
    }
  }, columns.map((c, ci) => {
    const first = ci === 0;
    const last = ci === columns.length - 1;
    return /*#__PURE__*/React.createElement("td", {
      key: c.key,
      style: {
        background: '#fff',
        borderTop: '1px solid #d6d8dc',
        borderBottom: '1px solid #d6d8dc',
        borderLeft: first ? '1px solid #d6d8dc' : undefined,
        borderRight: last ? '1px solid #d6d8dc' : undefined,
        borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : undefined,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        padding: '8px 12px',
        textAlign: c.align || 'left',
        fontWeight: c.hero ? 700 : undefined,
        verticalAlign: 'middle'
      }
    }, c.render ? c.render(row[c.key], row) : row[c.key]);
  })))));
}
Object.assign(__ds_scope, { BubbleTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BubbleTable.jsx", error: String((e && e.message) || e) }); }

// components/lib/categorical.js
try { (() => {
// CMK Factory — canonical categorical color mapping.
// ONE pair per entity (fill + soft tint). Never improvise a per-page color;
// add new entities here so every surface stays consistent.

// Customer / entity canonical pairs.
const CUSTOMERS = {
  makro: {
    color: '#A32D2D',
    bg: '#FCEBEB'
  },
  bigc: {
    color: '#3B6D11',
    bg: '#EAF3DE'
  },
  thaifood: {
    color: '#185FA5',
    bg: '#E6F1FB'
  },
  cj: {
    color: '#993556',
    bg: '#FBEAF0'
  },
  tt: {
    color: '#854F0B',
    bg: '#FAEEDA'
  },
  lotuss: {
    color: '#0A6E56',
    bg: '#E1F5EE'
  },
  general: {
    color: '#5F5E5A',
    bg: '#F1EFE8'
  }
};

// Loose alias map so display names ("Big C", "Lotus's", "ทั่วไป") resolve.
const CUST_ALIASES = {
  makro: 'makro',
  'big c': 'bigc',
  bigc: 'bigc',
  thaifood: 'thaifood',
  cj: 'cj',
  'cj express': 'cj',
  tt: 'tt',
  lotuss: 'lotuss',
  "lotus's": 'lotuss',
  lotus: 'lotuss',
  'ทั่วไป': 'general',
  general: 'general'
};
function customerKey(name) {
  if (!name) return 'general';
  const k = String(name).trim().toLowerCase();
  return CUST_ALIASES[k] || (CUSTOMERS[k] ? k : 'general');
}
function customerColor(name) {
  return CUSTOMERS[customerKey(name)].color;
}
function customerBg(name) {
  return CUSTOMERS[customerKey(name)].bg;
}

// Sequential egg-size ramp, warm (biggest) -> cool.
const SIZES = {
  '0': {
    fg: '#791F1F',
    bg: '#FCEBEB'
  },
  '1': {
    fg: '#633806',
    bg: '#FAEEDA'
  },
  '2': {
    fg: '#27500A',
    bg: '#EAF3DE'
  },
  '3': {
    fg: '#085041',
    bg: '#E1F5EE'
  },
  '4': {
    fg: '#0C447C',
    bg: '#E6F1FB'
  },
  '5': {
    fg: '#3C3489',
    bg: '#EEEDFE'
  },
  mix: {
    fg: '#444441',
    bg: '#F1EFE8'
  },
  un: {
    fg: '#888780',
    bg: '#F1EFE8'
  }
};
function sizeColors(key) {
  return SIZES[key] || SIZES.un;
}

// Packaging families.
const PACK = {
  tray: {
    fg: '#27500A',
    bg: '#EAF3DE'
  },
  mat: {
    fg: '#0C447C',
    bg: '#E6F1FB'
  },
  pack: {
    fg: '#854F0B',
    bg: '#FAEEDA'
  },
  basket: {
    fg: '#993556',
    bg: '#FBEAF0'
  },
  egg: {
    fg: '#5F5E5A',
    bg: '#F1EFE8'
  },
  other: {
    fg: '#3C3489',
    bg: '#EEEDFE'
  }
};
function packColors(family) {
  return PACK[family] || PACK.other;
}

// Delivery-type families.
const DELIVERY = {
  direct: {
    fg: '#5F5E5A',
    bg: '#F1EFE8'
  },
  dc: {
    fg: '#0C447C',
    bg: '#E6F1FB'
  },
  xdock: {
    fg: '#854F0B',
    bg: '#FAEEDA'
  },
  wholesale: {
    fg: '#993556',
    bg: '#FBEAF0'
  },
  retail: {
    fg: '#27500A',
    bg: '#EAF3DE'
  },
  pickup: {
    fg: '#3C3489',
    bg: '#EEEDFE'
  }
};
function deliveryColors(type) {
  return DELIVERY[type] || DELIVERY.direct;
}
Object.assign(__ds_scope, { customerKey, customerColor, customerBg, sizeColors, packColors, deliveryColors, CUSTOMERS, SIZES, PACK, DELIVERY });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/lib/categorical.js", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Underline-active tab bar. `tabs` is an array of { id, label }. Active tab =
 * black text + 2px black underline.
 */
function Tabs({
  tabs = [],
  active,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid #e3e5e8',
      ...style
    }
  }, rest), tabs.map(t => {
    const isActive = t.id === active;
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      onClick: () => onChange && onChange(t.id),
      style: {
        padding: '9px 14px',
        cursor: 'pointer',
        fontSize: 13,
        color: isActive ? '#1a1a1a' : '#777',
        fontWeight: isActive ? 500 : 400,
        borderBottom: `2px solid ${isActive ? '#1a1a1a' : 'transparent'}`,
        marginBottom: -1,
        userSelect: 'none',
        transition: 'color 0.12s'
      }
    }, t.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/pills/CustomerPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The canonical customer-name bubble. Fill comes from the canonical mapping —
 * never a per-page color. Used wherever a customer is named.
 */
function CustomerPill({
  name,
  variant = 'solid',
  // 'solid' | 'tint' | 'neutral'
  dim = false,
  ring = false,
  clickable = false,
  onClick,
  style,
  ...rest
}) {
  const fill = __ds_scope.customerColor(name);
  const tint = __ds_scope.customerBg(name);
  const base = {
    display: 'inline-block',
    padding: clickable ? '3px 10px' : '2px 8px',
    borderRadius: 10,
    fontSize: variant === 'tint' ? 11 : 10,
    fontWeight: 600,
    letterSpacing: variant === 'tint' ? 0 : 0.3,
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: clickable ? 'pointer' : 'default',
    fontFamily: 'inherit',
    opacity: dim ? 0.55 : 1,
    boxShadow: ring ? '0 0 0 2px #fff, 0 0 0 4px #1a1a1a' : 'none'
  };
  let skin;
  if (variant === 'neutral') skin = {
    background: '#5F5E5A',
    color: '#fff'
  };else if (variant === 'tint') skin = {
    background: tint,
    color: fill,
    borderRadius: 6
  };else skin = {
    background: fill,
    color: '#fff'
  };
  const Tag = clickable ? 'button' : 'span';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      ...base,
      ...skin,
      ...style
    },
    onClick: onClick
  }, rest), name);
}
Object.assign(__ds_scope, { CustomerPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/CustomerPill.jsx", error: String((e && e.message) || e) }); }

// components/pills/DeliveryTypePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Site delivery-type chip shown next to a site name. `type` is one of
 * 'direct' | 'dc' | 'xdock' | 'wholesale' | 'retail' | 'pickup'.
 */
function DeliveryTypePill({
  type = 'direct',
  children,
  style,
  ...rest
}) {
  const c = __ds_scope.deliveryColors(type);
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.2,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
      background: c.bg,
      color: c.fg,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { DeliveryTypePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/DeliveryTypePill.jsx", error: String((e && e.message) || e) }); }

// components/pills/FilterChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Toggle filter chip used across filter bars. Active = filled black. A
 * `color` prop tints the active fill (e.g. a customer brand color).
 */
function FilterChip({
  active = false,
  color,
  children,
  onClick,
  style,
  ...rest
}) {
  const activeBg = color || '#1a1a1a';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    style: {
      padding: '4px 11px',
      fontSize: 12,
      border: `1px solid ${active ? activeBg : '#d6d8dc'}`,
      background: active ? activeBg : '#fff',
      color: active ? '#fff' : '#444',
      borderRadius: 14,
      cursor: 'pointer',
      lineHeight: 1.2,
      fontWeight: active ? 600 : 500,
      fontFamily: 'inherit',
      transition: 'all 0.1s',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { FilterChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/FilterChip.jsx", error: String((e && e.message) || e) }); }

// components/pills/PackPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Packaging-type pill (ถาด / มัด / แพ็ค N / ตะกร้า / ฟอง). `family` is one of
 * 'tray' | 'mat' | 'pack' | 'basket' | 'egg' | 'other'. A leading numeric
 * `count` renders in bold (e.g. "100 แพ็ค 30").
 */
function PackPill({
  family = 'other',
  count,
  children,
  style,
  ...rest
}) {
  const c = __ds_scope.packColors(family);
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.2,
      lineHeight: 1.6,
      whiteSpace: 'nowrap',
      background: c.bg,
      color: c.fg,
      ...style
    }
  }, rest), count != null && /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 700
    }
  }, count, " "), children);
}
Object.assign(__ds_scope, { PackPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/PackPill.jsx", error: String((e && e.message) || e) }); }

// components/pills/RoundChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SKINS = {
  open: {
    background: '#FEF3C7',
    color: '#854F0B',
    borderColor: '#F0B400',
    weight: 700
  },
  closed: {
    background: '#F0FDF4',
    color: '#166534',
    borderColor: '#86EFAC',
    weight: 700
  },
  defer: {
    background: '#FFF7ED',
    color: '#9A3412',
    borderColor: '#FDBA74',
    weight: 700
  },
  all: {
    background: '#F5F5F5',
    color: '#525252',
    borderColor: '#d4d4d4',
    weight: 600
  },
  inactive: {
    background: '#FAFAFA',
    color: '#A3A3A3',
    borderColor: '#E5E5E5',
    weight: 600
  }
};
const GLYPH = {
  open: '●',
  closed: '✓',
  defer: '↪',
  all: 'ALL',
  inactive: '○'
};

/**
 * Round-status chip — the strongest context anchor on every Daily-Plan page.
 * `state`: 'open' (working, amber) | 'closed' (green) | 'defer' (receiving) |
 * 'all' (aggregate) | 'inactive' (not yet open). `selected` adds a blue ring.
 */
function RoundChip({
  state = 'open',
  round,
  label,
  selected = false,
  small = false,
  style,
  ...rest
}) {
  const s = SKINS[state] || SKINS.open;
  const tag = state === 'all' ? 'ALL' : round != null ? `R${round}` : '';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: small ? 10.5 : 11.5,
      fontWeight: s.weight,
      borderRadius: 9999,
      padding: small ? '1px 9px' : '2px 11px',
      whiteSpace: 'nowrap',
      background: s.background,
      color: s.color,
      border: `1px solid ${s.borderColor}`,
      boxShadow: selected ? '0 0 0 2px #fff, 0 0 0 4px #185FA5' : 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, GLYPH[state]), tag && state !== 'all' && /*#__PURE__*/React.createElement("span", null, tag), label && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.95
    }
  }, "\xB7 ", label));
}
Object.assign(__ds_scope, { RoundChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/RoundChip.jsx", error: String((e && e.message) || e) }); }

// components/pills/SizePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Egg-size grade chip on the sequential warm->cool ramp. `grade` is one of
 * '0'..'5', 'mix' (graded mix) or 'un' (ungraded/undergrade).
 */
function SizePill({
  grade = 'un',
  children,
  style,
  ...rest
}) {
  const c = __ds_scope.sizeColors(String(grade));
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.2,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
      background: c.bg,
      color: c.fg,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SizePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/SizePill.jsx", error: String((e && e.message) || e) }); }

// components/pills/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SKINS = {
  draft: {
    background: '#F1EFE8',
    color: '#5F5E5A',
    borderColor: '#D3D1C7',
    weight: 500
  },
  submitted: {
    background: '#E6F1FB',
    color: '#0C447C',
    borderColor: '#85B7EB',
    weight: 500
  },
  confirmed: {
    background: '#EAF3DE',
    color: '#27500A',
    borderColor: '#97C459',
    weight: 500
  },
  editing: {
    background: '#FAEEDA',
    color: '#854F0B',
    borderColor: '#F0B400',
    weight: 600
  }
};

/**
 * Three-state ticket status (plus an editing state). Text-on-tint with a
 * hairline border. Quiet by design; pair with the matching state token.
 */
function StatusPill({
  state = 'draft',
  children,
  style,
  ...rest
}) {
  const s = SKINS[state] || SKINS.draft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 9px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: s.weight,
      border: `0.5px solid ${s.borderColor}`,
      background: s.background,
      color: s.color,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children || state.charAt(0).toUpperCase() + state.slice(1));
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pills/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The bubble surface — white card, 1px border, 8px radius, soft shadow. The
 * backbone of every panel, KPI tile and table row. `soft` switches to the
 * MRP variant (12px radius, hairline border, lighter shadow).
 */
function Card({
  soft = false,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: '#fff',
      border: `1px solid ${soft ? '#eef0f3' : '#d6d8dc'}`,
      borderRadius: soft ? 12 : 8,
      padding: '12px 14px',
      boxShadow: soft ? '0 1px 2px rgba(16,24,40,0.04)' : '0 1px 2px rgba(0,0,0,0.04)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/KpiTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ACCENTS = {
  egg: '#f0c869',
  fg: '#93c5fd',
  fmt: '#c4b5fd',
  mat: '#a7d7b8'
};

/**
 * KPI tile: label -> hero number -> muted subtext. Quantity is the hero.
 * Optional soft top-border `accent` (egg / fg / fmt / mat) — never loud.
 */
function KpiTile({
  label,
  value,
  sub,
  accent,
  soft = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    soft: soft,
    style: {
      borderTop: accent ? `2px solid ${ACCENTS[accent] || accent}` : undefined,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 0 6px',
      fontSize: 11,
      fontWeight: 500,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.4
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1.1
    }
  }, value), sub != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#666',
      marginTop: 2
    }
  }, sub));
}
Object.assign(__ds_scope, { KpiTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/KpiTile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/daily_planning/DemandBoard.jsx
try { (() => {
// Daily Planning / MRP — Production Request Board (Demand command layer).
// Round-first: the active round is the primary anchor. Pipeline KPIs + a
// finished-goods plan grouped by customer.
const DNS = window.CMKFactoryDesignSystem_e4dc70;
const {
  KpiTile,
  RoundChip,
  CustomerPill,
  FilterChip,
  SizePill,
  Button
} = DNS;
const FG_PLAN = [{
  cust: 'Makro',
  items: [{
    name: 'ไข่ไก่ เบอร์ 0',
    sku: 'SKU-000',
    grade: '0',
    gradeT: 'เบอร์ 0',
    qty: 3000,
    fmt: '100 แพ็ค 30',
    sameDay: false,
    ok: true
  }, {
    name: 'ไข่ไก่ เบอร์ 2',
    sku: 'SKU-002',
    grade: '2',
    gradeT: 'เบอร์ 2',
    qty: 1800,
    fmt: '60 ถาด 30',
    sameDay: true,
    ok: true
  }]
}, {
  cust: 'BigC',
  items: [{
    name: 'ไข่ไก่ เบอร์ 2',
    sku: 'SKU-002',
    grade: '2',
    gradeT: 'เบอร์ 2',
    qty: 1200,
    fmt: '40 ถาด 30',
    sameDay: true,
    ok: true
  }]
}, {
  cust: 'Thaifood',
  items: [{
    name: 'ไข่ไก่ เบอร์ 3',
    sku: 'SKU-003',
    grade: '3',
    gradeT: 'เบอร์ 3',
    qty: 860,
    fmt: 'มัด',
    sameDay: false,
    ok: false,
    warn: 'รอยืนยันแพ็ค'
  }]
}, {
  cust: 'CJ',
  items: [{
    name: 'ไข่คละ',
    sku: 'SKU-MIX',
    grade: 'mix',
    gradeT: 'คละ',
    qty: 2040,
    fmt: 'ตะกร้า',
    sameDay: false,
    ok: true
  }]
}];
function pillCtx(children) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#475569',
      background: '#f1f5f9',
      border: '1px solid #eef0f3',
      borderRadius: 9999,
      padding: '2px 9px',
      whiteSpace: 'nowrap'
    }
  }, children);
}
function FgCard({
  group
}) {
  const total = group.items.reduce((s, i) => s + i.qty, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #eef0f3',
      borderRadius: 14,
      padding: '12px 15px',
      marginTop: 12,
      boxShadow: '0 1px 2px rgba(16,24,40,.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(CustomerPill, {
    name: group.cust
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#94a3b8'
    }
  }, group.items.length, " SKUs"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 13.5,
      fontWeight: 800,
      fontVariantNumeric: 'tabular-nums',
      color: '#0f172a'
    }
  }, total.toLocaleString(), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 500,
      color: '#94a3b8'
    }
  }, "\u0E1F\u0E2D\u0E07"))), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px'
    }
  }, "Item"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 120
    }
  }, "Format"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 110
    }
  }, "Qty"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 130
    }
  }, "Status"))), /*#__PURE__*/React.createElement("tbody", null, group.items.map(it => /*#__PURE__*/React.createElement("tr", {
    key: it.sku
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      verticalAlign: 'top'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: '#1f2937'
    }
  }, it.name, " ", it.sameDay && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      padding: '1px 8px',
      borderRadius: 9999,
      background: '#FAEEDA',
      color: '#854F0B',
      border: '1px solid #F0B400',
      marginLeft: 4
    }
  }, "\u26A1 \u0E27\u0E31\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: '#94a3b8',
      marginTop: 2
    }
  }, it.sku)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      verticalAlign: 'top'
    }
  }, /*#__PURE__*/React.createElement(SizePill, {
    grade: it.grade
  }, it.gradeT), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#475569'
    }
  }, it.fmt)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      textAlign: 'right',
      fontSize: 13.5,
      fontWeight: 800,
      color: '#0f172a',
      fontVariantNumeric: 'tabular-nums'
    }
  }, it.qty.toLocaleString()), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      textAlign: 'right'
    }
  }, it.ok ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#86a892',
      fontSize: 11,
      fontWeight: 600
    }
  }, "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1C\u0E25\u0E34\u0E15") : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      padding: '1px 8px',
      borderRadius: 9999,
      background: '#fffbeb',
      color: '#92400e',
      border: '1px solid #f59e0b'
    }
  }, it.warn)))))));
}
function DemandBoard() {
  const [cust, setCust] = React.useState('All');
  const groups = cust === 'All' ? FG_PLAN : FG_PLAN.filter(g => g.cust === cust);
  const totalEggs = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.qty, 0), 0);
  const skus = groups.reduce((s, g) => s + g.items.length, 0);
  const warns = groups.reduce((s, g) => s + g.items.filter(i => !i.ok).length, 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #e2e6ec',
      borderRadius: '0 0 10px 10px',
      boxShadow: '0 1px 2px rgba(16,24,40,.06)',
      padding: '10px 14px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: '#1f2937',
      letterSpacing: '-0.01em'
    }
  }, "Production Request Board"), pillCtx('ตามวันส่ง'), pillCtx('23 มิ.ย. 2026'), /*#__PURE__*/React.createElement(RoundChip, {
    state: "open",
    round: 3,
    label: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19",
    selected: true
  }), pillCtx('ลูกค้า: ทั้งหมด'), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "cta"
  }, "\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A \xB7 Close round"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 8,
      paddingTop: 7,
      borderTop: '1px solid #f0f0f0'
    }
  }, ['Finished goods', 'Work required', 'Raw material'].map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: {
      fontSize: 11,
      color: '#3730a3',
      background: '#eef2ff',
      border: '1px solid #c7d2fe',
      borderRadius: 8,
      padding: '3px 9px',
      cursor: 'pointer'
    }
  }, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Egg demand",
    value: totalEggs.toLocaleString(),
    sub: `${skus} SKUs · round 3`,
    accent: "egg"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Confirmed",
    value: "6,900",
    sub: "ready to plan",
    accent: "fg"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Production format",
    value: "200",
    sub: "packs \xB7 trays \xB7 mats",
    accent: "fmt"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Dispatch",
    value: "\u2014",
    sub: "future round",
    accent: "mat"
  })), warns > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fffdf7',
      border: '1px solid #f0e6cf',
      borderRadius: 14,
      padding: '12px 15px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: '#1f2937',
      fontSize: 14,
      minWidth: 24,
      textAlign: 'right'
    }
  }, warns), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: '#475569'
    }
  }, "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E1E\u0E47\u0E04\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E1C\u0E19\u0E08\u0E30\u0E1E\u0E23\u0E49\u0E2D\u0E21"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f6faf7',
      border: '1px solid #e3f0e6',
      borderRadius: 14,
      padding: '10px 15px',
      marginBottom: 12,
      color: '#3f8a54',
      fontSize: 12,
      fontWeight: 600
    }
  }, "\u0E41\u0E1C\u0E19\u0E1E\u0E23\u0E49\u0E2D\u0E21 \xB7 Plan ready"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(FilterChip, {
    active: cust === 'All',
    onClick: () => setCust('All')
  }, "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"), FG_PLAN.map(g => /*#__PURE__*/React.createElement(FilterChip, {
    key: g.cust,
    active: cust === g.cust,
    color: DNS.CUSTOMERS[g.cust.toLowerCase()] ? DNS.CUSTOMERS[g.cust.toLowerCase()].color : undefined,
    onClick: () => setCust(g.cust)
  }, g.cust))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 700,
      color: '#1f2937'
    }
  }, "Finished Goods Plan"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: '#94a3b8',
      margin: '2px 0 4px'
    }
  }, "\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E1C\u0E25\u0E34\u0E15 \u0E08\u0E31\u0E14\u0E40\u0E01\u0E23\u0E14\u0E41\u0E25\u0E30\u0E41\u0E1E\u0E47\u0E04 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E2D\u0E1A 3"), groups.map(g => /*#__PURE__*/React.createElement(FgCard, {
    key: g.cust,
    group: g
  }))));
}
window.DemandBoard = DemandBoard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/daily_planning/DemandBoard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/daily_planning/MaterialBoard.jsx
try { (() => {
// Daily Planning / MRP — Raw Material Required board.
// Soft cards, operator material-prep rows. Quantity is the hero; ready states
// quiet, shortfalls loud and actionable. Materials are shared pools.
const MNS = window.CMKFactoryDesignSystem_e4dc70;
const {
  KpiTile,
  PackPill,
  Button,
  RoundChip
} = MNS;
const MATERIALS = [{
  group: 'บรรจุภัณฑ์ · Packaging',
  rows: [{
    name: 'ถาดไข่ 30 ฟอง',
    sku: 'PKG-TRAY-30',
    pack: 'tray',
    packT: 'ถาด',
    need: 9120,
    have: 9600,
    usedBy: 'Makro · BigC · Lotuss'
  }, {
    name: 'แพ็คพลาสติก 30 ฟอง',
    sku: 'PKG-PACK-30',
    pack: 'pack',
    packT: 'แพ็ค',
    need: 4280,
    have: 3100,
    usedBy: 'Makro'
  }, {
    name: 'ตะกร้าใหญ่',
    sku: 'PKG-BASKET',
    pack: 'basket',
    packT: 'ตะกร้า',
    need: 68,
    have: 80,
    usedBy: 'CJ'
  }, {
    name: 'มัดเชือก',
    sku: 'PKG-MAT',
    pack: 'mat',
    packT: 'มัด',
    need: 240,
    have: 90,
    usedBy: 'Thaifood'
  }]
}, {
  group: 'วัตถุดิบ · Inputs',
  rows: [{
    name: 'สติกเกอร์ฉลาก',
    sku: 'INP-LABEL',
    pack: 'other',
    packT: 'ดวง',
    need: 13400,
    have: 20000,
    usedBy: 'ทุกลูกค้า'
  }, {
    name: 'กล่องลูกฟูก',
    sku: 'INP-BOX',
    pack: 'other',
    packT: 'ใบ',
    need: 420,
    have: 400,
    usedBy: 'Makro · CJ'
  }]
}];
function MatRow({
  r
}) {
  const short = r.have < r.need;
  const delta = r.have - r.need;
  return /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      verticalAlign: 'top'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: '#1f2937'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: '#94a3b8',
      marginTop: 2
    }
  }, r.sku)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      verticalAlign: 'top'
    }
  }, /*#__PURE__*/React.createElement(PackPill, {
    family: r.pack
  }, r.packT)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      verticalAlign: 'top',
      color: '#64748b',
      fontSize: 11
    }
  }, r.usedBy), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      textAlign: 'right',
      verticalAlign: 'top'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 800,
      color: '#0f172a',
      fontVariantNumeric: 'tabular-nums'
    }
  }, r.need.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#94a3b8',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\u0E21\u0E35 ", r.have.toLocaleString())), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 10px',
      borderTop: '1px solid #f3f5f8',
      textAlign: 'right',
      verticalAlign: 'top'
    }
  }, short ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 9999,
      background: '#fffbeb',
      color: '#92400e',
      border: '1px solid #f59e0b',
      whiteSpace: 'nowrap'
    }
  }, "\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21 ", Math.abs(delta).toLocaleString()) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#86a892',
      fontSize: 11,
      fontWeight: 600
    }
  }, "\u0E1E\u0E2D +", delta.toLocaleString())));
}
function MatCard({
  block
}) {
  const short = block.rows.filter(r => r.have < r.need).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #eef0f3',
      borderRadius: 14,
      padding: '12px 15px',
      marginTop: 12,
      boxShadow: '0 1px 2px rgba(16,24,40,.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 13.5,
      fontWeight: 700,
      color: '#1f2937'
    }
  }, block.group), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#94a3b8'
    }
  }, block.rows.length, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"), short > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 10.5,
      fontWeight: 600,
      padding: '1px 8px',
      borderRadius: 9999,
      background: '#fffbeb',
      color: '#92400e',
      border: '1px solid #f59e0b'
    }
  }, short, " \u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21")), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px'
    }
  }, "Material"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 90
    }
  }, "Unit"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 180
    }
  }, "Used by"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 110
    }
  }, "Required"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'right',
      fontSize: 10,
      fontWeight: 600,
      color: '#b4bcc8',
      padding: '2px 10px 7px',
      width: 130
    }
  }, "Status"))), /*#__PURE__*/React.createElement("tbody", null, block.rows.map(r => /*#__PURE__*/React.createElement(MatRow, {
    key: r.sku,
    r: r
  })))));
}
function MaterialBoard() {
  const allRows = MATERIALS.flatMap(b => b.rows);
  const shortCount = allRows.filter(r => r.have < r.need).length;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #e2e6ec',
      borderRadius: '0 0 10px 10px',
      boxShadow: '0 1px 2px rgba(16,24,40,.06)',
      padding: '10px 14px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: '#1f2937'
    }
  }, "Raw Material Required"), /*#__PURE__*/React.createElement(RoundChip, {
    state: "open",
    round: 3,
    label: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19",
    small: true
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "default",
    size: "sm"
  }, "\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E43\u0E1A\u0E40\u0E1A\u0E34\u0E01"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Materials",
    value: allRows.length,
    sub: "in this plan",
    accent: "mat"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "Trays to fill",
    value: "9,120",
    sub: "\u0E16\u0E32\u0E14 30 \u0E1F\u0E2D\u0E07",
    accent: "egg"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    soft: true,
    label: "To re-order",
    value: shortCount,
    sub: "below required",
    accent: "fmt"
  })), shortCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fffdf7',
      border: '1px solid #f0e6cf',
      borderRadius: 14,
      padding: '12px 15px',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: '#475569'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#1f2937'
    }
  }, shortCount, " \u0E27\u0E31\u0E2A\u0E14\u0E38"), " \u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49 \u2014 \u0E2A\u0E31\u0E48\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E1C\u0E25\u0E34\u0E15")), MATERIALS.map(b => /*#__PURE__*/React.createElement(MatCard, {
    key: b.group,
    block: b
  })));
}
window.MaterialBoard = MaterialBoard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/daily_planning/MaterialBoard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/order_management/MasterDataScreen.jsx
try { (() => {
// Order Management System — Master Data (Items) screen.
// The reference surface — customer pills, size/pack pills, dense table.
const NS2 = window.CMKFactoryDesignSystem_e4dc70;
const {
  CustomerPill,
  SizePill,
  PackPill,
  DeliveryTypePill,
  Button,
  FilterChip
} = NS2;
const ITEMS = [{
  sku: 'SKU-000',
  name: 'ไข่ไก่ เบอร์ 0',
  grade: '0',
  gradeT: 'เบอร์ 0',
  pack: {
    f: 'pack',
    c: 100,
    t: 'แพ็ค 30'
  },
  cust: 'Makro',
  dt: 'dc',
  dtT: 'DC',
  active: true
}, {
  sku: 'SKU-001',
  name: 'ไข่ไก่ เบอร์ 1',
  grade: '1',
  gradeT: 'เบอร์ 1',
  pack: {
    f: 'pack',
    c: 50,
    t: 'แพ็ค 10'
  },
  cust: 'TT',
  dt: 'retail',
  dtT: 'Retail',
  active: true
}, {
  sku: 'SKU-002',
  name: 'ไข่ไก่ เบอร์ 2',
  grade: '2',
  gradeT: 'เบอร์ 2',
  pack: {
    f: 'tray',
    t: 'ถาด 30'
  },
  cust: 'BigC',
  dt: 'xdock',
  dtT: 'Cross-dock',
  active: true
}, {
  sku: 'SKU-003',
  name: 'ไข่ไก่ เบอร์ 3',
  grade: '3',
  gradeT: 'เบอร์ 3',
  pack: {
    f: 'mat',
    t: 'มัด'
  },
  cust: 'Thaifood',
  dt: 'dc',
  dtT: 'DC',
  active: true
}, {
  sku: 'SKU-004',
  name: 'ไข่ไก่ เบอร์ 4',
  grade: '4',
  gradeT: 'เบอร์ 4',
  pack: {
    f: 'tray',
    t: 'ถาด 30'
  },
  cust: 'Lotuss',
  dt: 'wholesale',
  dtT: 'Wholesale',
  active: true
}, {
  sku: 'SKU-MIX',
  name: 'ไข่คละ',
  grade: 'mix',
  gradeT: 'คละ',
  pack: {
    f: 'basket',
    t: 'ตะกร้า'
  },
  cust: 'CJ',
  dt: 'direct',
  dtT: 'Direct',
  active: true
}, {
  sku: 'SKU-UNG',
  name: 'ไข่ไม่คัด (ungraded)',
  grade: 'un',
  gradeT: 'ungraded',
  pack: {
    f: 'egg',
    t: 'ฟอง'
  },
  cust: 'ทั่วไป',
  dt: 'pickup',
  dtT: 'Pickup',
  active: false
}];
function MasterDataScreen() {
  const [q, setQ] = React.useState('');
  const [activeOnly, setActiveOnly] = React.useState(false);
  const rows = ITEMS.filter(it => (!q || (it.name + it.sku).toLowerCase().includes(q.toLowerCase())) && (!activeOnly || it.active));
  const th = {
    background: '#f6f7f9',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#666',
    letterSpacing: 0.4,
    padding: '8px 10px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0
  };
  const td = {
    borderBottom: '1px solid #ecedf0',
    padding: '8px 10px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      marginBottom: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 / SKU\u2026",
    style: {
      padding: '5px 10px',
      border: '1px solid #d6d8dc',
      borderRadius: 5,
      fontSize: 12,
      minWidth: 200
    }
  }), /*#__PURE__*/React.createElement(FilterChip, {
    active: activeOnly,
    onClick: () => setActiveOnly(v => !v)
  }, "Active only"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#888',
      marginLeft: 'auto'
    }
  }, rows.length, " of ", ITEMS.length, " items"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "+ \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #e3e5e8',
      borderRadius: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: th
  }, "SKU"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Item"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Grade"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Packaging"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Customer"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Site type"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      textAlign: 'center'
    }
  }, "Status"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(it => /*#__PURE__*/React.createElement("tr", {
    key: it.sku,
    style: {
      background: it.active ? '#fff' : '#fafafa',
      opacity: it.active ? 1 : 0.7
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement("code", {
    className: "cmk-code",
    style: {
      fontSize: 11
    }
  }, it.sku)), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      fontWeight: 500
    }
  }, it.name), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(SizePill, {
    grade: it.grade
  }, it.gradeT)), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(PackPill, {
    family: it.pack.f,
    count: it.pack.c
  }, it.pack.t)), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(CustomerPill, {
    name: it.cust,
    variant: it.cust === 'ทั่วไป' ? 'neutral' : 'solid'
  })), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(DeliveryTypePill, {
    type: it.dt
  }, it.dtT)), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 600,
      background: it.active ? '#e8f5e9' : '#fbe9e7',
      color: it.active ? '#2e7d32' : '#c0392b'
    }
  }, it.active ? 'Active' : 'Inactive'))))))));
}
window.MasterDataScreen = MasterDataScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/order_management/MasterDataScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/order_management/OrdersScreen.jsx
try { (() => {
// Order Management System — Orders screen.
// Composes KpiTile, FilterChip, CustomerPill, StatusPill, SizePill, PackPill,
// Button from the CMK bundle. Click a row to expand its inline editor.
const NS = window.CMKFactoryDesignSystem_e4dc70;
const {
  KpiTile,
  FilterChip,
  CustomerPill,
  StatusPill,
  SizePill,
  PackPill,
  Button
} = NS;
const ORDERS = [{
  id: 'PO-2026-04417',
  cust: 'Makro',
  item: 'ไข่ไก่ เบอร์ 0',
  sku: 'SKU-000',
  grade: '0',
  gradeT: 'เบอร์ 0',
  pack: {
    f: 'pack',
    c: 100,
    t: 'แพ็ค 30'
  },
  qty: 3000,
  status: 'confirmed',
  deliver: '23 มิ.ย.',
  sameDay: false
}, {
  id: 'PO-2026-04418',
  cust: 'BigC',
  item: 'ไข่ไก่ เบอร์ 2',
  sku: 'SKU-002',
  grade: '2',
  gradeT: 'เบอร์ 2',
  pack: {
    f: 'tray',
    t: 'ถาด 30'
  },
  qty: 1200,
  status: 'submitted',
  deliver: '23 มิ.ย.',
  sameDay: true
}, {
  id: 'PO-2026-04419',
  cust: 'Thaifood',
  item: 'ไข่ไก่ เบอร์ 3',
  sku: 'SKU-003',
  grade: '3',
  gradeT: 'เบอร์ 3',
  pack: {
    f: 'mat',
    t: 'มัด'
  },
  qty: 860,
  status: 'submitted',
  deliver: '24 มิ.ย.',
  sameDay: false
}, {
  id: 'PO-2026-04420',
  cust: 'CJ',
  item: 'ไข่คละ',
  sku: 'SKU-MIX',
  grade: 'mix',
  gradeT: 'คละ',
  pack: {
    f: 'basket',
    t: 'ตะกร้า'
  },
  qty: 2040,
  status: 'draft',
  deliver: '24 มิ.ย.',
  sameDay: false
}, {
  id: 'PO-2026-04421',
  cust: 'TT',
  item: 'ไข่ไก่ เบอร์ 1',
  sku: 'SKU-001',
  grade: '1',
  gradeT: 'เบอร์ 1',
  pack: {
    f: 'pack',
    c: 50,
    t: 'แพ็ค 10'
  },
  qty: 500,
  status: 'confirmed',
  deliver: '23 มิ.ย.',
  sameDay: false
}, {
  id: 'PO-2026-04422',
  cust: 'Lotuss',
  item: 'ไข่ไก่ เบอร์ 4',
  sku: 'SKU-004',
  grade: '4',
  gradeT: 'เบอร์ 4',
  pack: {
    f: 'tray',
    t: 'ถาด 30'
  },
  qty: 1500,
  status: 'draft',
  deliver: '25 มิ.ย.',
  sameDay: false
}];
const CUSTS = ['All', 'Makro', 'BigC', 'Thaifood', 'CJ', 'TT', 'Lotuss'];
function lbl(s) {
  return {
    padding: '6px 0 0',
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 600
  };
}
function EditorPanel({
  o
}) {
  const sec = {
    background: '#fff',
    border: '1px solid #E1E5EA',
    borderRadius: 10,
    padding: 16
  };
  const h4 = {
    margin: '0 0 12px',
    fontSize: 11,
    fontWeight: 600,
    color: '#525252',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  };
  const fieldRow = {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap'
  };
  const field = (label, value) => /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontSize: 12,
      color: '#444',
      fontWeight: 500,
      minWidth: 130
    }
  }, label, /*#__PURE__*/React.createElement("input", {
    defaultValue: value,
    style: {
      border: '1px solid #E1E5EA',
      borderRadius: 8,
      padding: '7px 10px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#F4F6F9',
      borderRadius: '0 0 8px 8px',
      padding: 16,
      display: 'grid',
      gridTemplateColumns: 'minmax(280px,360px) 1fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sec
  }, /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Customer & delivery"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(CustomerPill, {
    name: o.cust
  })), /*#__PURE__*/React.createElement("div", {
    style: fieldRow
  }, field('Delivery date', o.deliver), field('Delivery time', '08:00')), /*#__PURE__*/React.createElement("div", {
    style: {
      ...fieldRow,
      marginTop: 10
    }
  }, field('Pickup date', o.deliver), field('Pickup time', '04:30')))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sec
  }, /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Items"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 130px 100px',
      gap: 8,
      fontSize: 10,
      color: '#737373',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      fontWeight: 600,
      borderBottom: '1px solid #E1E5EA',
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, "Item"), /*#__PURE__*/React.createElement("div", null, "Pills"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, "Qty")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 130px 100px',
      gap: 8,
      alignItems: 'center',
      padding: '12px 0'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600
    }
  }, o.item), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#737373',
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("code", {
    className: "cmk-code"
  }, o.sku))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SizePill, {
    grade: o.grade
  }, o.gradeT), /*#__PURE__*/React.createElement(PackPill, {
    family: o.pack.f,
    count: o.pack.c
  }, o.pack.t)), /*#__PURE__*/React.createElement("input", {
    defaultValue: o.qty,
    style: {
      width: 78,
      padding: '7px 10px',
      border: '1px solid #E1E5EA',
      borderRadius: 8,
      fontSize: 13.5,
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      justifySelf: 'end'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "default"
  }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 \xB7 Save"))));
}
function OrdersScreen() {
  const [cust, setCust] = React.useState('All');
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const rows = ORDERS.filter(o => (cust === 'All' || o.cust === cust) && (!q || (o.item + o.sku + o.id).toLowerCase().includes(q.toLowerCase())));
  const totalEggs = rows.reduce((s, o) => s + o.qty, 0);
  const confirmed = rows.filter(o => o.status === 'confirmed').length;
  const sameDay = rows.filter(o => o.sameDay).length;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(KpiTile, {
    label: "Egg demand",
    value: totalEggs.toLocaleString(),
    sub: `across ${rows.length} orders`,
    accent: "egg"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Confirmed",
    value: confirmed,
    sub: `of ${rows.length} orders`,
    accent: "fg"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Same-day",
    value: sameDay,
    sub: "needs early pickup",
    accent: "fmt"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Customers",
    value: new Set(rows.map(r => r.cust)).size,
    sub: "in this view",
    accent: "mat"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fafbfc',
      border: '1px solid #ecedf0',
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      background: '#fff',
      border: '1px solid #d6d8dc',
      borderRadius: 24,
      flex: '0 0 50%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#888',
      fontSize: 14
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 PO / SKU / \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u2026",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      fontSize: 13,
      background: 'transparent'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      fontWeight: 600,
      marginRight: 4
    }
  }, "Customer"), CUSTS.map(c => /*#__PURE__*/React.createElement(CustomerPill, {
    key: c,
    name: c === 'All' ? 'ทั่วไป' : c,
    variant: c === 'All' ? 'neutral' : 'solid',
    clickable: true,
    ring: cust === c,
    dim: cust !== 'All' && cust !== c,
    onClick: () => setCust(c)
  }, c)))), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: '0 6px',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ['PO / Item', 'Customer', 'Grade', 'Packaging', 'Deliver', 'Qty', 'Status'].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      fontWeight: 500,
      fontSize: 10,
      color: '#999',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      padding: '6px 12px 4px',
      textAlign: i >= 5 ? 'right' : 'left',
      borderBottom: '1px solid #ecedf0',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(o => {
    const isOpen = open === o.id;
    const cell = extra => ({
      background: isOpen ? '#f6f7f9' : '#fff',
      borderTop: '1px solid #d6d8dc',
      borderBottom: isOpen ? 'none' : '1px solid #d6d8dc',
      boxShadow: isOpen ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
      padding: '10px 12px',
      verticalAlign: 'middle',
      ...extra
    });
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: o.id
    }, /*#__PURE__*/React.createElement("tr", {
      onClick: () => setOpen(isOpen ? null : o.id),
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: cell({
        borderLeft: '1px solid #d6d8dc',
        borderRadius: isOpen ? '8px 0 0 0' : '8px 0 0 8px'
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 500
      }
    }, o.item, " ", o.sameDay && /*#__PURE__*/React.createElement("span", {
      style: {
        background: '#FAEEDA',
        color: '#854F0B',
        padding: '1px 6px',
        borderRadius: 8,
        fontSize: 9.5,
        fontWeight: 700,
        marginLeft: 4
      }
    }, "\u26A1 \u0E27\u0E31\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("code", {
      className: "cmk-code",
      style: {
        fontSize: 10.5
      }
    }, o.id))), /*#__PURE__*/React.createElement("td", {
      style: cell()
    }, /*#__PURE__*/React.createElement(CustomerPill, {
      name: o.cust
    })), /*#__PURE__*/React.createElement("td", {
      style: cell()
    }, /*#__PURE__*/React.createElement(SizePill, {
      grade: o.grade
    }, o.gradeT)), /*#__PURE__*/React.createElement("td", {
      style: cell()
    }, /*#__PURE__*/React.createElement(PackPill, {
      family: o.pack.f,
      count: o.pack.c
    }, o.pack.t)), /*#__PURE__*/React.createElement("td", {
      style: cell()
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: '#666'
      }
    }, o.deliver)), /*#__PURE__*/React.createElement("td", {
      style: cell({
        textAlign: 'right',
        fontWeight: 700,
        fontSize: 13
      })
    }, o.qty.toLocaleString()), /*#__PURE__*/React.createElement("td", {
      style: cell({
        textAlign: 'right',
        borderRight: '1px solid #d6d8dc',
        borderRadius: isOpen ? '0 8px 0 0' : '0 8px 8px 0'
      })
    }, /*#__PURE__*/React.createElement(StatusPill, {
      state: o.status
    }))), isOpen && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 7,
      style: {
        background: '#fafbfc',
        border: '1px solid #d6d8dc',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(EditorPanel, {
      o: o
    }))));
  }))));
}
window.OrdersScreen = OrdersScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/order_management/OrdersScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.BubbleTable = __ds_scope.BubbleTable;

__ds_ns.CUSTOMERS = __ds_scope.CUSTOMERS;

__ds_ns.SIZES = __ds_scope.SIZES;

__ds_ns.PACK = __ds_scope.PACK;

__ds_ns.DELIVERY = __ds_scope.DELIVERY;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.CustomerPill = __ds_scope.CustomerPill;

__ds_ns.DeliveryTypePill = __ds_scope.DeliveryTypePill;

__ds_ns.FilterChip = __ds_scope.FilterChip;

__ds_ns.PackPill = __ds_scope.PackPill;

__ds_ns.RoundChip = __ds_scope.RoundChip;

__ds_ns.SizePill = __ds_scope.SizePill;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.KpiTile = __ds_scope.KpiTile;

})();
