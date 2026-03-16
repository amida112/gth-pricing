import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { bpk, cart } from "../utils";

export function WoodPicker({ wts, sel, onSel, badges }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {wts.map(w => {
        const s = sel === w.id;
        const badge = badges?.[w.id] || 0;
        return (
          <button key={w.id} onClick={() => onSel(w.id)} className="wood-picker-btn"
            style={{ position: "relative", padding: "6px 12px", borderRadius: 6, border: s ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: s ? "var(--acbg)" : "var(--bgc)", color: s ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontWeight: s ? 700 : 500, fontSize: "0.78rem" }}>
            {w.icon} {w.name}
            {badge > 0 && (
              <span style={{ position: "absolute", top: -7, right: -7, minWidth: 16, height: 16, borderRadius: 8, background: "var(--dg)", color: "#fff", fontSize: "0.55rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ECell({ value, costPrice, ce, canEdit, onEdit, isNullPrice }) {
  return (
    <td onClick={canEdit ? onEdit : undefined} className={canEdit ? "pcell" : ""}
      style={{ padding: "5px 4px", textAlign: "center", cursor: canEdit ? "pointer" : "default", color: value != null ? "var(--tp)" : isNullPrice ? "var(--ac)" : "var(--tm)", fontWeight: value != null ? 700 : isNullPrice ? 700 : 400, fontSize: value != null ? "0.82rem" : "0.7rem", borderBottom: "1px solid var(--bd)", borderRight: "1px solid var(--bd)", fontVariantNumeric: "tabular-nums", overflow: "hidden", background: isNullPrice ? "rgba(242,101,34,0.07)" : undefined }}>
      {value != null ? value.toFixed(1) : isNullPrice ? "⚠" : "—"}
      {ce && costPrice != null && <div style={{ fontSize: "0.58rem", color: "var(--tm)", fontWeight: 500, lineHeight: 1.2, marginTop: 1 }}>{costPrice.toFixed(1)}</div>}
    </td>
  );
}

export function RDlg({ op, desc, sc, curCostPrice, onOk, onNo }) {
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

export function ConfirmDlg({ title, message, warn, onOk, onNo }) {
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

export default function Matrix({ wk, wc, prices, onReq, hak, sop, soi, ug, grps, ce, ats, unpricedSet, stockSet }) {

  const hAttrs = useMemo(() => hak.filter(a => wc.attrs.includes(a)).map(ak => {
    const at = ats.find(a => a.id === ak);
    const vs = wc.attrValues[ak] || [];
    if (ug && ak === "thickness" && grps) return { key: ak, label: at?.name || ak, values: grps.map(g => g.label), ig: true };
    return { key: ak, label: at?.name || ak, values: vs, ig: false };
  }), [wc, hak, ug, grps, ats]);

  const rAttrs = useMemo(() => wc.attrs.filter(a => !hak.includes(a)).map(ak => {
    const at = ats.find(a => a.id === ak);
    const vs = wc.attrValues[ak] || [];
    if (ug && ak === "thickness" && grps) return { key: ak, label: at?.name || ak, values: grps.map(g => g.label), ig: true };
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

  const gsi = useCallback((ra, ca) => {
    if (!stockSet) return false;
    return gmk(ra, ca).some(k => stockSet.has(k));
  }, [stockSet, gmk]);

  const gsc = useCallback((ra, ca) => {
    if (!ug || !grps) return 1;
    const tv = { ...ra, ...ca }["thickness"];
    const g = grps.find(gr => gr.label === tv);
    return g ? g.members.length : 1;
  }, [ug, grps]);

  const visColC = useMemo(() => {
    if (!sop && !soi) return colC;
    return colC.filter(c => allRC.some(r => (!sop || gp(r.a, c.a) != null) && (!soi || gsi(r.a, c.a))));
  }, [colC, allRC, sop, soi, gp, gsi]);

  const rC = useMemo(() => {
    if (!sop && !soi) return allRC;
    return allRC.filter(r => visColC.some(c => (!sop || gp(r.a, c.a) != null) && (!soi || gsi(r.a, c.a))));
  }, [allRC, visColC, sop, soi, gp, gsi]);

  const rsi = useMemo(() => {
    if (rAttrs.length <= 1 || sop || soi) return null;
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
          {visColC.map((_, i) => <col key={i} style={{ width: PRICE_COL_W, minWidth: PRICE_COL_W }} />)}
        </colgroup>
        <thead>
          {hAttrs.length <= 1 ? (
            <tr>
              {rAttrs.map((a, i) => <th key={a.key} style={{ ...hs, position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2 }}>{a.label}</th>)}
              {hAttrs.length === 0
                ? <th style={{ ...hs, ...ha }}>Giá</th>
                : visColC.map(c => { const v = c.a[hAttrs[0].key]; return <th key={v} style={{ ...hs, ...ha }}>{v}</th>; })
              }
            </tr>
          ) : (
            <>
              <tr>
                {rAttrs.map((a, i) => <th key={a.key} rowSpan={2} style={{ ...hs, position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 4 : 2, verticalAlign: "middle" }}>{a.label}</th>)}
                {hAttrs[0].values.map(v1 => { const cs = visColC.filter(c => c.a[hAttrs[0].key] === v1).length; return cs > 0 ? <th key={v1} colSpan={cs} style={{ ...hs, ...ha, width: "auto", maxWidth: "none", fontSize: "0.7rem" }}>{v1}</th> : null; })}
              </tr>
              <tr>
                {visColC.map(c => { const v2 = c.a[hAttrs[1].key]; const v1 = c.a[hAttrs[0].key]; return <th key={v1 + v2} style={{ padding: "4px 3px", textAlign: "center", background: "var(--brl)", color: "#FAF6F0", fontWeight: 700, fontSize: "0.6rem", borderBottom: "2px solid var(--bds)", borderRight: "1px solid var(--bd)", minWidth: PRICE_COL_W, width: PRICE_COL_W }}>{v2}</th>; })}
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
                {visColC.map((col, cI) => {
                  const cid = rI + "-" + cI;
                  const pr = gp(row.a, col.a);
                  const cp = gcp(row.a, col.a);
                  const sc = gsc(row.a, col.a);
                  return (
                    <ECell key={cid} value={pr} costPrice={cp} ce={ce} canEdit={ce} isNullPrice={unpricedSet ? gmk(row.a, col.a).some(k => unpricedSet.has(k)) : false}
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
