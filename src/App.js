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

function Sidebar({ pg, setPg, role, setRole }) {
  const menu = [
    { group: "KINH DOANH", items: [{ id: "pricing", ic: "📊", lb: "Bảng giá" }] },
    { group: "DANH MỤC", items: [
      { id: "wood_types", ic: "🌳", lb: "Loại gỗ" },
      { id: "attributes", ic: "📋", lb: "Thuộc tính" },
      { id: "config", ic: "⚙️", lb: "Cấu hình" },
      { id: "sku", ic: "🏷️", lb: "SKU" }
    ] }
  ];

  return (
    <div style={{ width: 200, minHeight: "100vh", background: "var(--sb)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--ac)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.85rem" }}>G</div>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FAF6F0" }}>GTH Pricing</div>
      </div>
      <div style={{ flex: 1, padding: "12px 0" }}>
        {menu.map(g => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <div style={{ padding: "0 16px", marginBottom: 6, fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.group}</div>
            {g.items.map(it => {
              const active = pg === it.id;
              return (
                <button key={it.id} onClick={() => setPg(it.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 16px", background: active ? "rgba(242,101,34,0.15)" : "transparent", border: "none", borderLeft: active ? "3px solid var(--ac)" : "3px solid transparent", color: active ? "#FAF6F0" : "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "0.78rem", fontWeight: active ? 700 : 500, textAlign: "left" }}>
                  <span>{it.ic}</span><span>{it.lb}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: 2 }}>
          {["admin", "viewer"].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "5px", borderRadius: 4, border: "none", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", background: role === r ? "var(--ac)" : "transparent", color: role === r ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {r === "admin" ? "🔑 Admin" : "👁 Xem"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WoodPicker({ wts, sel, onSel }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {wts.map(w => {
        const s = sel === w.id;
        return (
          <button key={w.id} onClick={() => onSel(w.id)} style={{ padding: "6px 12px", borderRadius: 6, border: s ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: s ? "var(--acbg)" : "var(--bgc)", color: s ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontWeight: s ? 700 : 500, fontSize: "0.78rem" }}>
            {w.icon} {w.name}
          </button>
        );
      })}
    </div>
  );
}

function ECell({ value, editing, canEdit, onEdit, onDone, sc }) {
  const [lv, setLv] = useState(value != null ? String(value) : "");
  const ref = useRef(null);
  useEffect(() => { setLv(value != null ? String(value) : ""); }, [value]);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

  const commit = () => {
    const p = lv.trim() ? parseFloat(lv) : null;
    if (p === value) { onDone(null, true); return; }
    onDone(p, false);
  };

  if (!editing) {
    return (
      <td onClick={canEdit ? onEdit : undefined} className={canEdit ? "pcell" : ""} style={{ padding: "5px 4px", textAlign: "center", cursor: canEdit ? "pointer" : "default", color: value != null ? "var(--tp)" : "var(--tm)", fontWeight: value != null ? 700 : 400, fontSize: value != null ? "0.82rem" : "0.7rem", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", minWidth: 46, fontVariantNumeric: "tabular-nums" }}>
        {value != null ? value.toFixed(1) : "—"}
      </td>
    );
  }

  return (
    <td style={{ padding: "1px", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", minWidth: 46, background: "var(--acbg)", position: "relative" }}>
      <input ref={ref} type="number" step="0.1" value={lv} onChange={e => setLv(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLv(value != null ? String(value) : ""); onDone(null, true); } }}
        style={{ width: "100%", padding: "3px 2px", border: "2px solid var(--ac)", borderRadius: 3, textAlign: "center", fontSize: "0.8rem", fontWeight: 700, outline: "none", background: "#fff", color: "var(--tp)", boxSizing: "border-box" }} />
      {sc > 1 && <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: "0.5rem", color: "var(--ac)", fontWeight: 700 }}>x{sc}</div>}
    </td>
  );
}

function RDlg({ op, np, desc, sc, onOk, onNo }) {
  const [r, setR] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onNo}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bgc)", borderRadius: 16, padding: "24px", width: 400, maxWidth: "90vw", border: "1px solid var(--bd)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "0.95rem", fontWeight: 800, color: "var(--br)" }}>Thay đổi giá</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.78rem", color: "var(--ts)" }}>{desc}</p>
        {sc > 1 && <p style={{ margin: "0 0 12px", fontSize: "0.74rem", color: "var(--ac)", fontWeight: 700 }}>Cho {sc} SKU</p>}
        <div style={{ display: "flex", gap: 14, marginBottom: 16, padding: "10px", borderRadius: 8, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 700, marginBottom: 2 }}>CŨ</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: op ? "var(--br)" : "var(--tm)" }}>{op ? op.toFixed(1) : "—"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--tm)" }}>→</div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", fontWeight: 700, marginBottom: 2 }}>MỚI</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: np != null ? "var(--ac)" : "var(--dg)" }}>{np != null ? np.toFixed(1) : "Xóa"}</div>
          </div>
        </div>
        <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Lý do</label>
        <input ref={ref} type="text" value={r} onChange={e => setR(e.target.value)} placeholder="VD: Giá nhập mới..."
          onKeyDown={e => { if (e.key === "Enter" && r.trim()) onOk(r.trim()); if (e.key === "Escape") onNo(); }}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "var(--bg)", color: "var(--tp)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
          <button onClick={() => r.trim() && onOk(r.trim())} disabled={!r.trim()} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: r.trim() ? "var(--ac)" : "var(--bd)", color: r.trim() ? "#fff" : "var(--tm)", cursor: r.trim() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.8rem" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

function Matrix({ wk, wc, prices, onReq, hak, sop, ug, grps, ce, ats }) {
  const [ec, setEc] = useState(null);

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

  const hs = { padding: "5px 4px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.63rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", borderRight: "1px solid var(--bd)", whiteSpace: "nowrap", minWidth: 48 };
  const ha = { background: "var(--br)", color: "#FAF6F0", fontWeight: 800, fontSize: "0.68rem", textAlign: "center" };

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--bds)", background: "var(--bgc)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
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
                {hAttrs[0].values.map(v => <th key={v} colSpan={hAttrs[1].values.length} style={{ ...hs, ...ha, fontSize: "0.7rem" }}>{v}</th>)}
              </tr>
              <tr>
                {hAttrs[0].values.flatMap(v1 => hAttrs[1].values.map(v2 => <th key={v1 + v2} style={{ padding: "4px 3px", textAlign: "center", background: "var(--brl)", color: "#FAF6F0", fontWeight: 700, fontSize: "0.6rem", borderBottom: "2px solid var(--bds)", borderRight: "1px solid var(--bd)", minWidth: 40 }}>{v2}</th>))}
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
                      <td key={at.key} rowSpan={rsi[aI].gs} style={{ padding: "4px 5px", fontWeight: isF ? 800 : 600, color: isF ? "var(--br)" : "var(--tp)", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", background: isg ? "var(--gbg)" : "var(--bgc)", verticalAlign: "middle", fontSize: isF ? "0.8rem" : "0.74rem", whiteSpace: "nowrap", position: isF ? "sticky" : undefined, left: isF ? 0 : undefined, zIndex: isF ? 1 : 0 }}>
                        {val}{isg && <span style={{ marginLeft: 2, fontSize: "0.55rem", color: "var(--gtx)" }}>({isg.members.length})</span>}
                      </td>
                    );
                  }
                  return (
                    <td key={at.key} style={{ padding: "4px 5px", fontWeight: aI === 0 ? 800 : 600, color: aI === 0 ? "var(--br)" : "var(--tp)", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", background: isg ? "var(--gbg)" : (bg === "#fff" ? "var(--bgc)" : "var(--bgs)"), fontSize: aI === 0 ? "0.8rem" : "0.74rem", whiteSpace: "nowrap", position: aI === 0 ? "sticky" : undefined, left: aI === 0 ? 0 : undefined, zIndex: aI === 0 ? 1 : 0 }}>
                      {val}{isg && <span style={{ marginLeft: 2, fontSize: "0.55rem", color: "var(--gtx)" }}>({isg.members.length})</span>}
                    </td>
                  );
                })}
                {colC.map((col, cI) => {
                  const cid = rI + "-" + cI;
                  const pr = gp(row.a, col.a);
                  const sc = gsc(row.a, col.a);
                  return (
                    <ECell key={cid} value={pr} editing={ec === cid} canEdit={ce} sc={sc > 1 && ec === cid ? sc : 0}
                      onEdit={() => setEc(cid)}
                      onDone={(val, x) => {
                        if (x) { setEc(null); return; }
                        const mks = gmk(row.a, col.a);
                        const d = Object.values({ ...row.a, ...col.a }).join(" | ") + (mks.length > 1 ? " (x" + mks.length + " SKU)" : "");
                        onReq(mks, val, pr || null, d, mks.length);
                        setEc(null);
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

function PgPrice({ wts, ats, cfg, prices, setP, logs, setLogs, ce }) {
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

  const onReq = useCallback((mks, np, op, d, sc) => {
    if (np === op) return;
    setPend({ mks, np, op, d, sc });
  }, []);

  const handleConfirm = useCallback(reason => {
    if (!pend) return;
    setP(p => {
      const n = { ...p };
      pend.mks.forEach(k => {
        if (pend.np == null) delete n[k];
        else n[k] = { price: pend.np, updated: new Date().toISOString().slice(0, 10) };
      });
      return n;
    });
    const t = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const wn = wts.find(w => w.id === pend.mks[0]?.split("||")[0])?.name || "";
    setLogs(p => [...p, { time: t, type: pend.op ? "update" : "add", desc: wn + " — " + pend.d, op: pend.op, np: pend.np, reason }]);
    setPend(null);
  }, [pend, setP, setLogs, wts]);

  const w = wts.find(x => x.id === sw);

  return (
    <div>
      {pend && <RDlg op={pend.op} np={pend.np} desc={pend.d} sc={pend.sc} onOk={handleConfirm} onNo={() => setPend(null)} />}
      <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📊 Bảng giá</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      {w && (
        <div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--br)" }}>{w.icon} {w.name}</span>
            <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--tm)" }}>{pc} SKU | tr/m³{ce ? " | Click sửa" : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Ngang:</span>
              {wc.attrs.map(ak => {
                const at = ats.find(a => a.id === ak);
                const sel = hak.includes(ak);
                const can = sel || hak.length < 2;
                return (
                  <button key={ak} onClick={() => { if (sel) setHm(p => ({ ...p, [sw]: hak.filter(k => k !== ak) })); else if (can) setHm(p => ({ ...p, [sw]: [...hak, ak] })); }}
                    style={{ padding: "2px 8px", borderRadius: 4, border: sel ? "1.5px solid var(--br)" : "1.5px solid var(--bd)", background: sel ? "var(--br)" : "transparent", color: sel ? "#FAF6F0" : can ? "var(--ts)" : "var(--tm)", cursor: can || sel ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "0.7rem", opacity: !can && !sel ? 0.35 : 1 }}>
                    {at?.name || ak}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {wc.attrValues?.thickness && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "3px 8px", borderRadius: 5, background: ug ? "var(--gbg)" : "var(--bgc)", border: ug ? "1.5px solid var(--gtx)" : "1.5px solid var(--bd)", fontSize: "0.7rem", fontWeight: 600, color: ug ? "var(--gtx)" : "var(--ts)" }}>
                  <input type="checkbox" checked={ug} onChange={e => setUg(e.target.checked)} />Gộp dày
                  {ug && gc > 0 && <span style={{ background: "var(--gtx)", color: "#fff", borderRadius: 3, padding: "0 4px", fontSize: "0.58rem", fontWeight: 700 }}>{gc}</span>}
                </label>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "3px 8px", borderRadius: 5, background: sop ? "var(--acbg)" : "var(--bgc)", border: sop ? "1.5px solid var(--ac)" : "1.5px solid var(--bd)", fontSize: "0.7rem", fontWeight: 600, color: sop ? "var(--ac)" : "var(--ts)" }}>
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

function PgWT({ wts, setWts, ce }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ name: "", nameEn: "", icon: "🌳" });
  const sv = () => { if (!fm.name.trim()) return; if (ed === "new") { setWts(p => [...p, { id: fm.nameEn.toLowerCase().replace(/\s+/g, "_") || "" + Date.now(), ...fm }]); } else { setWts(p => p.map(w => w.id === ed ? { ...w, ...fm } : w)); } setEd(null); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🌳 Loại gỗ</h2>
        {ce && <button onClick={() => { setFm({ name: "", nameEn: "", icon: "🌳" }); setEd("new"); }} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>
      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Icon</label>
              <input value={fm.icon} onChange={e => setFm({ ...fm, icon: e.target.value })} style={{ width: 60, padding: "8px", borderRadius: 6, border: "1.5px solid var(--bd)", textAlign: "center", fontSize: "1.2rem", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên TV</label>
              <input value={fm.name} onChange={e => setFm({ ...fm, name: e.target.value })} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên EN</label>
              <input value={fm.nameEn} onChange={e => setFm({ ...fm, nameEn: e.target.value })} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={sv} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
            <button onClick={() => setEd(null)} style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
          </div>
        </div>
      )}
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead><tr><th style={{ padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" }}>Icon</th><th style={{ padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" }}>Tên</th><th style={{ padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" }}>EN</th>{ce && <th style={{ padding: "8px 10px", textAlign: "left", background: "var(--bgh)", borderBottom: "2px solid var(--bds)" }}></th>}</tr></thead>
          <tbody>{wts.map((w, i) => (
            <tr key={w.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)" }}>{w.icon}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700 }}>{w.name}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)" }}>{w.nameEn}</td>
              {ce && <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)" }}>
                <button onClick={() => { setFm({ name: w.name, nameEn: w.nameEn, icon: w.icon }); setEd(w.id); }} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
              </td>}
            </tr>
          ))}</tbody>
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

export default function App() {
  const [pg, setPg] = useState("pricing");
  const [role, setRole] = useState("admin");
  const [wts, setWts] = useState(initWT);
  const [ats] = useState(initAT);
  const [cfg] = useState(initCFG);
  const [prices, setP] = useState(genPrices);
  const [logs, setLogs] = useState([]);
  const ce = role === "admin";

  const renderPage = () => {
    switch (pg) {
      case "pricing": return <PgPrice wts={wts} ats={ats} cfg={cfg} prices={prices} setP={setP} logs={logs} setLogs={setLogs} ce={ce} />;
      case "wood_types": return <PgWT wts={wts} setWts={setWts} ce={ce} />;
      case "sku": return <PgSKU wts={wts} cfg={cfg} prices={prices} />;
      default: return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Trang "{pg}" đang phát triển</div>;
    }
  };

  return (
    <div style={{ ...THEME, display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', sans-serif", color: "var(--tp)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .pcell:hover { background: var(--hv) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--bds); border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
      <Sidebar pg={pg} setPg={setPg} role={role} setRole={setRole} />
      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1400, overflowX: "hidden" }}>
        {!ce && <div style={{ marginBottom: 12, padding: "6px 14px", borderRadius: 7, background: "var(--acbg)", border: "1px solid var(--ac)", fontSize: "0.75rem", color: "var(--ac)", fontWeight: 700, display: "inline-block" }}>👁 Chế độ xem</div>}
        {renderPage()}
      </main>
    </div>
  );
}
