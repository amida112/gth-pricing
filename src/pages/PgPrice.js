import React, { useState, useCallback, useMemo } from "react";
import { bpk, autoGrp, autoGrpLength } from "../utils";
import { WoodPicker, RDlg } from "../components/Matrix";
import Matrix from "../components/Matrix";

export default function PgPrice({ wts, ats, cfg, prices, setP, logs, setLogs, ce, seeCostPrice = true, useAPI, notify, bundles = [] }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [hm, setHm] = useState(() => { const m = {}; Object.entries(cfg).forEach(([k, c]) => { m[k] = c.defaultHeader || []; }); return m; });
  const [ug, setUg] = useState(false);
  const [ul, setUl] = useState(false);
  const [sop, setSop] = useState(false);
  const [soi, setSoi] = useState(false);
  const [pend, setPend] = useState(null);

  const wc = cfg[sw] || { attrs: [], attrValues: {}, defaultHeader: [] };
  const hak = hm[sw] || wc.defaultHeader || [];
  const grps = useMemo(() => ug ? autoGrp(sw, wc, prices) : null, [ug, sw, wc, prices]);
  const gc = grps ? grps.filter(g => g.members.length > 1).length : 0;
  const lgrps = useMemo(() => ul ? autoGrpLength(sw, wc, prices) : null, [ul, sw, wc, prices]);
  const glc = lgrps ? lgrps.filter(g => g.members.length > 1).length : 0;
  const pc = useMemo(() => Object.keys(prices).filter(k => k.startsWith(sw + "||")).length, [prices, sw]);

  // Tính tồn kho từ bundles: bpk -> tổng số tấm còn lại (bỏ qua kiện đã bán)
  const inventoryMap = useMemo(() => {
    const map = {};
    bundles.forEach(b => {
      if (b.status === 'Đã bán' || b.status === 'Chưa được bán') return;
      const key = bpk(b.woodId, b.attributes);
      map[key] = (map[key] || 0) + (b.remainingBoards || 0);
    });
    return map;
  }, [bundles]);

  // Set các bpk key của loại gỗ hiện tại có tồn kho (để filter Matrix khi soi)
  const stockSet = useMemo(() => {
    const set = new Set();
    Object.entries(inventoryMap).forEach(([key, boards]) => {
      if (boards > 0 && key.startsWith(sw + '||')) set.add(key);
    });
    return set;
  }, [inventoryMap, sw]);

  // Badge: đếm SKU có tồn kho > 0 nhưng chưa có giá, theo từng loại gỗ
  const unpricedBadges = useMemo(() => {
    const counts = {};
    wts.forEach(w => {
      const woodCfg = cfg[w.id];
      if (!woodCfg) { counts[w.id] = 0; return; }
      let combos = [{}];
      (woodCfg.attrs || []).forEach(atId => {
        const vals = woodCfg.attrValues?.[atId] || [];
        if (!vals.length) return;
        const next = [];
        combos.forEach(c => vals.forEach(v => next.push({ ...c, [atId]: v })));
        combos = next;
      });
      counts[w.id] = combos.filter(combo => {
        const key = bpk(w.id, combo);
        return (inventoryMap[key] || 0) > 0 && (prices[key] === undefined || prices[key]?.price == null);
      }).length;
    });
    return counts;
  }, [wts, cfg, prices, inventoryMap]);

  // Set các bpk key của loại gỗ hiện tại có tồn kho nhưng chưa có giá (để highlight Matrix)
  const unpricedInStockSet = useMemo(() => {
    const set = new Set();
    const woodCfg = cfg[sw];
    if (!woodCfg) return set;
    let combos = [{}];
    (woodCfg.attrs || []).forEach(atId => {
      const vals = woodCfg.attrValues?.[atId] || [];
      if (!vals.length) return;
      const next = [];
      combos.forEach(c => vals.forEach(v => next.push({ ...c, [atId]: v })));
      combos = next;
    });
    combos.forEach(combo => {
      const key = bpk(sw, combo);
      if ((inventoryMap[key] || 0) > 0 && (prices[key] === undefined || prices[key]?.price == null)) {
        set.add(key);
      }
    });
    return set;
  }, [sw, cfg, prices, inventoryMap]);

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

    // Ghi vào Supabase qua API (chạy ngầm, không block UI)
    if (useAPI) {
      import('../api.js').then(api => {
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
      <WoodPicker wts={wts} sel={sw} onSel={setSw} badges={unpricedBadges} />
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
                const ord = hak.indexOf(ak);
                return (
                  <button key={ak} onClick={() => { if (sel) setHm(p => ({ ...p, [sw]: hak.filter(k => k !== ak) })); else if (can) setHm(p => ({ ...p, [sw]: [...hak, ak] })); }}
                    style={{ padding: "5px 10px", borderRadius: 4, border: sel ? "1.5px solid var(--br)" : "1.5px solid var(--bd)", background: sel ? "var(--br)" : "transparent", color: sel ? "#FAF6F0" : can ? "var(--ts)" : "var(--tm)", cursor: can || sel ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "0.72rem", opacity: !can && !sel ? 0.35 : 1, minHeight: 32 }}>
                    {sel ? <span style={{ opacity: 0.6, marginRight: 3 }}>{ord + 1}.</span> : null}{at?.name || ak}
                  </button>
                );
              })}
              {hak.length === 2 && (
                <button onClick={() => setHm(p => ({ ...p, [sw]: [hak[1], hak[0]] }))} title="Đổi thứ tự"
                  style={{ padding: "5px 10px", borderRadius: 4, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", minHeight: 32 }}>⇄</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {wc.attrValues?.thickness && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: ug ? "var(--gbg)" : "var(--bgc)", border: ug ? "1.5px solid var(--gtx)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: ug ? "var(--gtx)" : "var(--ts)", minHeight: 32 }}>
                  <input type="checkbox" checked={ug} onChange={e => setUg(e.target.checked)} />Gộp dày
                  {ug && gc > 0 && <span style={{ background: "var(--gtx)", color: "#fff", borderRadius: 3, padding: "0 4px", fontSize: "0.58rem", fontWeight: 700 }}>{gc}</span>}
                </label>
              )}
              {wc.attrValues?.length && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: ul ? "var(--gbg)" : "var(--bgc)", border: ul ? "1.5px solid var(--gtx)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: ul ? "var(--gtx)" : "var(--ts)", minHeight: 32 }}>
                  <input type="checkbox" checked={ul} onChange={e => setUl(e.target.checked)} />Gộp dài
                  {ul && glc > 0 && <span style={{ background: "var(--gtx)", color: "#fff", borderRadius: 3, padding: "0 4px", fontSize: "0.58rem", fontWeight: 700 }}>{glc}</span>}
                </label>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: sop ? "var(--acbg)" : "var(--bgc)", border: sop ? "1.5px solid var(--ac)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: sop ? "var(--ac)" : "var(--ts)", minHeight: 32 }}>
                <input type="checkbox" checked={sop} onChange={e => setSop(e.target.checked)} />Chỉ có giá
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "5px 10px", borderRadius: 5, background: soi ? "rgba(50,79,39,0.1)" : "var(--bgc)", border: soi ? "1.5px solid var(--gn)" : "1.5px solid var(--bd)", fontSize: "0.72rem", fontWeight: 600, color: soi ? "var(--gn)" : "var(--ts)", minHeight: 32 }}>
                <input type="checkbox" checked={soi} onChange={e => setSoi(e.target.checked)} />Chỉ tồn kho
              </label>
            </div>
          </div>
          {ug && grps && gc > 0 && (
            <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 6, background: "var(--gbg)", border: "1px solid var(--gbd)", fontSize: "0.68rem", color: "var(--gtx)", display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              <strong>Gộp dày:</strong>
              {grps.filter(g => g.members.length > 1).map((g, i) => <span key={i} style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(124,92,191,0.1)", fontWeight: 700 }}>{g.label}</span>)}
            </div>
          )}
          {ul && lgrps && glc > 0 && (
            <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 6, background: "var(--gbg)", border: "1px solid var(--gbd)", fontSize: "0.68rem", color: "var(--gtx)", display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              <strong>Gộp dài:</strong>
              {lgrps.filter(g => g.members.length > 1).map((g, i) => <span key={i} style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(124,92,191,0.1)", fontWeight: 700 }}>{g.label} ({g.members.join(', ')})</span>)}
            </div>
          )}
          <Matrix wk={sw} wc={wc} prices={prices} onReq={onReq} hak={hak} sop={sop} soi={soi} ug={ug} grps={grps} ul={ul} lgrps={lgrps} ce={ce} seeCostPrice={seeCostPrice} ats={ats} unpricedSet={unpricedInStockSet} stockSet={stockSet} />
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
