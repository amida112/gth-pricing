import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

const THEME = {
  "--bg": "#F5F0E8", "--bgc": "#FFF", "--bgh": "#FAF6F0", "--bgs": "#FDFBF7",
  "--tp": "#2D2016", "--ts": "#6B5B4E", "--tm": "#A89B8E",
  "--bd": "#E8DFD3", "--bds": "#D4C8B8",
  "--ac": "#F26522", "--acbg": "rgba(242,101,34,0.07)",
  "--br": "#5A3E2B", "--brl": "#7A5E4B", "--gn": "#324F27", "--dg": "#C0392B",
  "--hv": "rgba(242,101,34,0.04)",
  "--gbg": "rgba(139,92,246,0.06)", "--gbd": "rgba(139,92,246,0.15)", "--gtx": "#7C5CBF",
  "--sb": "#3B2718"
};

function cart(a) {
  if (!a.length) return [[]];
  return a.reduce((r, c) => r.flatMap(x => c.map(v => [...x, v])), [[]]);
}

function bpk(w, a) {
  return w + "||" + Object.entries(a).sort((x, y) => x[0].localeCompare(y[0])).map(([k, v]) => `${k}:${v}`).join("||");
}

function autoGrp(wk, cfg, prices) {
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

const initWT = () => [
  { id: "walnut", name: "Óc Chó", nameEn: "Walnut", icon: "🟤" },
  { id: "red_oak", name: "Sồi Đỏ", nameEn: "Red Oak", icon: "🔴" },
  { id: "white_oak", name: "Sồi Trắng", nameEn: "White Oak", icon: "⚪" },
  { id: "ash", name: "Tần Bì", nameEn: "Ash", icon: "🟡" },
  { id: "pachyloba", name: "Pachy", nameEn: "Pachyloba", icon: "🟠" },
  { id: "beech", name: "Beech", nameEn: "Beech", icon: "🪵" },
  { id: "pine", name: "Thông", nameEn: "Pine", icon: "🌲" }
];

const initAT = () => [
  { id: "thickness", name: "Độ dày", values: ["2F", "2.2F", "2.5F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], groupable: true },
  { id: "quality", name: "Chất lượng", values: ["BC", "ABC", "AB", "AAB", "Xô", "Đẹp", "Thường", "Fas", "1com Missouri", "2com Missouri"], groupable: false },
  { id: "edging", name: "Dong cạnh", values: ["Chưa dong", "Dong cạnh", "Âu chưa dong", "Âu đã dong", "Mỹ"], groupable: false },
  { id: "length", name: "Độ dài", values: ["1.6-1.9m", "1.9-2.5m", "2.8-4.9m"], groupable: false },
  { id: "supplier", name: "Nhà cung cấp", values: ["Missouri", "Âu", "Mỹ"], groupable: false },
  { id: "width", name: "Độ rộng", values: ["Tiêu chuẩn", "Rộng"], groupable: false }
];

const initCFG = () => ({
  ash: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.5F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], quality: ["BC", "ABC", "AB", "AAB"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  red_oak: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F", "6F"], quality: ["BC", "ABC", "AB", "AAB"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  white_oak: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "5F", "5.1F"], quality: ["BC", "ABC", "AB"], edging: ["Âu chưa dong", "Âu đã dong", "Mỹ"] }, defaultHeader: ["edging"] },
  pachyloba: { attrs: ["thickness", "quality"], attrValues: { thickness: ["2F", "2.2F", "2.5F", "3F", "3.5F", "4F", "4.5F", "6F", "8F"], quality: ["Xô", "Đẹp"] }, defaultHeader: ["quality"] },
  beech: { attrs: ["thickness", "quality", "edging"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F"], quality: ["Thường", "Đẹp"], edging: ["Chưa dong", "Dong cạnh"] }, defaultHeader: ["quality"] },
  walnut: { attrs: ["thickness", "quality", "length"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "5.1F"], quality: ["2com Missouri", "1com Missouri", "Fas"], length: ["1.6-1.9m", "1.9-2.5m", "2.8-4.9m"] }, defaultHeader: ["length"] },
  pine: { attrs: ["thickness", "quality"], attrValues: { thickness: ["2F", "2.2F", "2.6F", "3.2F", "3.8F", "4.5F", "6F"], quality: ["Thường", "Đẹp"] }, defaultHeader: ["quality"] }
});

const genPrices = () => {
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

function Sidebar({ pg, setPg, role, setRole, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [groupOpen, setGroupOpen] = useState({ "KINH DOANH": true, "DANH MỤC": true });

  const menu = [
    { group: "KINH DOANH", items: [{ id: "pricing", ic: "📊", lb: "Bảng giá" }] },
    { group: "DANH MỤC", items: [
      { id: "wood_types", ic: "🌳", lb: "Loại gỗ" },
      { id: "attributes", ic: "📋", lb: "Thuộc tính" },
      { id: "config", ic: "⚙️", lb: "Cấu hình" },
      { id: "sku", ic: "🏷️", lb: "SKU" }
    ] }
  ];

  const toggleGroup = (g) => setGroupOpen(p => ({ ...p, [g]: !p[g] }));

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && <div className="mob-overlay" onClick={onMobileClose} />}

      <div className={"sidebar" + (mobileOpen ? " mob-open" : "")} style={{ width: collapsed ? 52 : 200, minHeight: "100vh", background: "var(--sb)", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s ease", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, justifyContent: collapsed ? "center" : "space-between", minHeight: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0 }}>G</div>
            {!collapsed && <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FAF6F0", whiteSpace: "nowrap" }}>GTH Pricing</div>}
          </div>
          {!collapsed && (
            <button className="sb-collapse-btn" onClick={() => setCollapsed(true)} title="Thu gọn" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "0.8rem", padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}>◀</button>
          )}
          {/* Nút đóng drawer trên mobile */}
          <button className="sb-close-btn" onClick={onMobileClose} style={{ display: "none", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "1.1rem", padding: "4px 6px", lineHeight: 1, marginLeft: "auto" }}>✕</button>
        </div>

        {/* Expand button khi collapsed */}
        {collapsed && (
          <button className="sb-expand-btn" onClick={() => setCollapsed(false)} title="Mở rộng" style={{ margin: "8px auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "0.8rem", padding: "4px", borderRadius: 4, display: "block" }}>▶</button>
        )}

        {/* Menu */}
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
          {menu.map(g => {
            const open = groupOpen[g.group] !== false;
            return (
              <div key={g.group} style={{ marginBottom: 4 }}>
                {/* Group header */}
                {!collapsed ? (
                  <button onClick={() => toggleGroup(g.group)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px 16px", background: "transparent", border: "none", cursor: "pointer", marginBottom: 2 }}>
                    <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.group}</span>
                    <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
                  </button>
                ) : (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 8px" }} />
                )}

                {/* Menu items */}
                {(collapsed || open) && g.items.map(it => {
                  const active = pg === it.id;
                  return (
                    <button key={it.id} onClick={() => { setPg(it.id); onMobileClose?.(); }} title={collapsed ? it.lb : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: collapsed ? "10px 0" : "8px 16px", justifyContent: collapsed ? "center" : "flex-start", background: active ? "rgba(242,101,34,0.15)" : "transparent", border: "none", borderLeft: collapsed ? "none" : (active ? "3px solid var(--ac)" : "3px solid transparent"), borderRight: collapsed && active ? "3px solid var(--ac)" : "none", color: active ? "#FAF6F0" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: collapsed ? "1rem" : "0.78rem", fontWeight: active ? 700 : 500, textAlign: "left" }}>
                      <span>{it.ic}</span>
                      {!collapsed && <span>{it.lb}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Role switcher */}
        <div style={{ padding: collapsed ? "12px 6px" : "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {collapsed ? (
            <button onClick={() => setRole(role === "admin" ? "viewer" : "admin")} title={role === "admin" ? "Admin" : "Viewer"}
              style={{ width: "100%", padding: "6px 0", background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", textAlign: "center" }}>
              {role === "admin" ? "🔑" : "👁"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: 2 }}>
              {["admin", "viewer"].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "5px", borderRadius: 4, border: "none", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", background: role === r ? "var(--ac)" : "transparent", color: role === r ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  {r === "admin" ? "🔑 Admin" : "👁 Xem"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function WoodPicker({ wts, sel, onSel }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {wts.map(w => {
        const s = sel === w.id;
        return (
          <button key={w.id} onClick={() => onSel(w.id)} className="wood-picker-btn" style={{ padding: "6px 12px", borderRadius: 6, border: s ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: s ? "var(--acbg)" : "var(--bgc)", color: s ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontWeight: s ? 700 : 500, fontSize: "0.78rem" }}>
            {w.icon} {w.name}
          </button>
        );
      })}
    </div>
  );
}

function ECell({ value, costPrice, ce, canEdit, onEdit }) {
  return (
    <td onClick={canEdit ? onEdit : undefined} className={canEdit ? "pcell" : ""} style={{ padding: "5px 4px", textAlign: "center", cursor: canEdit ? "pointer" : "default", color: value != null ? "var(--tp)" : "var(--tm)", fontWeight: value != null ? 700 : 400, fontSize: value != null ? "0.82rem" : "0.7rem", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", fontVariantNumeric: "tabular-nums", overflow: "hidden" }}>
      {value != null ? value.toFixed(1) : "—"}
      {ce && costPrice != null && <div style={{ fontSize: "0.58rem", color: "var(--tm)", fontWeight: 500, lineHeight: 1.2, marginTop: 1 }}>{costPrice.toFixed(1)}</div>}
    </td>
  );
}

function RDlg({ op, desc, sc, curCostPrice, onOk, onNo }) {
  const npRef = useRef(null);
  const [np, setNp] = useState(op != null ? String(op) : "");
  const [r, setR] = useState("Điều chỉnh bảng giá");
  const [cp, setCp] = useState(curCostPrice != null ? String(curCostPrice) : "");
  useEffect(() => { npRef.current?.focus(); npRef.current?.select(); }, []);

  const handleOk = () => {
    if (!r.trim()) return;
    const newPrice = np.trim() ? parseFloat(np) : null;
    const cpVal = cp.trim() ? parseFloat(cp) : (curCostPrice ?? null);
    onOk(r.trim(), cpVal, newPrice);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onNo}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bgc)", borderRadius: 16, padding: "24px", width: 420, maxWidth: "90vw", border: "1px solid var(--bd)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "0.95rem", fontWeight: 800, color: "var(--br)" }}>Thay đổi giá</h3>
        <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--ts)" }}>{desc}{sc > 1 && <span style={{ marginLeft: 6, color: "var(--ac)", fontWeight: 700 }}>×{sc} SKU</span>}</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--tm)", display: "block", marginBottom: 4 }}>Giá cũ</label>
            <div style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "var(--bgs)", color: op ? "var(--br)" : "var(--tm)", fontSize: "1rem", fontWeight: 800, textAlign: "center" }}>{op != null ? op.toFixed(1) : "—"}</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá mới</label>
            <input ref={npRef} type="number" step="0.1" value={np} onChange={e => setNp(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.target.nextSibling?.focus?.(); if (e.key === "Escape") onNo(); }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "2px solid var(--ac)", background: "var(--bg)", color: "var(--ac)", fontSize: "1rem", fontWeight: 800, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá nhập</label>
            <input type="number" step="0.1" value={cp} onChange={e => setCp(e.target.value)} placeholder={curCostPrice != null ? String(curCostPrice) : "—"}
              onKeyDown={e => { if (e.key === "Escape") onNo(); }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "var(--bg)", color: "var(--tp)", fontSize: "1rem", fontWeight: 600, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
        </div>
        <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Lý do</label>
        <input type="text" value={r} onChange={e => setR(e.target.value)} placeholder="Lý do thay đổi..."
          onKeyDown={e => { if (e.key === "Enter" && r.trim()) handleOk(); if (e.key === "Escape") onNo(); }}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "var(--bg)", color: "var(--tp)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
          <button onClick={handleOk} disabled={!r.trim()} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: r.trim() ? "var(--ac)" : "var(--bd)", color: r.trim() ? "#fff" : "var(--tm)", cursor: r.trim() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.8rem" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDlg({ title, message, warn, onOk, onNo }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onNo}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bgc)", borderRadius: 14, padding: "22px 24px", width: 380, maxWidth: "90vw", border: "1px solid var(--bd)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 800, color: "var(--br)" }}>{title}</h3>
        <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "var(--ts)", lineHeight: 1.5 }}>{message}</p>
        {warn && <p style={{ margin: "0 0 16px", fontSize: "0.75rem", color: "var(--dg)", fontWeight: 600, padding: "6px 10px", borderRadius: 6, background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.2)" }}>{warn}</p>}
        {!warn && <div style={{ marginBottom: 16 }} />}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
          <button onClick={onOk} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

function Matrix({ wk, wc, prices, onReq, hak, sop, ug, grps, ce, ats }) {

  const hAttrs = useMemo(() => wc.attrs.filter(a => hak.includes(a)).map(ak => {
    const at = ats.find(a => a.id === ak);
    const vs = wc.attrValues[ak] || [];
    if (ug && at?.groupable && grps) return { key: ak, label: at?.name || ak, values: grps.map(g => g.label), ig: true };
    return { key: ak, label: at?.name || ak, values: vs, ig: false };
  }), [wc, hak, ug, grps, ats]);

  const rAttrs = useMemo(() => wc.attrs.filter(a => !hak.includes(a)).map(ak => {
    const at = ats.find(a => a.id === ak);
    const vs = wc.attrValues[ak] || [];
    if (ug && at?.groupable && grps) return { key: ak, label: at?.name || ak, values: grps.map(g => g.label), ig: true };
    return { key: ak, label: at?.name || ak, values: vs, ig: false };
  }), [wc, hak, ug, grps, ats]);

  const colC = useMemo(() => {
    if (!hAttrs.length) return [{ a: {} }];
    return cart(hAttrs.map(at => at.values.map(v => ({ key: at.key, value: v })))).map(c => ({ a: Object.fromEntries(c.map(x => [x.key, x.value])) }));
  }, [hAttrs]);

  const allRC = useMemo(() => {
    if (!rAttrs.length) return [{ a: {} }];
    return cart(rAttrs.map(at => at.values.map(v => ({ key: at.key, value: v })))).map(c => ({ a: Object.fromEntries(c.map(x => [x.key, x.value])) }));
  }, [rAttrs]);

  const rv = useCallback((k, v) => {
    if (!ug || !grps || k !== "thickness") return v;
    const g = grps.find(gr => gr.label === v);
    return g ? g.members[0] : v;
  }, [ug, grps]);

  const gp = useCallback((ra, ca) => {
    const al = { ...ra, ...ca };
    const res = {};
    for (const [k, v] of Object.entries(al)) { res[k] = rv(k, v); }
    return prices[bpk(wk, res)]?.price;
  }, [prices, wk, rv]);

  const gcp = useCallback((ra, ca) => {
    const al = { ...ra, ...ca };
    const res = {};
    for (const [k, v] of Object.entries(al)) { res[k] = rv(k, v); }
    return prices[bpk(wk, res)]?.costPrice;
  }, [prices, wk, rv]);

  const gmk = useCallback((ra, ca) => {
    const al = { ...ra, ...ca };
    const res = {};
    for (const [k, v] of Object.entries(al)) { res[k] = rv(k, v); }
    if (ug && grps) {
      const tv = al["thickness"];
      const g = grps.find(gr => gr.label === tv);
      if (g && g.members.length > 1) {
        return g.members.map(m => bpk(wk, { ...res, thickness: m }));
      }
    }
    return [bpk(wk, res)];
  }, [wk, rv, ug, grps]);

  const gsc = useCallback((ra, ca) => {
    if (!ug || !grps) return 1;
    const tv = { ...ra, ...ca }["thickness"];
    const g = grps.find(gr => gr.label === tv);
    return g ? g.members.length : 1;
  }, [ug, grps]);

  const rC = useMemo(() => {
    if (!sop) return allRC;
    return allRC.filter(r => colC.some(c => gp(r.a, c.a) != null));
  }, [allRC, colC, sop, gp]);

  const rsi = useMemo(() => {
    if (rAttrs.length <= 1 || sop) return null;
    return rAttrs.map((_, i) => {
      let g = 1;
      for (let j = i + 1; j < rAttrs.length; j++) { g *= rAttrs[j].values.length; }
      return { gs: g };
    });
  }, [rAttrs, sop]);

  const PRICE_COL_W = 58;
  const hs = { padding: "5px 6px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", borderRight: "1px solid var(--bd)", whiteSpace: "nowrap" };
  const ha = { background: "var(--br)", color: "#FAF6F0", fontWeight: 800, fontSize: "0.65rem", textAlign: "center", minWidth: PRICE_COL_W, width: PRICE_COL_W };

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: 8, border: "1px solid var(--bds)", background: "var(--bgc)", display: "block", width: "100%" }}>
      <table style={{ width: "max-content", borderCollapse: "collapse", fontSize: "0.73rem", tableLayout: "auto" }}>
        <colgroup>
          {rAttrs.map((a) => <col key={a.key} />)}
          {colC.map((_, i) => <col key={i} style={{ width: PRICE_COL_W, minWidth: PRICE_COL_W }} />)}
        </colgroup>
        <thead>
          {hAttrs.length <= 1 ? (
            <tr>
              {rAttrs.map((a, i) => <th key={a.key} style={{ ...hs, position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2 }}>{a.label}</th>)}
              {hAttrs.length === 0
                ? <th style={{ ...hs, ...ha }}>Giá</th>
                : hAttrs[0].values.map(v => <th key={v} style={{ ...hs, ...ha }}>{v}</th>)
              }
            </tr>
          ) : (
            <>
              <tr>
                {rAttrs.map((a, i) => <th key={a.key} rowSpan={2} style={{ ...hs, position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2, verticalAlign: "middle" }}>{a.label}</th>)}
                {hAttrs[0].values.map(v => <th key={v} colSpan={hAttrs[1].values.length} style={{ ...hs, ...ha, width: "auto", maxWidth: "none", fontSize: "0.7rem" }}>{v}</th>)}
              </tr>
              <tr>
                {hAttrs[0].values.flatMap(v1 => hAttrs[1].values.map(v2 => <th key={v1 + v2} style={{ padding: "4px 3px", textAlign: "center", background: "var(--brl)", color: "#FAF6F0", fontWeight: 700, fontSize: "0.6rem", borderBottom: "2px solid var(--bds)", borderRight: "1px solid var(--bd)", minWidth: PRICE_COL_W, width: PRICE_COL_W }}>{v2}</th>))}
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {rC.map((row, rI) => {
            const mg = rsi ? rI % rsi[0].gs === 0 : true;
            const bg = rI % 2 === 0 ? "#fff" : "var(--bgs)";
            return (
              <tr key={rI} style={{ background: bg, borderTop: mg && rI > 0 && !sop ? "2px solid var(--bds)" : undefined }}>
                {rAttrs.map((at, aI) => {
                  const val = row.a[at.key];
                  const isg = at.ig && grps?.find(g => g.label === val && g.members.length > 1);
                  if (rsi && !sop) {
                    if (rI % rsi[aI].gs !== 0) return null;
                    const isF = aI === 0;
                    return (
                      <td key={at.key} rowSpan={rsi[aI].gs} style={{ padding: "4px 5px", fontWeight: isF ? 800 : 600, color: isF ? "var(--br)" : "var(--tp)", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", background: isg ? "var(--gbg)" : "var(--bgc)", verticalAlign: "middle", fontSize: isF ? "0.76rem" : "0.71rem", whiteSpace: "nowrap", position: isF ? "sticky" : undefined, left: isF ? 0 : undefined, zIndex: isF ? 1 : 0 }}>
                        {val}{isg && <span style={{ marginLeft: 2, fontSize: "0.55rem", color: "var(--gtx)" }}>({isg.members.length})</span>}
                      </td>
                    );
                  }
                  return (
                    <td key={at.key} style={{ padding: "4px 5px", fontWeight: aI === 0 ? 800 : 600, color: aI === 0 ? "var(--br)" : "var(--tp)", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", background: isg ? "var(--gbg)" : (bg === "#fff" ? "var(--bgc)" : "var(--bgs)"), fontSize: aI === 0 ? "0.76rem" : "0.71rem", whiteSpace: "nowrap", position: aI === 0 ? "sticky" : undefined, left: aI === 0 ? 0 : undefined, zIndex: aI === 0 ? 1 : 0 }}>
                      {val}{isg && <span style={{ marginLeft: 2, fontSize: "0.55rem", color: "var(--gtx)" }}>({isg.members.length})</span>}
                    </td>
                  );
                })}
                {colC.map((col, cI) => {
                  const cid = rI + "-" + cI;
                  const pr = gp(row.a, col.a);
                  const cp = gcp(row.a, col.a);
                  const sc = gsc(row.a, col.a);
                  return (
                    <ECell key={cid} value={pr} costPrice={cp} ce={ce} canEdit={ce}
                      onEdit={() => {
                        const mks = gmk(row.a, col.a);
                        const d = Object.values({ ...row.a, ...col.a }).join(" | ") + (mks.length > 1 ? " ×" + mks.length + " SKU" : "");
                        onReq(mks, pr ?? null, d, sc, cp);
                      }} />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rC.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Không có dữ liệu</div>}
    </div>
  );
}

function PgPrice({ wts, ats, cfg, prices, setP, logs, setLogs, ce, useAPI, notify }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [hm, setHm] = useState(() => { const m = {}; Object.entries(cfg).forEach(([k, c]) => { m[k] = c.defaultHeader || []; }); return m; });
  const [ug, setUg] = useState(false);
  const [sop, setSop] = useState(false);
  const [pend, setPend] = useState(null);

  const wc = cfg[sw] || { attrs: [], attrValues: {}, defaultHeader: [] };
  const hak = hm[sw] || wc.defaultHeader || [];
  const grps = useMemo(() => ug ? autoGrp(sw, wc, prices) : null, [ug, sw, wc, prices]);
  const gc = grps ? grps.filter(g => g.members.length > 1).length : 0;
  const pc = useMemo(() => Object.keys(prices).filter(k => k.startsWith(sw + "||")).length, [prices, sw]);

  const onReq = useCallback((mks, op, d, sc, ocp) => {
    setPend({ mks, op, d, sc, ocp });
  }, []);

  const handleConfirm = useCallback((reason, cp, newPrice) => {
    if (!pend) return;
    const priceUnchanged = newPrice === pend.op;
    const costUnchanged = (cp ?? null) === (pend.ocp ?? null);
    if (priceUnchanged && costUnchanged) { setPend(null); return; }
    // Cập nhật state local ngay lập tức (UI phản hồi nhanh)
    setP(p => {
      const n = { ...p };
      pend.mks.forEach(k => {
        if (newPrice == null) delete n[k];
        else n[k] = { price: newPrice, costPrice: cp ?? p[k]?.costPrice ?? undefined, updated: new Date().toISOString().slice(0, 10) };
      });
      return n;
    });
    const t = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const wn = wts.find(w => w.id === pend.mks[0]?.split("||")[0])?.name || "";
    setLogs(p => [...p, { time: t, type: pend.op ? "update" : "add", desc: wn + " — " + pend.d, op: pend.op, np: newPrice, reason }]);

    // Ghi vào Google Sheet qua API (chạy ngầm, không block UI)
    if (useAPI) {
      import('./api.js').then(api => {
        pend.mks.forEach(k => {
          const parts = k.split("||");
          const woodId = parts[0];
          const skuKey = parts.slice(1).join("||");
          api.updatePrice(woodId, skuKey, newPrice, pend.op, reason, "admin", cp ?? null)
            .then(r => { if (r?.error) notify("Lỗi lưu giá: " + r.error, false); })
            .catch(err => notify("Lỗi kết nối: " + err.message, false));
        });
      });
    }

    setPend(null);
  }, [pend, setP, setLogs, wts, useAPI, notify]);

  const w = wts.find(x => x.id === sw);

  return (
    <div>
      {pend && <RDlg op={pend.op} desc={pend.d} sc={pend.sc} curCostPrice={pend.ocp ?? null} onOk={handleConfirm} onNo={() => setPend(null)} />}
      <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📊 Bảng giá</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      {w && (
        <div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--br)" }}>{w.icon} {w.name}</span>
            <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--tm)" }}>{pc} SKU | tr/m³{ce ? " | Click sửa" : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", flexShrink: 0 }}>Ngang:</span>
              {wc.attrs.map(ak => {
                const at = ats.find(a => a.id === ak);
                const sel = hak.includes(ak);
                const can = sel || hak.length < 2;
                return (
                  <button key={ak} onClick={() => { if (sel) setHm(p => ({ ...p, [sw]: hak.filter(k => k !== ak) })); else if (can) setHm(p => ({ ...p, [sw]: [...hak, ak] })); }}
                    style={{ padding: "5px 10px", borderRadius: 4, border: sel ? "1.5px solid var(--br)" : "1.5px solid var(--bd)", background: sel ? "var(--br)" : "transparent", color: sel ? "#FAF6F0" : can ? "var(--ts)" : "var(--tm)", cursor: can || sel ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "0.72rem", opacity: !can && !sel ? 0.35 : 1, minHeight: 32 }}>
                    {at?.name || ak}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {wc.attrValues?.thickness && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: ug ? "var(--gbg)" : "var(--bgc)", border: ug ? "1.5px solid var(--gtx)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: ug ? "var(--gtx)" : "var(--ts)", minHeight: 32 }}>
                  <input type="checkbox" checked={ug} onChange={e => setUg(e.target.checked)} />Gộp dày
                  {ug && gc > 0 && <span style={{ background: "var(--gtx)", color: "#fff", borderRadius: 3, padding: "0 4px", fontSize: "0.58rem", fontWeight: 700 }}>{gc}</span>}
                </label>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: sop ? "var(--acbg)" : "var(--bgc)", border: sop ? "1.5px solid var(--ac)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: sop ? "var(--ac)" : "var(--ts)", minHeight: 32 }}>
                <input type="checkbox" checked={sop} onChange={e => setSop(e.target.checked)} />Chỉ có giá
              </label>
            </div>
          </div>
          {ug && grps && gc > 0 && (
            <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 6, background: "var(--gbg)", border: "1px solid var(--gbd)", fontSize: "0.68rem", color: "var(--gtx)", display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              <strong>Gộp:</strong>
              {grps.filter(g => g.members.length > 1).map((g, i) => <span key={i} style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(124,92,191,0.1)", fontWeight: 700 }}>{g.label}</span>)}
            </div>
          )}
          <Matrix wk={sw} wc={wc} prices={prices} onReq={onReq} hak={hak} sop={sop} ug={ug} grps={grps} ce={ce} ats={ats} />
          {logs.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Lịch sử</h3>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {logs.slice().reverse().slice(0, 15).map((l, i) => (
                  <div key={i} style={{ padding: "5px 8px", borderRadius: 5, background: "var(--bgs)", fontSize: "0.72rem", border: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: l.type === "add" ? "var(--gn)" : "var(--ac)" }} />
                      <span style={{ color: "var(--tm)", fontSize: "0.65rem" }}>{l.time}</span>
                      <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.desc}</span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>
                        {l.op != null && <><span style={{ textDecoration: "line-through", color: "var(--tm)" }}>{l.op}</span>{" → "}</>}
                        <span style={{ color: l.type === "add" ? "var(--gn)" : "var(--ac)" }}>{l.np ?? "-"}</span>
                      </span>
                    </div>
                    {l.reason && <div style={{ paddingLeft: 11, color: "var(--tm)", fontSize: "0.65rem", fontStyle: "italic", marginTop: 1 }}>💬 {l.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PgWT({ wts, setWts, cfg, ce, useAPI, notify }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ name: "", nameEn: "", icon: "🌳", desc: "" });
  const [fmErr, setFmErr] = useState({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(null); // { wood }

  const hasConfig = (id) => (cfg[id]?.attrs || []).length > 0;

  const openEditWood = (w) => {
    if (hasConfig(w.id)) {
      setConfirmEdit(w);
    } else {
      setFm({ name: w.name, nameEn: w.nameEn, icon: w.icon, desc: w.desc || "" });
      setFmErr({});
      setEd(w.id);
    }
  };

  const deleteWood = (w) => {
    setWts(p => p.filter(x => x.id !== w.id));
    if (useAPI) import('./api.js').then(api => api.deleteWoodType(w.id)
      .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã xóa " + w.name), !r?.error))
      .catch(e => notify("Lỗi kết nối: " + e.message, false)));
  };

  const genId = (nameEn) => nameEn.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const previewId = genId(fm.nameEn);

  const validate = () => {
    const errs = {};
    if (!fm.name.trim()) { errs.name = "Không được để trống"; }
    if (!fm.nameEn.trim()) { errs.nameEn = "Không được để trống"; }
    if (ed === "new") {
      const id = previewId || ("wood_" + Date.now());
      if (!previewId) errs.nameEn = "Tên EN cần có ký tự latin để tạo ID";
      const dupId = wts.find(w => w.id === id);
      if (dupId) errs.nameEn = `ID "${id}" đã tồn tại (${dupId.name})`;
      const dupName = wts.find(w => w.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên này đã tồn tại";
    } else {
      const dupName = wts.find(w => w.id !== ed && w.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên này đã tồn tại";
    }
    return errs;
  };

  const sv = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    if (ed === "new") {
      const id = previewId || ("wood_" + Date.now());
      setWts(p => [...p, { id, ...fm }]);
      if (useAPI) import('./api.js').then(api => api.addWoodType(id, fm.name, fm.nameEn, fm.icon)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã thêm " + fm.name), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      setWts(p => p.map(w => w.id === ed ? { ...w, ...fm } : w));
      if (useAPI) import('./api.js').then(api => api.apiUpdateWoodType(ed, fm.name, fm.nameEn, fm.icon)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã cập nhật " + fm.name), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setEd(null);
  };

  const moveWood = (idx, dir) => {
    const sw = idx + dir;
    if (sw < 0 || sw >= wts.length) return;
    setWts(p => {
      const arr = [...p];
      [arr[idx], arr[sw]] = [arr[sw], arr[idx]];
      return arr;
    });
    setOrderDirty(true);
  };

  const saveOrder = () => {
    if (useAPI) {
      import('./api.js').then(api => api.updateWoodOrder(wts.map(w => w.id))
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã lưu thứ tự loại gỗ", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      notify("Đã lưu thứ tự (offline)");
    }
    setOrderDirty(false);
  };

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };

  return (
    <div>
      {confirmEdit && (
        <ConfirmDlg
          title="Xác nhận chỉnh sửa"
          message={`"${confirmEdit.name}" đang được cấu hình với ${(cfg[confirmEdit.id]?.attrs || []).length} thuộc tính. Bạn vẫn muốn chỉnh sửa thông tin loại gỗ này?`}
          warn="Lưu ý: chỉnh sửa tên không ảnh hưởng đến cấu hình và giá hiện có."
          onOk={() => { setFm({ name: confirmEdit.name, nameEn: confirmEdit.nameEn, icon: confirmEdit.icon, desc: confirmEdit.desc || "" }); setFmErr({}); setEd(confirmEdit.id); setConfirmEdit(null); }}
          onNo={() => setConfirmEdit(null)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🌳 Loại gỗ</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {ce && orderDirty && (
            <button onClick={saveOrder} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--gn)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
              Lưu thứ tự
            </button>
          )}
          {ce && <button onClick={() => { setFm({ name: "", nameEn: "", icon: "🌳", desc: "" }); setFmErr({}); setEd("new"); }} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
        </div>
      </div>
      {ce && orderDirty && (
        <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 7, background: "rgba(50,79,39,0.08)", border: "1px solid var(--gn)", fontSize: "0.75rem", color: "var(--gn)", fontWeight: 600 }}>
          Thứ tự đã thay đổi — bấm <b>Lưu thứ tự</b> để cập nhật vào CSDL
        </div>
      )}

      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Icon</label>
              <input value={fm.icon} onChange={e => setFm({ ...fm, icon: e.target.value })} style={{ width: 60, padding: "8px", borderRadius: 6, border: "1.5px solid var(--bd)", textAlign: "center", fontSize: "1.2rem", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên tiếng Việt</label>
              <input value={fm.name} onChange={e => { setFm({ ...fm, name: e.target.value }); setFmErr(p => ({ ...p, name: "" })); }} placeholder="vd: Óc Chó"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.name ? "var(--dg)" : "var(--bd)"), fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.name && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.name}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên tiếng Anh</label>
              <input value={fm.nameEn} onChange={e => { setFm({ ...fm, nameEn: e.target.value }); setFmErr(p => ({ ...p, nameEn: "" })); }} placeholder="vd: Walnut"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.nameEn ? "var(--dg)" : "var(--bd)"), fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              {ed === "new" && previewId && !fmErr.nameEn && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 3 }}>ID: <code>{previewId}</code></div>}
              {fmErr.nameEn && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.nameEn}</div>}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mô tả</label>
            <input value={fm.desc || ""} onChange={e => setFm({ ...fm, desc: e.target.value })} placeholder="Mô tả ngắn về loại gỗ (tùy chọn)"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); }} style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={sv} style={{ padding: "7px 20px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </div>
      )}

      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, width: 40, textAlign: "center" }}>STT</th>
              <th style={{ ...ths, width: 48 }}>Icon</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Tên</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Tên EN</th>
              <th style={ths}>Mô tả</th>
              {ce && <th style={{ ...ths, width: 110 }}></th>}
            </tr>
          </thead>
          <tbody>
            {wts.map((w, i) => (
              <tr key={w.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>
                  {i + 1}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontSize: "1.1rem" }}>{w.icon}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {w.name}
                  <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 400, fontFamily: "monospace" }}>{w.id}</div>
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", whiteSpace: "nowrap" }}>{w.nameEn}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.75rem" }}>{w.desc || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                {ce && (
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button onClick={() => moveWood(i, -1)} disabled={i === 0} title="Lên"
                        style={{ width: 24, height: 24, padding: 0, border: "1px solid var(--bd)", borderRadius: 4, background: i === 0 ? "transparent" : "var(--bgc)", color: i === 0 ? "var(--tm)" : "var(--ts)", cursor: i === 0 ? "default" : "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                      <button onClick={() => moveWood(i, 1)} disabled={i === wts.length - 1} title="Xuống"
                        style={{ width: 24, height: 24, padding: 0, border: "1px solid var(--bd)", borderRadius: 4, background: i === wts.length - 1 ? "transparent" : "var(--bgc)", color: i === wts.length - 1 ? "var(--tm)" : "var(--ts)", cursor: i === wts.length - 1 ? "default" : "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                      <button onClick={() => openEditWood(w)}
                        style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
                        Sửa{hasConfig(w.id) ? " ⚠" : ""}
                      </button>
                      <button onClick={() => deleteWood(w)} disabled={hasConfig(w.id)} title={hasConfig(w.id) ? "Đang có cấu hình thuộc tính — không thể xóa" : "Xóa"}
                        style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: hasConfig(w.id) ? "var(--tm)" : "var(--dg)", border: "1px solid " + (hasConfig(w.id) ? "var(--bd)" : "var(--dg)"), cursor: hasConfig(w.id) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.68rem", opacity: hasConfig(w.id) ? 0.4 : 1 }}>Xóa</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PgSKU({ wts, cfg, prices }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const wc = cfg[sw] || { attrs: [], attrValues: {} };
  const list = useMemo(() => {
    if (!wc.attrs.length) return [];
    const arrays = wc.attrs.map(ak => (wc.attrValues[ak] || []).map(v => ({ key: ak, value: v })));
    return cart(arrays).map(combo => {
      const a = Object.fromEntries(combo.map(c => [c.key, c.value]));
      const pk = bpk(sw, a);
      return { code: sw.toUpperCase().slice(0, 3) + "-" + combo.map(c => c.value.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 5)).join("-"), a, pk, price: prices[pk]?.price };
    });
  }, [sw, wc, prices]);
  const pc = list.filter(s => s.price != null);

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏷️ SKU</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      <p style={{ fontSize: "0.78rem", marginBottom: 12 }}>Tổng: <b>{list.length}</b> — Có giá: <b style={{ color: "var(--gn)" }}>{pc.length}</b></p>
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden", maxHeight: 500, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead><tr><th style={{ padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "left" }}>#</th><th style={{ padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "left" }}>Mã</th>{wc.attrs.map(ak => <th key={ak} style={{ padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "left" }}>{ak}</th>)}<th style={{ padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "right" }}>Giá</th></tr></thead>
          <tbody>{list.map((s, i) => (
            <tr key={i} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
              <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", fontSize: "0.65rem" }}>{i + 1}</td>
              <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontSize: "0.68rem", color: "var(--br)", fontFamily: "monospace" }}>{s.code}</td>
              {wc.attrs.map(ak => <td key={ak} style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" }}>{s.a[ak]}</td>)}
              <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: s.price != null ? "var(--ac)" : "var(--tm)" }}>{s.price != null ? s.price.toFixed(1) : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function PgAT({ ats, setAts, cfg, prices, ce, useAPI, notify }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ id: "", name: "", groupable: false, values: [] });
  const [fmErr, setFmErr] = useState({});
  const [newVal, setNewVal] = useState("");
  const [newValErr, setNewValErr] = useState("");
  const [selValIdx, setSelValIdx] = useState(null);
  const [editValText, setEditValText] = useState("");
  const [editValErr, setEditValErr] = useState("");

  const usedIn = (atId) => Object.values(cfg).some(c => (c.attrs || []).includes(atId));

  // Kiểm tra giá trị của thuộc tính có tồn tại trong bảng giá không
  const valUsedInPrices = (atId, val) =>
    prices && Object.keys(prices).some(k => k.split("||").slice(1).some(seg => seg === `${atId}:${val}`));

  const sortNumeric = (vals) => [...vals].sort((a, b) => parseFloat(a) - parseFloat(b));

  const normalizeVal = (v, groupable) => {
    const s = v.trim();
    if (!s) return s;
    if (groupable && /^[\d.]+$/.test(s)) return s + "F";
    return s;
  };

  const genAttrId = (name) => name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const previewId = fm.id.trim() || genAttrId(fm.name);

  const openNew = () => { setFm({ id: "", name: "", groupable: false, values: [] }); setFmErr({}); setNewVal(""); setNewValErr(""); setSelValIdx(null); setEd("new"); };
  const openEdit = (at) => { setFm({ id: at.id, name: at.name, groupable: !!at.groupable, values: [...at.values] }); setFmErr({}); setNewVal(""); setNewValErr(""); setSelValIdx(null); setEd(at.id); };

  const selectChip = (vi) => {
    setSelValIdx(vi);
    setEditValText(fm.values[vi]);
    setEditValErr("");
  };

  const commitEditVal = () => {
    if (selValIdx === null) return;
    const v = normalizeVal(editValText, fm.groupable);
    if (!v) return;
    const oldVal = fm.values[selValIdx];
    // Không đổi gì thì bỏ qua
    if (v === oldVal) { setEditValErr(""); return; }
    // Kiểm tra trùng với giá trị khác
    const dup = fm.values.some((x, i) => i !== selValIdx && x.toLowerCase() === v.toLowerCase());
    if (dup) { setEditValErr(`"${v}" đã tồn tại`); return; }
    // Cảnh báo nếu giá trị cũ đang có trong bảng giá
    if (ed !== "new" && valUsedInPrices(ed, oldVal)) {
      setEditValErr(`Cảnh báo: "${oldVal}" đang có trong bảng giá. Đổi tên sẽ mất liên kết giá cũ. Nhấn Enter lần nữa để xác nhận.`);
      // Cho phép nhấn Enter lần 2 để xác nhận (clear lỗi trước)
      if (editValErr && editValErr.startsWith("Cảnh báo")) {
        setEditValErr("");
        setFm(p => { const arr = [...p.values]; arr[selValIdx] = v; return { ...p, values: p.groupable ? sortNumeric(arr) : arr }; });
        if (fm.groupable) setSelValIdx(null);
      }
      return;
    }
    setEditValErr("");
    setFm(p => {
      const arr = [...p.values];
      arr[selValIdx] = v;
      return { ...p, values: p.groupable ? sortNumeric(arr) : arr };
    });
    if (fm.groupable) setSelValIdx(null);
  };

  const moveValChip = (dir) => {
    if (selValIdx === null) return;
    const sw = selValIdx + dir;
    if (sw < 0 || sw >= fm.values.length) return;
    setFm(p => {
      const arr = [...p.values];
      [arr[selValIdx], arr[sw]] = [arr[sw], arr[selValIdx]];
      return { ...p, values: arr };
    });
    setSelValIdx(sw);
  };

  const deleteSelectedVal = () => {
    if (selValIdx === null) return;
    const val = fm.values[selValIdx];
    if (ed !== "new" && valUsedInPrices(ed, val)) {
      setEditValErr(`Không thể xóa — "${val}" đang tồn tại trong bảng giá`);
      return;
    }
    setFm(p => ({ ...p, values: p.values.filter((_, i) => i !== selValIdx) }));
    setSelValIdx(null);
    setEditValErr("");
  };

  const addVal = () => {
    const v = normalizeVal(newVal, fm.groupable);
    if (!v) return;
    if (fm.values.some(x => x.toLowerCase() === v.toLowerCase())) {
      setNewValErr(`"${v}" đã tồn tại trong danh sách`);
      return;
    }
    setNewValErr("");
    const next = [...fm.values, v];
    setFm(p => ({ ...p, values: p.groupable ? sortNumeric(next) : next }));
    setNewVal("");
  };

  const save = () => {
    const errs = {};
    if (!fm.name.trim()) errs.name = "Không được để trống";
    if (!fm.values.length) errs.values = "Cần ít nhất 1 giá trị";
    if (ed === "new") {
      const id = previewId || ("attr_" + Date.now());
      if (!previewId) errs.name = "Tên cần có ký tự latin để tạo ID";
      const dupId = ats.find(a => a.id === id);
      if (dupId) errs.id = `ID "${id}" đã tồn tại (${dupId.name})`;
      const dupName = ats.find(a => a.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên thuộc tính này đã tồn tại";
    } else {
      const dupName = ats.find(a => a.id !== ed && a.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên thuộc tính này đã tồn tại";
    }
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    const finalVals = fm.groupable ? sortNumeric(fm.values) : fm.values;
    if (ed === "new") {
      const id = previewId || ("attr_" + Date.now());
      setAts(p => [...p, { id, name: fm.name.trim(), groupable: fm.groupable, values: finalVals }]);
      if (useAPI) import('./api.js').then(api => api.saveAttribute(id, fm.name.trim(), fm.groupable, finalVals)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã thêm thuộc tính " + fm.name.trim()), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      setAts(p => p.map(a => a.id === ed ? { ...a, name: fm.name.trim(), groupable: fm.groupable, values: finalVals } : a));
      if (useAPI) import('./api.js').then(api => api.saveAttribute(ed, fm.name.trim(), fm.groupable, finalVals)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã lưu thuộc tính " + fm.name.trim()), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setEd(null);
  };

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📋 Thuộc tính</h2>
        {ce && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>

      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {ed === "new" && (
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>ID tùy chỉnh <span style={{ fontWeight: 400, color: "var(--tm)" }}>(để trống = tự sinh)</span></label>
                <input value={fm.id} onChange={e => { setFm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })); setFmErr(p => ({ ...p, id: "" })); }} placeholder="vd: moisture"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.id ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                {previewId && !fmErr.id && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 3 }}>ID sẽ dùng: <code>{previewId}</code></div>}
                {fmErr.id && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.id}</div>}
              </div>
            )}
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên thuộc tính</label>
              <input value={fm.name} onChange={e => { setFm(p => ({ ...p, name: e.target.value })); setFmErr(p => ({ ...p, name: "" })); }} placeholder="vd: Độ ẩm"
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.name ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.name && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.name}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "var(--ts)" }}>
                <input type="checkbox" checked={fm.groupable} onChange={e => { setFm(p => ({ ...p, groupable: e.target.checked })); setSelValIdx(null); }} />
                Kiểu số (tự sắp xếp)
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)" }}>Giá trị ({fm.values.length})</label>
              {fm.groupable
                ? <span style={{ fontSize: "0.65rem", padding: "1px 7px", borderRadius: 3, background: "var(--gbg)", color: "var(--gtx)", fontWeight: 600 }}>Tự động sắp xếp tăng dần · Nhập số, tự thêm hậu tố F</span>
                : <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>Bấm vào giá trị để chọn, dùng &lt; &gt; đổi vị trí</span>
              }
            </div>

            {/* Chips hiển thị theo chiều ngang */}
            <div onClick={e => { if (e.target === e.currentTarget) setSelValIdx(null); }}
              style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px", borderRadius: 6, border: "1.5px solid var(--bds)", background: "var(--bgs)", minHeight: 42, marginBottom: 8, cursor: "default" }}>
              {fm.values.map((v, vi) => (
                <span key={vi} onClick={() => selectChip(vi)}
                  style={{ padding: "5px 11px", borderRadius: 5, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", userSelect: "none", transition: "all 0.12s",
                    background: selValIdx === vi ? "var(--ac)" : "var(--bgc)",
                    border: "1.5px solid " + (selValIdx === vi ? "var(--ac)" : "var(--bds)"),
                    color: selValIdx === vi ? "#fff" : "var(--tp)"
                  }}>
                  {v}
                </span>
              ))}
              {!fm.values.length && <span style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic", alignSelf: "center" }}>Chưa có giá trị nào</span>}
            </div>

            {/* Thanh điều khiển khi đã chọn chip */}
            {selValIdx !== null && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: "var(--acbg)", border: "1px solid var(--ac)" }}>
                {!fm.groupable && (
                  <button onClick={() => moveValChip(-1)} disabled={selValIdx === 0}
                    style={{ width: 30, height: 30, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selValIdx === 0 ? "transparent" : "var(--bgc)", color: selValIdx === 0 ? "var(--tm)" : "var(--ts)", cursor: selValIdx === 0 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>
                    ‹
                  </button>
                )}
                <div style={{ flex: 1, minWidth: 60 }}>
                  <input value={editValText} onChange={e => { setEditValText(e.target.value); setEditValErr(""); }}
                    onBlur={commitEditVal} onKeyDown={e => { if (e.key === "Enter") { commitEditVal(); e.target.blur(); } if (e.key === "Escape") { setEditValText(fm.values[selValIdx]); setEditValErr(""); } }}
                    style={{ width: "100%", padding: "5px 9px", borderRadius: 5, border: "1.5px solid " + (editValErr ? "var(--dg)" : "var(--ac)"), fontSize: "0.8rem", outline: "none", background: "#fff", boxSizing: "border-box" }} />
                  {editValErr && <div style={{ fontSize: "0.62rem", color: "var(--dg)", marginTop: 2 }}>{editValErr}</div>}
                </div>
                {!fm.groupable && (
                  <button onClick={() => moveValChip(1)} disabled={selValIdx === fm.values.length - 1}
                    style={{ width: 30, height: 30, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selValIdx === fm.values.length - 1 ? "transparent" : "var(--bgc)", color: selValIdx === fm.values.length - 1 ? "var(--tm)" : "var(--ts)", cursor: selValIdx === fm.values.length - 1 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>
                    ›
                  </button>
                )}
                <button onClick={deleteSelectedVal}
                  style={{ padding: "5px 11px", borderRadius: 5, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem", flexShrink: 0 }}>
                  Xóa
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={newVal} onChange={e => { setNewVal(e.target.value); setNewValErr(""); }} onKeyDown={e => e.key === "Enter" && addVal()}
                  placeholder={fm.groupable ? "Nhập số VD: 3.5 → tự thành 3.5F" : "Nhập giá trị mới rồi Enter..."}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1.5px solid " + (newValErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.8rem", outline: "none" }} />
                <button onClick={addVal} style={{ padding: "6px 14px", borderRadius: 6, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>
              </div>
              {newValErr && <div style={{ fontSize: "0.65rem", color: "var(--dg)" }}>{newValErr}</div>}
              {fmErr.values && <div style={{ fontSize: "0.65rem", color: "var(--dg)" }}>{fmErr.values}</div>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); setNewValErr(""); setEditValErr(""); }} style={{ padding: "7px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={save} disabled={!fm.name.trim() || !fm.values.length}
              style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: fm.name.trim() && fm.values.length ? "var(--ac)" : "var(--bd)", color: fm.name.trim() && fm.values.length ? "#fff" : "var(--tm)", cursor: fm.name.trim() && fm.values.length ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.78rem" }}>
              Lưu
            </button>
          </div>
        </div>
      )}

      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Tên</th>
              <th style={ths}>Giá trị</th>
              {ce && <th style={{ ...ths, width: 100 }}></th>}
            </tr>
          </thead>
          <tbody>
            {ats.map((at, i) => {
              const used = usedIn(at.id);
              return (
                <tr key={at.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {at.name}
                    <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 400, fontFamily: "monospace" }}>{at.id}</div>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {at.values.map(v => (
                        <span key={v} style={{ padding: "2px 6px", borderRadius: 3, background: "var(--bgs)", border: "1px solid var(--bds)", fontSize: "0.7rem" }}>{v}</span>
                      ))}
                    </div>
                  </td>
                  {ce && (
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openEdit(at)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                        <button onClick={() => { if (used) return; setAts(p => p.filter(a => a.id !== at.id)); if (useAPI) import('./api.js').then(api => api.deleteAttribute(at.id).then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã xóa " + at.name), !r?.error)).catch(e => notify("Lỗi kết nối: " + e.message, false))); }} disabled={used} title={used ? "Đang được dùng trong cấu hình" : "Xóa"}
                          style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: used ? "var(--tm)" : "var(--dg)", border: "1px solid " + (used ? "var(--bd)" : "var(--dg)"), cursor: used ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.68rem", opacity: used ? 0.45 : 1 }}>Xóa</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PgCFG({ wts, ats, cfg, setCfg, ce, useAPI, notify }) {
  const [sw, setSw] = useState(wts[0]?.id);

  const cloneCfg = (id) => {
    const c = cfg[id];
    if (!c) return { attrs: [], attrValues: {}, defaultHeader: [] };
    return { attrs: [...(c.attrs || [])], attrValues: Object.fromEntries(Object.entries(c.attrValues || {}).map(([k, v]) => [k, [...v]])), defaultHeader: [...(c.defaultHeader || [])] };
  };

  const [draft, setDraft] = useState(() => cloneCfg(wts[0]?.id));
  const [saved, setSaved] = useState(false);

  const selectWood = (id) => { setSw(id); setDraft(cloneCfg(id)); setSaved(false); };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(cloneCfg(sw));

  const toggleAttr = (atId) => {
    setDraft(p => {
      if (p.attrs.includes(atId)) {
        const newAV = { ...p.attrValues }; delete newAV[atId];
        return { ...p, attrs: p.attrs.filter(a => a !== atId), attrValues: newAV, defaultHeader: p.defaultHeader.filter(h => h !== atId) };
      }
      const atDef = ats.find(a => a.id === atId);
      return { ...p, attrs: [...p.attrs, atId], attrValues: { ...p.attrValues, [atId]: atDef ? [...atDef.values] : [] } };
    });
    setSaved(false);
  };

  const toggleVal = (atId, val) => {
    setDraft(p => {
      const cur = p.attrValues[atId] || [];
      return { ...p, attrValues: { ...p.attrValues, [atId]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] } };
    });
    setSaved(false);
  };

  const selectAllVals = (atId) => {
    const atDef = ats.find(a => a.id === atId);
    if (!atDef) return;
    setDraft(p => ({ ...p, attrValues: { ...p.attrValues, [atId]: [...atDef.values] } }));
    setSaved(false);
  };

  const clearAllVals = (atId) => {
    setDraft(p => ({ ...p, attrValues: { ...p.attrValues, [atId]: [] } }));
    setSaved(false);
  };

  const toggleHeader = (atId) => {
    setDraft(p => {
      if (p.defaultHeader.includes(atId)) return { ...p, defaultHeader: p.defaultHeader.filter(h => h !== atId) };
      if (p.defaultHeader.length >= 2) return p;
      return { ...p, defaultHeader: [...p.defaultHeader, atId] };
    });
    setSaved(false);
  };

  const saveCfg = () => {
    // Sắp xếp attrValues theo đúng thứ tự hiển thị trên UI (thứ tự trong định nghĩa thuộc tính)
    const sortedAV = Object.fromEntries(
      Object.entries(draft.attrValues).map(([atId, vals]) => {
        const atDef = ats.find(a => a.id === atId);
        if (atDef) {
          const sorted = [...vals].sort((a, b) => atDef.values.indexOf(a) - atDef.values.indexOf(b));
          return [atId, sorted];
        }
        return [atId, vals];
      })
    );
    const finalDraft = { ...draft, attrValues: sortedAV };
    setCfg(p => ({ ...p, [sw]: finalDraft }));
    setDraft(finalDraft);
    setSaved(true);
    if (useAPI) {
      import('./api.js').then(api => api.saveWoodConfig(sw, finalDraft)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã lưu cấu hình", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
  };

  const secHd = { padding: "9px 14px", background: "var(--bgh)", borderBottom: "1px solid var(--bds)", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>⚙️ Cấu hình loại gỗ</h2>
      <WoodPicker wts={wts} sel={sw} onSel={selectWood} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Thuộc tính & Giá trị */}
        <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
          <div style={secHd}>Thuộc tính & Giá trị áp dụng</div>
          <div>
            {ats.map((at, i) => {
              const active = draft.attrs.includes(at.id);
              const selVals = draft.attrValues[at.id] || [];
              return (
                <div key={at.id} style={{ borderBottom: i < ats.length - 1 ? "1px solid var(--bd)" : "none", padding: "10px 14px", background: active ? "#fff" : "var(--bgs)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: ce ? "pointer" : "default", marginBottom: active ? 8 : 0, userSelect: "none" }}>
                    <input type="checkbox" checked={active} onChange={() => ce && toggleAttr(at.id)} disabled={!ce} style={{ width: 15, height: 15, accentColor: "var(--ac)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.83rem", color: active ? "var(--br)" : "var(--tm)" }}>{at.name}</span>
                    <span style={{ fontSize: "0.63rem", color: "var(--tm)", fontFamily: "monospace" }}>{at.id}</span>
                    {active && (
                      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{selVals.length}/{at.values.length} giá trị</span>
                        {ce && selVals.length < at.values.length && (
                          <button onClick={e => { e.preventDefault(); selectAllVals(at.id); }}
                            style={{ padding: "1px 7px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem", fontWeight: 600, lineHeight: 1.6 }}>
                            Chọn hết
                          </button>
                        )}
                        {ce && selVals.length > 0 && (
                          <button onClick={e => { e.preventDefault(); clearAllVals(at.id); }}
                            style={{ padding: "1px 7px", borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem", fontWeight: 600, lineHeight: 1.6 }}>
                            Xóa hết
                          </button>
                        )}
                      </span>
                    )}
                  </label>
                  {active && (
                    <div style={{ paddingLeft: 23, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {at.values.map(v => {
                        const sel = selVals.includes(v);
                        return (
                          <button key={v} onClick={() => ce && toggleVal(at.id, v)} disabled={!ce}
                            style={{ padding: "3px 10px", borderRadius: 4, border: sel ? "1.5px solid var(--ac)" : "1.5px solid var(--bd)", background: sel ? "var(--acbg)" : "transparent", color: sel ? "var(--ac)" : "var(--ts)", cursor: ce ? "pointer" : "default", fontWeight: sel ? 700 : 500, fontSize: "0.73rem" }}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hiển thị ngang mặc định */}
        {draft.attrs.length > 0 && (
          <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
            <div style={secHd}>
              Hiển thị ngang mặc định
              <span style={{ marginLeft: 6, fontWeight: 500, textTransform: "none", fontSize: "0.65rem", color: "var(--tm)" }}>(tối đa 2 — sẽ là cột header của bảng giá)</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {draft.attrs.map(atId => {
                const at = ats.find(a => a.id === atId);
                const sel = draft.defaultHeader.includes(atId);
                const maxed = !sel && draft.defaultHeader.length >= 2;
                return (
                  <button key={atId} onClick={() => ce && !maxed && toggleHeader(atId)} disabled={!ce || maxed}
                    style={{ padding: "5px 14px", borderRadius: 5, border: sel ? "1.5px solid var(--br)" : "1.5px solid var(--bd)", background: sel ? "var(--br)" : "transparent", color: sel ? "#FAF6F0" : maxed ? "var(--tm)" : "var(--ts)", cursor: !ce || maxed ? "not-allowed" : "pointer", fontWeight: sel ? 700 : 500, fontSize: "0.76rem", opacity: maxed ? 0.4 : 1 }}>
                    {sel ? `${draft.defaultHeader.indexOf(atId) + 1}. ` : ""}{at?.name || atId}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save */}
        {ce && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
            {saved && !isDirty && <span style={{ fontSize: "0.74rem", color: "var(--gn)", fontWeight: 700 }}>✓ Đã lưu</span>}
            {isDirty && <span style={{ fontSize: "0.72rem", color: "var(--ac)", fontWeight: 600 }}>Có thay đổi chưa lưu</span>}
            <button onClick={saveCfg} disabled={!isDirty}
              style={{ padding: "8px 28px", borderRadius: 8, border: "none", background: isDirty ? "var(--ac)" : "var(--bd)", color: isDirty ? "#fff" : "var(--tm)", cursor: isDirty ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.82rem" }}>
              Lưu cấu hình
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [pg, setPg] = useState("pricing");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state — khởi tạo bằng data cứng, sau đó ghi đè bằng API
  const [wts, setWts] = useState(initWT);
  const [ats, setAts] = useState(initAT);
  const [cfg, setCfg] = useState(initCFG);
  const [prices, setP] = useState(genPrices);
  const [logs, setLogs] = useState([]);
  const [useAPI, setUseAPI] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((text, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, ok });
    toastTimer.current = setTimeout(() => setToast(null), ok ? 2500 : 5000);
  }, []);
  const ce = role === "admin";

  const PAGE_LABELS = { pricing: "📊 Bảng giá", wood_types: "🌳 Loại gỗ", attributes: "📋 Thuộc tính", config: "⚙️ Cấu hình", sku: "🏷️ SKU" };

  // Load data từ Google Sheet API khi app khởi động
  useEffect(() => {
    async function loadFromAPI() {
      try {
        const { loadAllData } = await import('./api.js');
        const data = await loadAllData();

        // Nếu API trả về data hợp lệ, ghi đè data cứng
        if (data.woodTypes && Array.isArray(data.woodTypes) && data.woodTypes.length > 0) {
          setWts(data.woodTypes.map(function(w) {
            return { id: w.id, name: w.name, nameEn: w.name_en, icon: w.icon };
          }));
        }
        if (data.attributes && Array.isArray(data.attributes) && data.attributes.length > 0) {
          setAts(data.attributes);
        }
        if (data.config && typeof data.config === 'object' && Object.keys(data.config).length > 0) {
          // Normalize: loại bỏ giá trị trong config không còn tồn tại trong attribute definition
          const atMap = Object.fromEntries((data.attributes || []).map(a => [a.id, new Set(a.values)]));
          const cleanCfg = {};
          Object.entries(data.config).forEach(([woodId, wc]) => {
            const cleanAV = {};
            Object.entries(wc.attrValues || {}).forEach(([atId, vals]) => {
              cleanAV[atId] = atMap[atId] ? vals.filter(v => atMap[atId].has(v)) : vals;
            });
            cleanCfg[woodId] = { ...wc, attrValues: cleanAV };
          });
          setCfg(cleanCfg);
        }
        if (data.prices && typeof data.prices === 'object' && Object.keys(data.prices).length > 0) {
          setP(data.prices);
        }
        setUseAPI(true);
        setLoading(false);
      } catch (err) {
        console.warn('API không khả dụng, dùng data mẫu:', err.message);
        setLoading(false);
        // Vẫn dùng data cứng đã khởi tạo, app hoạt động bình thường
      }
    }
    loadFromAPI();
  }, []);

  const renderPage = () => {
    switch (pg) {
      case "pricing": return <PgPrice wts={wts} ats={ats} cfg={cfg} prices={prices} setP={setP} logs={logs} setLogs={setLogs} ce={ce} useAPI={useAPI} notify={notify} />;
      case "wood_types": return <PgWT wts={wts} setWts={setWts} cfg={cfg} ce={ce} useAPI={useAPI} notify={notify} />;
      case "attributes": return <PgAT ats={ats} setAts={setAts} cfg={cfg} prices={prices} ce={ce} useAPI={useAPI} notify={notify} />;
      case "config": return <PgCFG wts={wts} ats={ats} cfg={cfg} setCfg={setCfg} ce={ce} useAPI={useAPI} notify={notify} />;
      case "sku": return <PgSKU wts={wts} cfg={cfg} prices={prices} />;
      default: return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Trang "{pg}" đang phát triển</div>;
    }
  };

  return (
    <div style={{ ...THEME, display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', sans-serif", color: "var(--tp)" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: 8, background: toast.ok ? "#324F27" : "#C0392B", color: "#fff", fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.22)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>
          {toast.ok ? "✓ " : "✕ "}{toast.text}
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .pcell:hover { background: var(--hv) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--bds); border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }

        /* Mobile top bar — ẩn trên desktop */
        .mobile-topbar { display: none; }

        /* ===== RESPONSIVE MOBILE ===== */
        @media (max-width: 767px) {
          /* Top bar cố định */
          .mobile-topbar {
            display: flex !important;
            position: fixed; top: 0; left: 0; right: 0; height: 50px;
            background: var(--sb); z-index: 300;
            align-items: center; padding: 0 12px; gap: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }

          /* Sidebar thành drawer trượt từ trái */
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0; z-index: 400;
            width: 220px !important;
            transform: translateX(-100%);
            transition: transform 0.25s ease !important;
            box-shadow: 4px 0 24px rgba(0,0,0,0.35);
            overflow-y: auto;
          }
          .sidebar.mob-open { transform: translateX(0); }

          /* Ẩn nút collapse/expand desktop trong drawer */
          .sb-collapse-btn { display: none !important; }
          .sb-expand-btn { display: none !important; }
          /* Hiện nút ✕ đóng drawer */
          .sb-close-btn { display: block !important; }

          /* Overlay mờ phía sau drawer */
          .mob-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 399;
          }

          /* Main content: đẩy xuống dưới top bar, giảm padding */
          .app-main { padding: 62px 14px 24px !important; }

          /* Touch targets tối thiểu 44px */
          .pcell { min-height: 44px !important; }

          /* WoodPicker buttons lớn hơn trên mobile */
          .wood-picker-btn { padding: 8px 14px !important; font-size: 0.82rem !important; }
        }

        @media (min-width: 768px) {
          .mob-overlay { display: none !important; }
          .mobile-topbar { display: none !important; }
          .sb-close-btn { display: none !important; }
        }
      `}</style>
      {/* Mobile top bar — ẩn trên desktop qua CSS */}
      <div className="mobile-topbar">
        <button onClick={() => setMobileMenuOpen(true)} style={{ background: "transparent", border: "none", color: "#FAF6F0", cursor: "pointer", fontSize: "1.25rem", padding: "6px 8px", lineHeight: 1, flexShrink: 0 }}>☰</button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.72rem" }}>G</div>
          <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FAF6F0" }}>GTH Pricing</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", fontWeight: 700, color: "#FAF6F0", opacity: 0.7 }}>{PAGE_LABELS[pg] || pg}</span>
      </div>

      <Sidebar pg={pg} setPg={setPg} role={role} setRole={setRole} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <main className="app-main" style={{ flex: 1, padding: "24px 28px", maxWidth: 1400, minWidth: 0 }}>
        {loading && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--br)", marginBottom: 8 }}>Đang tải dữ liệu...</div>
            <div style={{ fontSize: "0.8rem", color: "var(--tm)" }}>Kết nối Google Sheet</div>
          </div>
        )}
        {!loading && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              {!ce && <div style={{ padding: "6px 14px", borderRadius: 7, background: "var(--acbg)", border: "1px solid var(--ac)", fontSize: "0.75rem", color: "var(--ac)", fontWeight: 700 }}>👁 Chế độ xem</div>}
              <div style={{ padding: "4px 10px", borderRadius: 5, background: useAPI ? "rgba(50,79,39,0.08)" : "rgba(242,101,34,0.08)", border: useAPI ? "1px solid var(--gn)" : "1px solid var(--ac)", fontSize: "0.65rem", fontWeight: 600, color: useAPI ? "var(--gn)" : "var(--ac)" }}>
                {useAPI ? "● Google Sheet" : "● Data mẫu (offline)"}
              </div>
            </div>
            {renderPage()}
          </>
        )}
      </main>
    </div>
  );
}