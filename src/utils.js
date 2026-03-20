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

export function cart(a) {
  if (!a.length) return [[]];
  return a.reduce((r, c) => r.flatMap(x => c.map(v => [...x, v])), [[]]);
}

export function bpk(w, a) {
  return w + "||" + Object.entries(a).sort((x, y) => x[0].localeCompare(y[0])).map(([k, v]) => `${k}:${v}`).join("||");
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
export function resolvePriceAttrs(woodId, attrs, cfg) {
  const wc = cfg?.[woodId];
  if (!wc?.attrPriceGroups) return attrs;
  const resolved = { ...attrs };
  for (const [atId, pg] of Object.entries(wc.attrPriceGroups)) {
    if (resolved[atId] != null) {
      const special = pg.special || [];
      resolved[atId] = special.includes(resolved[atId]) ? resolved[atId] : (pg.default || 'Chung');
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
  const dashMatch = str.match(/^([\d.]+)-([\d.]+)$/);
  let lo, hi;
  if (dashMatch) {
    lo = parseFloat(dashMatch[1]);
    hi = parseFloat(dashMatch[2]);
  } else {
    const single = parseFloat(str);
    if (isNaN(single)) return null;
    lo = hi = single;
  }
  const match = rangeGroups.find(g => {
    const okMin = g.min == null || lo >= g.min;
    const okMax = g.max == null || hi <= g.max;
    return okMin && okMax;
  });
  return match?.label ?? null;
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
  const oc = oa.length > 0
    ? cart(oa.map(ak => (cfg.attrValues[ak] || []).map(v => [ak, v]))).map(c => Object.fromEntries(c))
    : [{}];
  const fp = {};
  ta.forEach(t => {
    fp[t] = oc.map(c => {
      const p = prices[bpk(wk, { ...c, thickness: t })]?.price;
      return p ?? "N";
    }).join("|");
  });
  const gs = [];
  let cur = null;
  ta.forEach(t => {
    const f = fp[t];
    const has = f.replace(/N/g, "").replace(/\|/g, "").length > 0;
    if (cur && cur.fp === f && has) {
      cur.m.push(t);
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
