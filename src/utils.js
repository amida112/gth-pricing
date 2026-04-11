export const THEME = {
  "--bg": "#F5F0E8", "--bgc": "#FFF", "--bgh": "#FAF6F0", "--bgs": "#FDFBF7",
  "--tp": "#2D2016", "--ts": "#6B5B4E", "--tm": "#A89B8E",
  "--bd": "#E8DFD3", "--bds": "#D4C8B8",
  "--ac": "#F26522", "--acbg": "rgba(242,101,34,0.07)",
  "--br": "#5A3E2B", "--brl": "#7A5E4B", "--gn": "#324F27", "--dg": "#C0392B",
  "--hv": "rgba(242,101,34,0.04)",
  "--gbg": "rgba(139,92,246,0.06)", "--gbd": "rgba(139,92,246,0.15)", "--gtx": "#7C5CBF",
  "--sb": "#3B2718"
};

// ── Trạng thái hàng hóa container (auto-computed) ──────────────
// Dùng chung cho gỗ NL (raw_round, raw_box) và gỗ kiện (sawn)
export const INV_STATUS = {
  // Chung tất cả loại
  incoming:        { label: 'Sắp về',           color: '#7F8C8D',  bg: 'rgba(127,140,141,0.12)', short: 'Sắp về'      },
  on_order:        { label: 'Đang lên đơn',     color: '#8E44AD',  bg: 'rgba(142,68,173,0.12)',  short: 'Lên đơn'     },
  container_sold:  { label: 'Bán cont',          color: '#6B4226',  bg: 'rgba(107,66,38,0.12)',   short: 'Bán cont'    },
  not_inspected:   { label: 'Chưa nghiệm thu',  color: '#A89B8E',  bg: 'rgba(168,155,142,0.12)', short: 'Chưa NT'     },
  // Gỗ NL (raw_round, raw_box)
  landed:          { label: 'Đã hạ bãi',          color: '#16A085',  bg: 'rgba(22,160,133,0.12)',  short: 'Hạ bãi'      },
  ready:           { label: 'Sẵn sàng',          color: '#324F27',  bg: 'rgba(50,79,39,0.12)',    short: 'Sẵn sàng'    },
  partial:         { label: 'Còn lẻ',            color: '#D4A017',  bg: 'rgba(212,160,23,0.12)',  short: 'Còn lẻ'      },
  all_sawn:        { label: 'Đã xẻ hết',         color: '#2980b9',  bg: 'rgba(41,128,185,0.12)',  short: 'Đã xẻ hết'  },
  all_sold:        { label: 'Bán lẻ hết',         color: '#6B4226',  bg: 'rgba(107,66,38,0.12)',   short: 'Bán lẻ hết' },
  sawn_sold:       { label: 'Xẻ+bán hết',        color: '#7C5CBF',  bg: 'rgba(124,92,191,0.12)', short: 'Xẻ+bán'     },
  // Gỗ kiện (sawn)
  importing:       { label: 'Đang nhập kho',     color: '#2980b9',  bg: 'rgba(41,128,185,0.12)',  short: 'Đang NK'     },
  imported:        { label: 'Đã nhập kho',        color: '#324F27',  bg: 'rgba(50,79,39,0.12)',    short: 'Đã NK'       },
  // Legacy compat
  no_inspection:   { label: 'Chưa nghiệm thu',  color: '#A89B8E',  bg: 'rgba(168,155,142,0.12)', short: 'Chưa NT'     },
};

/**
 * Auto-computed cargo status cho container
 * @param {object} opts
 * @param {object} opts.container - container object (cargoType, dispatchStatus, ...)
 * @param {object} opts.inspSummary - {total, available, sawn, sold, on_order} từ raw_wood_inspection (nullable)
 * @param {boolean} opts.hasContainerOrder - có order_item type='container' trỏ đến cont này
 * @param {boolean} opts.orderExported - đơn nguyên cont đã xuất
 * @param {number} opts.bundleCount - số kiện đã nhập (cho gỗ kiện sawn)
 * @param {number} opts.declaredPieces - số kiện khai báo trong container_items (cho gỗ kiện sawn)
 */
export function getCargoStatus({ container, inspSummary, hasContainerOrder, orderExported, bundleCount, declaredPieces } = {}) {
  if (!container) return 'incoming';
  const dispatched = container.dispatchStatus === 'dispatched';
  const isSawn = container.cargoType === 'sawn';

  // Bán nguyên cont — đã xuất
  if (hasContainerOrder && orderExported) return 'container_sold';
  // Đang lên đơn nguyên cont — chưa xuất
  if (hasContainerOrder) return 'on_order';

  // Chưa dispatch → sắp về
  if (!dispatched) return 'incoming';

  // === Gỗ kiện (sawn): dispatch → chưa NT → đang NK → đã NK ===
  if (isSawn) {
    const bc = bundleCount || 0;
    const dp = declaredPieces || 0;
    if (bc === 0) return 'not_inspected';
    if (dp > 0 && bc < dp) return 'importing';
    return 'imported';
  }

  // === Gỗ NL (raw_round, raw_box): dispatch → chưa NT → đã hạ bãi/sẵn sàng → ... ===
  // Gỗ tròn tấn: nghiệm thu = cân lại (actual_weight), không có inspection từng cây
  if (container.weightUnit === 'ton') {
    if (!container.actualWeight) return 'not_inspected';
    const rv = container.remainingVolume, tv = container.totalVolume;
    if (rv != null && tv != null && rv < tv) return rv <= 0 ? 'all_sold' : 'partial';
    return 'landed'; // Đã hạ bãi — đã cân, sẵn sàng xẻ/bán
  }
  // Gỗ NL m³: nghiệm thu = inspection từng cây
  const insp = inspSummary;
  if (!insp || insp.total === 0) return 'not_inspected';
  const { available, on_order = 0, sawn = 0, sold = 0, total } = insp;
  if (available === total && on_order === 0)  return 'ready';
  if (sold === total)                          return 'all_sold';
  if (sawn === total)                          return 'all_sawn';
  if (available === 0 && on_order === 0)       return 'sawn_sold';
  if (on_order > 0)                            return 'on_order';
  if (available < total)                       return 'partial';
  return 'ready';
}

// Legacy compat — các page cũ gọi hàm này, delegate sang getCargoStatus
export function getContainerInvStatus(insp, container) {
  return getCargoStatus({ container, inspSummary: insp });
}

// ── Format helpers — dùng chung toàn app ──────────────────────
/** Format ngày: dd/mm/yyyy (đầy đủ) hoặc dd/mm (chỉ ngày tháng) */
export function fmtDate(d, { yearOff } = {}) {
  if (!d) return "";
  const dt = new Date(typeof d === "string" && d.length === 10 ? d + "T00:00:00" : d);
  if (isNaN(dt)) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  if (yearOff) return `${dd}/${mm}`;
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

/** Format tiền VNĐ có dấu ngăn cách hàng nghìn */
export function fmtMoney(v) {
  if (v == null || v === "" || v === 0) return "0";
  return Number(v).toLocaleString("vi-VN");
}

/** Format tiền rút gọn cho dashboard (tỷ/tr) */
export function fmtMoneyShort(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1e9) return (v / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ";
  if (v >= 1e6) return (v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr";
  return v.toLocaleString("vi-VN") + " đ";
}

/** Format ngày giờ: dd/mm/yyyy HH:mm */
export function fmtDateTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()} ${hh}:${mi}`;
}

export function cart(a) {
  if (!a.length) return [[]];
  return a.reduce((r, c) => r.flatMap(x => c.map(v => [...x, v])), [[]]);
}

export function bpk(w, a) {
  return w + "||" + Object.entries(a).sort((x, y) => x[0].localeCompare(y[0])).map(([k, v]) => `${k}:${v}`).join("||");
}

/**
 * Normalize + validate giá trị thickness cho auto mode.
 * @param {string} raw - Giá trị người dùng nhập (VD: "2.5", "2,5", "2.50F", "02")
 * @returns {{ value: string|null, error: string|null }} - value = "2.5F" hoặc null nếu lỗi
 */
export function normalizeThickness(raw) {
  if (!raw || !String(raw).trim()) return { value: null, error: 'Bắt buộc nhập' };
  let s = String(raw).trim().replace(/,/g, '.').replace(/\s+/g, ''); // "2,5" → "2.5"
  // Bỏ suffix F/f nếu có
  if (/f$/i.test(s)) s = s.slice(0, -1);
  // Kiểm tra là số dương
  if (!/^[\d]+\.?[\d]*$/.test(s)) return { value: null, error: 'Chỉ nhập số (VD: 2.5)' };
  const num = parseFloat(s);
  if (isNaN(num) || num <= 0) return { value: null, error: 'Phải là số dương > 0' };
  if (num > 50) return { value: null, error: 'Giá trị quá lớn (>50)' };
  // Normalize: bỏ trailing zeros, bỏ leading zeros
  const normalized = String(parseFloat(s)); // "2.50" → "2.5", "02" → "2"
  return { value: normalized + 'F', error: null };
}

// Kiểm tra loại gỗ có dùng định giá per-bundle không (ví dụ: Thông nhập khẩu)
export function isPerBundle(woodId, wts) {
  return wts?.find(w => w.id === woodId)?.pricingMode === 'perBundle';
}

// Kiểm tra loại gỗ tính theo m² (ví dụ: Thông ốp)
export function isM2Wood(woodId, wts) {
  return wts?.find(w => w.id === woodId)?.unit === 'm2';
}

// Trả về danh sách giá trị dùng trong bảng giá cho 1 attribute:
// Nếu attr có attrPriceGroups → trả về [special..., default]; ngược lại → attrValues gốc
export function getPriceGroupValues(atId, wc) {
  const pg = wc?.attrPriceGroups?.[atId];
  if (!pg) return wc?.attrValues?.[atId] || [];
  return [...(pg.special || []), pg.default || 'Chung'];
}

// Map giá trị thực của bundle attrs → price group labels trước khi gọi bpk()
// Chỉ giữ lại configured attrs để bpk key nhất quán với prices lookup
export function resolvePriceAttrs(woodId, attrs, cfg) {
  const wc = cfg?.[woodId];
  const base = wc?.attrs
    ? Object.fromEntries(Object.entries(attrs || {}).filter(([k]) => wc.attrs.includes(k)))
    : { ...attrs };
  const resolved = { ...base };
  // Resolve rangeGroup attrs về group label (vd: thickness "1.6" → "1.5F")
  // Attrs lưu actual (groupable) cần resolve; attrs lưu label (length) resolve lại chính nó → no-op
  if (wc?.rangeGroups) {
    for (const [atId, rg] of Object.entries(wc.rangeGroups)) {
      if (resolved[atId] != null && rg?.length) {
        const gl = resolveRangeGroup(String(resolved[atId]), rg);
        if (gl) resolved[atId] = gl;
      }
    }
  }
  // Resolve aliases (vd: "A" → "Đẹp", "19-29" → "20-29")
  if (wc?.attrAliases) {
    for (const [atId, aliasMap] of Object.entries(wc.attrAliases)) {
      if (resolved[atId] != null && aliasMap) {
        const hit = Object.entries(aliasMap).find(([, als]) => als?.includes(resolved[atId]));
        if (hit) resolved[atId] = hit[0];
      }
    }
  }
  // Resolve attrPriceGroups (supplier → nhóm giá)
  if (wc?.attrPriceGroups) {
    for (const [atId, pg] of Object.entries(wc.attrPriceGroups)) {
      if (resolved[atId] != null) {
        const special = pg.special || [];
        resolved[atId] = special.includes(resolved[atId]) ? resolved[atId] : (pg.default || 'Chung');
      }
    }
  }
  return resolved;
}

/**
 * Phân giải giá trị chiều dài thực tế thành nhãn nhóm giá dựa trên rangeGroups.
 *
 * @param {string} rawVal  - Giá trị đo thực: "1.6-1.9" (khoảng) hoặc "2.5" (đơn)
 * @param {Array}  rangeGroups - Mảng {label, min?, max?} từ attribute definition
 * @returns {string|null}  - Nhãn nhóm khớp, hoặc null nếu không khớp
 *
 * Ví dụ:
 *   resolveRangeGroup("1.6-1.9", [{label:"*-1.9m",max:1.9}, ...]) → "*-1.9m"
 *   resolveRangeGroup("2.2-2.7", [{label:"*-2.5m",min:1.9,max:2.5}, ...]) → null (2.7 > 2.5)
 *   resolveRangeGroup("2.5",     [{label:"*-2.5m",min:1.9,max:2.5}, ...]) → "*-2.5m"
 */
export function resolveRangeGroup(rawVal, rangeGroups) {
  if (!rangeGroups?.length || rawVal == null || rawVal === '') return null;
  const str = String(rawVal).trim().replace(/m$/i, ''); // bỏ hậu tố "m" nếu có

  // Bước 1: khớp label trực tiếp (case-insensitive)
  const labelMatch = rangeGroups.find(g => g.label.toLowerCase() === str.toLowerCase());
  if (labelMatch) return labelMatch.label;

  // Bước 2: parse số
  const dashMatch = str.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  let lo, hi;
  if (dashMatch) {
    lo = parseFloat(dashMatch[1]);
    hi = parseFloat(dashMatch[2]);
  } else {
    const single = parseFloat(str);
    if (isNaN(single)) return null;
    lo = hi = single;
  }

  // Lọc nhóm text-only (cả min lẫn max trống) — chỉ khớp qua label matching ở trên
  const numericGroups = rangeGroups.filter(g =>
    (g.min != null && g.min !== '') || (g.max != null && g.max !== '')
  );

  // Lo-based mode: khi có ít nhất 1 nhóm số không có max (nhóm "X trở lên")
  // → tìm nhóm có min lớn nhất ≤ lo (nearest lower bound)
  const hasOpenEnded = numericGroups.some(g => g.max == null || g.max === '');
  if (hasOpenEnded) {
    const sorted = numericGroups
      .map(g => ({ label: g.label, min: (g.min != null && g.min !== '') ? parseFloat(g.min) : -Infinity }))
      .sort((a, b) => b.min - a.min); // giảm dần theo min
    const match = sorted.find(g => lo >= g.min);
    return match?.label ?? null;
  }

  // Fit-based mode (mặc định): toàn bộ range phải nằm trong 1 nhóm
  const isRange = lo !== hi;
  const match = numericGroups.find(g => {
    const minVal = (g.min != null && g.min !== '') ? parseFloat(g.min) : null;
    const maxVal = (g.max != null && g.max !== '') ? parseFloat(g.max) : null;
    const okMin = minVal === null || lo >= minVal;
    // Range input (lo ≠ hi): max phải được định nghĩa và hi phải ≤ max
    // Single input (lo = hi): null max = không giới hạn trên
    const okMax = isRange ? (maxVal !== null && hi <= maxVal) : (maxVal === null || hi <= maxVal);
    return okMin && okMax;
  });
  return match?.label ?? null;
}

/**
 * Resolve alias: trả về chip chính nếu val là bí danh, nguyên val nếu không.
 * attrAliases = { "20-29": ["19-29","23-29"], "<20": ["8-14"] }
 */
export function resolveAlias(val, attrAliases) {
  if (!attrAliases || val == null) return val;
  const s = String(val).trim();
  // val đã là chip chính → trả nguyên
  if (attrAliases[s]) return s;
  // Tìm trong aliases
  for (const [chip, aliases] of Object.entries(attrAliases)) {
    if (aliases?.some(a => a === s)) return chip;
  }
  return s;
}

/**
 * Resolve tất cả attrs của bundle qua alias config.
 * Trả về object attrs mới với giá trị đã resolve.
 */
export function resolveAttrsAlias(attrs, woodCfg) {
  if (!woodCfg?.attrAliases || !attrs) return attrs;
  const result = { ...attrs };
  for (const [atId, aliasMap] of Object.entries(woodCfg.attrAliases)) {
    if (result[atId] != null) {
      result[atId] = resolveAlias(result[atId], aliasMap);
    }
  }
  return result;
}

export function autoGrpLength(wk, cfg, prices) {
  const la = cfg.attrValues?.length;
  if (!la || la.length === 0) return null;
  const oa = cfg.attrs.filter(a => a !== "length");
  const oc = oa.length > 0
    ? cart(oa.map(ak => (cfg.attrValues[ak] || []).map(v => [ak, v]))).map(c => Object.fromEntries(c))
    : [{}];
  // Price fingerprint per length value
  const fp = {};
  la.forEach(l => {
    fp[l] = oc.map(c => {
      const p = prices[bpk(wk, { ...c, length: l })]?.price;
      return p ?? "N";
    }).join("|");
  });
  const assigned = new Set();
  const groups = [];
  la.forEach(val => {
    if (assigned.has(val)) return;
    const valFp = fp[val];
    const hasPrice = valFp.replace(/N/g, "").replace(/\|/g, "").length > 0;
    const members = [val];
    assigned.add(val);
    if (hasPrice) {
      la.forEach(other => {
        if (assigned.has(other)) return;
        const otherFp = fp[other];
        if (otherFp.replace(/N/g, "").replace(/\|/g, "").length === 0 || otherFp !== valFp) return;
        if (val.slice(0, 3) === other.slice(0, 3) || val.slice(-3) === other.slice(-3)) {
          members.push(other); assigned.add(other);
        }
      });
    }
    let label;
    if (members.length === 1) {
      label = members[0];
    } else {
      const allSamePre = members.every(v => v.slice(0, 3) === val.slice(0, 3));
      const allSameSuf = members.every(v => v.slice(-3) === val.slice(-3));
      if (allSamePre) label = val.slice(0, 3) + 'm+';
      else if (allSameSuf) label = val.slice(-3) + '+';
      else label = members[0] + '+';
    }
    groups.push({ label, members });
  });
  return groups;
}

export function autoGrp(wk, cfg, prices) {
  const ta = cfg.attrValues?.thickness;
  if (!ta) return null;
  const oa = cfg.attrs.filter(a => a !== "thickness");
  // Attrs optional (width): thêm null option để tính luôn giá ở cột "Bình thường" (no-width)
  const OPTIONAL = new Set(['width']);
  const oc = oa.length > 0
    ? cart(oa.map(ak => {
        const vals = getPriceGroupValues(ak, cfg).map(v => [ak, v]);
        return OPTIONAL.has(ak) ? [[ak, null], ...vals] : vals;
      })).map(c => Object.fromEntries(c))
    : [{}];
  const fp = {};
  ta.forEach(t => {
    fp[t] = oc.map(c => {
      // Loại bỏ null values khi build key (optional attr không có width = không có key width trong bpk)
      const keyAttrs = Object.fromEntries(Object.entries({ ...c, thickness: t }).filter(([, v]) => v != null));
      const p = prices[bpk(wk, keyAttrs)]?.price;
      return p ?? "N";
    }).join("|");
  });
  // So sánh 2 fingerprint:
  // - Cả 2 có giá → phải bằng nhau
  // - 1 bên all-N (chưa có giá) → khớp với bất kỳ (wildcard toàn phần)
  // - Giá ở vị trí không giao nhau (A có giá, B null và ngược lại) → không đủ cơ sở gộp
  const isAllN = (s) => s.split("|").every(v => v === "N");
  const fpMatch = (a, b) => {
    if (isAllN(a) || isAllN(b)) return true; // 1 bên chưa có giá → gộp
    const aa = a.split("|"), bb = b.split("|");
    if (aa.length !== bb.length) return false;
    let hasOverlap = false;
    for (let i = 0; i < aa.length; i++) {
      const av = aa[i], bv = bb[i];
      if (av !== "N" && bv !== "N") {
        if (av !== bv) return false; // cả 2 có giá nhưng khác nhau
        hasOverlap = true;
      }
    }
    return hasOverlap; // phải có ít nhất 1 vị trí cả 2 đều có giá và bằng nhau
  };
  const gs = [];
  let cur = null;
  ta.forEach(t => {
    const f = fp[t];
    if (cur && fpMatch(cur.fp, f)) {
      cur.m.push(t);
      // Cập nhật fp nhóm: ưu tiên giá trị thực thay vì N (để nhóm tiếp theo so sánh đúng)
      const curParts = cur.fp.split("|"), fParts = f.split("|");
      cur.fp = curParts.map((v, i) => v === "N" ? fParts[i] : v).join("|");
    } else {
      cur = { m: [t], fp: f };
      gs.push(cur);
    }
  });
  return gs.map(g => ({
    label: g.m.length === 1 ? g.m[0] : g.m[0] + " – " + g.m[g.m.length - 1],
    members: g.m
  }));
}

export const initWT = () => [
  { id: "walnut", name: "Óc Chó", nameEn: "Walnut", icon: "🟤" },
  { id: "red_oak", name: "Sồi Đỏ", nameEn: "Red Oak", icon: "🔴" },
  { id: "white_oak", name: "Sồi Trắng", nameEn: "White Oak", icon: "⚪" },
  { id: "ash", name: "Tần Bì", nameEn: "Ash", icon: "🟡" },
  { id: "pachyloba", name: "Pachy", nameEn: "Pachyloba", icon: "🟠" },
  { id: "beech", name: "Beech", nameEn: "Beech", icon: "🪵" },
  { id: "pine", name: "Thông nhập khẩu", nameEn: "Pine", icon: "🌲", pricingMode: "perBundle" }
];

export const initAT = () => [
  { id: "thickness", name: "Độ dày", values: ["2F", "2.2F", "2.5F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], groupable: true },
  { id: "quality", name: "Chất lượng", values: ["BC", "ABC", "AB", "AAB", "Xô", "Đẹp", "Thường", "Fas", "1com Missouri", "2com Missouri"], groupable: false },
  { id: "edging", name: "Dong cạnh", values: ["Chưa dong", "Dong cạnh", "Âu chưa dong", "Âu đã dong", "Mỹ"], groupable: false },
  { id: "length", name: "Độ dài", values: ["1.6-1.9m", "1.9-2.5m", "2.8-4.9m"], groupable: false },
  { id: "supplier", name: "Nhà cung cấp", values: ["Missouri", "Âu", "Mỹ"], groupable: false },
  { id: "width", name: "Độ rộng", values: ["Tiêu chuẩn", "Rộng"], groupable: false }
];

export const initCFG = () => ({
  ash: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.5F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], quality: ["BC", "ABC", "AB", "AAB"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  red_oak: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], quality: ["BC", "ABC", "AB", "AAB"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  white_oak: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "5F", "5.1F"], quality: ["BC", "ABC", "AB"], edging: ["Âu chưa dong", "Âu đã dong", "Mỹ"] }, defaultHeader: ["edging"] },
  pachyloba: { attrs: ["thickness", "quality"], attrValues: { thickness: ["2F", "2.2F", "2.5F", "3F", "3.5F", "4F", "4.5F", "6F", "8F"], quality: ["Xô", "Đẹp"] }, defaultHeader: ["quality"] },
  beech: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F"], quality: ["Thường", "Đẹp"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  walnut: { attrs: ["thickness", "quality", "length"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F"], quality: ["2com Missouri", "1com Missouri", "Fas"], length: ["1.6-1.9m", "1.9-2.5m", "2.8-4.9m"] }, rangeGroups: { length: [{ label: "1.6-1.9m", min: 1.6, max: 1.9 }, { label: "1.9-2.5m", min: 1.9, max: 2.5 }, { label: "2.8-4.9m", min: 2.8, max: 4.9 }] }, defaultHeader: ["length"] },
  pine: { attrs: ["quality", "thickness", "width", "length"], attrValues: { quality: ["2COM", "2COM-S4S"], thickness: ["38", "51"], width: ["140", "184", "235", "305"], length: ["4900"] }, defaultHeader: ["width"] }
});

// ── Dịch vụ ────────────────────────────────────────────────────────────────

export const DEFAULT_CARRIERS = [];

// Cấu hình bảng giá Xẻ sấy — admin chỉnh sửa, nhân viên tra cứu khi lên đơn
export const DEFAULT_XE_SAY_CONFIG = {
  teak: {
    description: 'Gỗ cứng phải xẻ bằng hợp kim và sấy dài ngày, áp dụng cho gỗ tròn/hộp.',
    basePrice: 1500000,
    adjustments: [
      { id: 'ta1', label: 'Tỷ lệ 1.5F >50% hoặc pha thành khí (xẻ nhiều mỏng + chốt + lật)', delta: 200000 },
    ],
  },
  thong: {
    rows: [
      { id: 1, spec: '≥2F',                          price: 1000000 },
      { id: 2, spec: '1.2–1.5F (15–35% ván mỏng)',   price: 1100000 },
      { id: 3, spec: '1.2–1.5F (35–70% ván mỏng)',   price: 1200000 },
      { id: 4, spec: '1.2–1.5F (70–100% ván mỏng)',  price: 1300000 },
    ],
    adjustments: [
      { id: 'a1', label: 'Bổ nhống (không chốt cạnh)',  delta: -100000 },
      { id: 'a2', label: 'Khách mua gỗ của công ty',    delta:  -50000 },
    ],
  },
  mem: {
    rows: [
      { id: 1, spec: '≥2F',                          price:  900000 },
      { id: 2, spec: '1.2–1.5F (15–35% ván mỏng)',   price: 1000000 },
      { id: 3, spec: '1.2–1.5F (35–70% ván mỏng)',   price: 1100000 },
      { id: 4, spec: '1.2–1.5F (70–100% ván mỏng)',  price: 1200000 },
    ],
    adjustments: [
      { id: 'a1', label: 'Bổ nhống (không chốt cạnh)',  delta: -100000 },
      { id: 'a2', label: 'Khách mua gỗ của công ty',    delta:  -50000 },
    ],
  },
};

export function calcSvcAmount(s) {
  switch (s.type) {
    case 'xe_say':  return Math.round((parseFloat(s.unitPrice) || 0) * (parseFloat(s.volume) || 0));
    case 'luoc_go': return Math.round(1000000 * (parseFloat(s.volume) || 0));
    case 'other':
      if (s.otherMode === 'perM3') return Math.round((parseFloat(s.unitPrice) || 0) * (parseFloat(s.volume) || 0));
      return parseFloat(s.amount) || 0;
    default:        return parseFloat(s.amount) || 0;
  }
}

export function svcLabel(s) {
  switch (s.type) {
    case 'xe_say': {
      const vol = parseFloat(s.volume) || 0;
      const up  = parseFloat(s.unitPrice) || 0;
      return `Xẻ sấy × ${vol.toFixed(4)}m³${up ? ' × ' + up.toLocaleString('vi-VN') + 'đ/m³' : ''}`;
    }
    case 'luoc_go':    return `Luộc gỗ × ${(parseFloat(s.volume)||0).toFixed(4)}m³`;
    case 'van_chuyen':
      return `Vận tải${s.carrierName ? ' — ' + s.carrierName : ''}`;
    case 'other': {
      const desc = s.description || 'Dịch vụ khác';
      if (s.otherMode === 'perM3') {
        const vol = parseFloat(s.volume) || 0;
        const up = parseFloat(s.unitPrice) || 0;
        return `${desc} × ${vol.toFixed(4)}m³${up ? ' × ' + up.toLocaleString('vi-VN') + 'đ/m³' : ''}`;
      }
      return desc;
    }
    default: return s.description || 'Dịch vụ khác';
  }
}

export const genPrices = () => {
  const P = {};
  const r1 = v => Math.round(v * 10) / 10;
  ["BC", "ABC", "AB", "AAB"].forEach(q => {
    ["Chưa dong", "Dong cạnh"].forEach(e => {
      const b = 14.5 + (q === "AB" ? 2 : q === "AAB" ? 3.5 : q === "ABC" ? 1 : 0) + (e === "Dong cạnh" ? 1.5 : 0);
      [["2F", b], ["2.2F", b], ["2.5F", b + 0.6], ["2.6F", b + 0.6], ["3.2F", b + 2.2], ["3.8F", b + 2.8], ["4.5F", b + 5.6], ["5.1F", b + 5.6], ["6F", b + 4]].forEach(([t, p]) => {
        P[bpk("ash", { thickness: t, quality: q, edging: e })] = { price: r1(p), updated: "2026-03-11" };
      });
    });
  });
  ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"].forEach(t => {
    ["BC", "ABC", "AB", "AAB"].forEach(q => {
      ["Chưa dong", "Dong cạnh"].forEach(e => {
        const p = r1(9.2 + (q === "ABC" ? 2 : q === "AB" ? 4.5 : q === "AAB" ? 6 : 0) + parseFloat(t) * 0.8 + (e === "Dong cạnh" ? 1.5 : 0));
        P[bpk("red_oak", { thickness: t, quality: q, edging: e })] = { price: p, updated: "2026-03-11" };
      });
    });
  });
  ["2F", "2.2F", "2.5F", "3F", "3.5F", "4F", "4.5F", "6F", "8F"].forEach(t => {
    ["Xô", "Đẹp"].forEach(q => {
      const n = parseFloat(t);
      const b = n <= 2.5 ? 39.9 : n <= 3.5 ? 44.9 : n <= 4.5 ? 45.9 : 44.9;
      P[bpk("pachyloba", { thickness: t, quality: q })] = { price: r1(b + (q === "Đẹp" ? 16 : 0)), updated: "2026-01-26" };
    });
  });
  return P;
};

/**
 * Kiểm tra config issues cho mỗi loại gỗ.
 * Trả về { [woodId]: { orphanAttrs: [{atId, values}], rangeGaps: [{atId, msg}], total } }
 */
export function getConfigIssues(cfg, bundles, wts, ats) {
  const result = {};
  for (const w of (wts || [])) {
    const wc = cfg?.[w.id];
    if (!wc || !wc.attrs?.length) continue;
    const issues = { orphanAttrs: [], rangeGaps: [], total: 0 };
    const woodBundles = (bundles || []).filter(b => (b.woodId || b.wood_id) === w.id && b.status !== 'Đã bán');

    for (const atId of wc.attrs) {
      // Skip thickness auto + supplier (đồng bộ tự động)
      const isAutoTh = atId === 'thickness' && w.thicknessMode === 'auto';
      const isSupplier = atId === 'supplier';
      const selVals = wc.attrValues?.[atId] || [];
      const atDef = (ats || []).find(a => a.id === atId);

      // 1. Orphan values (thiếu alias)
      if (!isAutoTh && !isSupplier && selVals.length > 0) {
        const validSet = new Set(selVals);
        const aliasMap = wc.attrAliases?.[atId] || {};
        Object.values(aliasMap).forEach(als => als?.forEach(a => validSet.add(a)));
        const orphans = new Set();
        woodBundles.forEach(b => {
          const v = b.attributes?.[atId];
          if (v && !validSet.has(v)) orphans.add(v);
        });
        if (orphans.size > 0) {
          issues.orphanAttrs.push({ atId, values: [...orphans] });
          issues.total += orphans.size;
        }
      }

      // 2. Kiện ngoài khoảng chưa được gán nhãn hợp lệ (chỉ notify khi cần action)
      const rg = wc.rangeGroups?.[atId];
      if (rg?.length && !atDef?.groupable) {
        const validLabels = new Set(selVals);
        let unassignedCount = 0;
        woodBundles.forEach(b => {
          const raw = b.rawMeasurements?.[atId];
          const assigned = b.attributes?.[atId];
          if (raw) {
            const resolved = resolveRangeGroup(raw, rg);
            // Ngoài khoảng VÀ nhãn đang gán không thuộc chip hợp lệ → cần xử lý
            if (!resolved && !validLabels.has(assigned)) unassignedCount++;
          } else if (assigned && !validLabels.has(assigned)) {
            unassignedCount++;
          }
        });
        if (unassignedCount > 0) {
          if (!issues.outOfRange) issues.outOfRange = [];
          issues.outOfRange.push({ atId, count: unassignedCount });
          issues.total += unassignedCount;
        }
      }
    }
    if (issues.total > 0) result[w.id] = issues;
  }
  return result;
}

/* ── Realtime helpers ── */
export function debouncedCallback(fn, delay = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
