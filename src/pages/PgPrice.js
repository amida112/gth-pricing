import React, { useState, useCallback, useMemo, useEffect } from "react";
import { bpk, autoGrp, autoGrpLength, resolvePriceAttrs, getPriceGroupValues, isM2Wood } from "../utils";
import { WoodPicker, RDlg } from "../components/Matrix";
import Matrix from "../components/Matrix";

// ── PinePriceManager — Bảng giá dạng danh sách cho gỗ định giá per-bundle ────

function PinePriceManager({ woodId, bundles, setBundles, ats, ce, useAPI, notify }) {
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const map = {};
    bundles.filter(b => b.woodId === woodId && b.status !== 'Đã bán').forEach(b => {
      const key = bpk(b.woodId, b.attributes);
      if (!map[key]) map[key] = { attrs: b.attributes, price: null, bundles: [], totalM3: 0, totalBoards: 0 };
      if (map[key].price == null && b.unitPrice != null) map[key].price = b.unitPrice;
      map[key].bundles.push(b);
      map[key].totalM3 += parseFloat(b.remainingVolume) || 0;
      map[key].totalBoards += b.remainingBoards || 0;
    });
    return Object.entries(map).sort(([, a], [, b]) =>
      (parseFloat(a.attrs.thickness) || 0) - (parseFloat(b.attrs.thickness) || 0) ||
      (parseFloat(a.attrs.width) || 0) - (parseFloat(b.attrs.width) || 0) ||
      (parseFloat(a.attrs.length) || 0) - (parseFloat(b.attrs.length) || 0) ||
      (a.attrs.quality || '').localeCompare(b.attrs.quality || '')
    ).map(([key, g]) => ({ key, ...g }));
  }, [bundles, woodId]);

  const handleSave = async (group) => {
    const newPrice = parseFloat(editVal);
    if (isNaN(newPrice) || newPrice <= 0) { notify('Giá không hợp lệ', false); return; }
    if (!useAPI) { notify('Cần kết nối API', false); return; }
    setSaving(true);
    try {
      const { updateBundle } = await import('../api.js');
      const toUpdate = group.bundles.filter(b => b.status !== 'Đã bán');
      for (const b of toUpdate) {
        const r = await updateBundle(b.id, { unit_price: newPrice });
        if (r?.error) throw new Error(r.error);
      }
      setBundles(prev => prev.map(b =>
        toUpdate.some(u => u.id === b.id) ? { ...b, unitPrice: newPrice } : b
      ));
      setEditing(null);
      notify(`Đã cập nhật giá ${newPrice} tr/m³ cho ${toUpdate.length} kiện`);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const th = { padding: '7px 10px', background: 'var(--bgh)', borderBottom: '2px solid var(--bds)', fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--brl)', fontWeight: 700, whiteSpace: 'nowrap' };
  const tdc = (extra = {}) => ({ padding: '7px 10px', borderBottom: '1px solid var(--bd)', fontSize: '0.78rem', whiteSpace: 'nowrap', ...extra });

  return (
    <div>
      <div style={{ marginBottom: 10, fontSize: '0.72rem', color: 'var(--tm)' }}>
        Giá lưu theo từng kiện — tr/m³{ce ? ' · Click ô giá hoặc nút Sửa để cập nhật cả nhóm' : ''}
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: '0.82rem', background: 'var(--bgc)', borderRadius: 8, border: '1px solid var(--bd)' }}>
          Chưa có kiện nào trong kho
        </div>
      ) : (
        <div style={{ borderRadius: 8, border: '1px solid var(--bd)', overflow: 'hidden', background: 'var(--bgc)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th style={th}>Dày (mm)</th>
                <th style={th}>Rộng (mm)</th>
                <th style={th}>Dài (mm)</th>
                <th style={th}>Chất lượng</th>
                <th style={{ ...th, textAlign: 'right' }}>Giá (tr/m³)</th>
                <th style={{ ...th, textAlign: 'right' }}>Số kiện</th>
                <th style={{ ...th, textAlign: 'right' }}>KL tồn (m³)</th>
                {ce && <th style={th}></th>}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => {
                const isEdit = editing === g.key;
                return (
                  <tr key={g.key} style={{ background: i % 2 ? 'var(--bgs)' : '#fff' }}>
                    <td style={tdc({ fontWeight: 700, color: 'var(--br)' })}>{g.attrs.thickness || '—'}</td>
                    <td style={tdc()}>{g.attrs.width || '—'}</td>
                    <td style={tdc()}>{g.attrs.length || '—'}</td>
                    <td style={tdc()}>{g.attrs.quality || '—'}</td>
                    <td style={tdc({ textAlign: 'right' })}>
                      {isEdit ? (
                        <input autoFocus type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(g); if (e.key === 'Escape') setEditing(null); }}
                          style={{ width: 80, padding: '3px 6px', borderRadius: 4, border: '1.5px solid var(--ac)', fontSize: '0.78rem', textAlign: 'right', outline: 'none' }} />
                      ) : (
                        <span onClick={() => ce && (setEditing(g.key), setEditVal(g.price != null ? String(g.price) : ''))}
                          style={{ fontWeight: 700, color: g.price != null ? 'var(--ac)' : 'var(--tm)', cursor: ce ? 'pointer' : 'default', padding: '2px 4px', borderRadius: 3 }}
                          className={ce ? 'pcell' : ''}>
                          {g.price != null ? g.price.toFixed(1) : '—'}
                        </span>
                      )}
                    </td>
                    <td style={tdc({ textAlign: 'right', color: 'var(--ts)' })}>{g.bundles.length}</td>
                    <td style={tdc({ textAlign: 'right', fontWeight: 600, color: g.totalM3 > 0 ? 'var(--gn)' : 'var(--tm)' })}>{g.totalM3.toFixed(3)}</td>
                    {ce && (
                      <td style={tdc()}>
                        {isEdit ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleSave(g)} disabled={saving}
                              style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: 'var(--ac)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                              {saving ? '...' : 'Lưu'}
                            </button>
                            <button onClick={() => setEditing(null)}
                              style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(g.key); setEditVal(g.price != null ? String(g.price) : ''); }}
                            style={{ padding: '3px 10px', borderRadius: 4, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--brl)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}>✎ Sửa</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PgPrice ───────────────────────────────────────────────────────────────────

export default function PgPrice({ wts, ats, cfg, prices, setP, logs, setLogs, ce, seeCostPrice = true, useAPI, notify, bundles = [], setBundles }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [hm, setHm] = useState(() => { const m = {}; Object.entries(cfg).forEach(([k, c]) => { m[k] = c.defaultHeader || []; }); return m; });
  const [ug, setUg] = useState(false);
  const [ul, setUl] = useState(false);
  const [sop, setSop] = useState(false);
  const [soi, setSoi] = useState(false);
  const [pend, setPend] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFilters, setBulkFilters] = useState({}); // { attrId: Set<val> }
  const [bulkPrice, setBulkPrice] = useState("");

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
      const key = bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg));
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
      if (w.pricingMode === 'perBundle') { counts[w.id] = 0; return; }
      const woodCfg = cfg[w.id];
      if (!woodCfg) { counts[w.id] = 0; return; }
      let combos = [{}];
      (woodCfg.attrs || []).forEach(atId => {
        const vals = getPriceGroupValues(atId, woodCfg);
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

  // V-06: tính danh sách SKU khớp bulk filter
  const bulkMatchKeys = useMemo(() => {
    if (!showBulk || !wc.attrs.length) return [];
    let combos = [{}];
    wc.attrs.forEach(ak => {
      const filterVals = bulkFilters[ak];
      const vals = (filterVals && filterVals.size > 0) ? [...filterVals] : (wc.attrValues?.[ak] || []);
      if (!vals.length) return;
      const next = [];
      combos.forEach(c => vals.forEach(v => next.push({ ...c, [ak]: v })));
      combos = next;
    });
    return combos.map(combo => bpk(sw, combo));
  }, [showBulk, sw, wc, bulkFilters]);

  // Set các bpk key của loại gỗ hiện tại có tồn kho nhưng chưa có giá (để highlight Matrix)
  const unpricedInStockSet = useMemo(() => {
    const set = new Set();
    const woodCfg = cfg[sw];
    if (!woodCfg || wts.find(w => w.id === sw)?.pricingMode === 'perBundle') return set;
    let combos = [{}];
    (woodCfg.attrs || []).forEach(atId => {
      const vals = getPriceGroupValues(atId, woodCfg);
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

  // V-05: Load lịch sử giá từ API khi chọn loại gỗ
  const [apiLogs, setApiLogs] = useState([]);
  useEffect(() => {
    if (!useAPI || !sw) return;
    import('../api.js').then(api =>
      api.fetchChangeLogs(sw, 30)
        .then(data => {
          const normalized = (data || []).map(r => {
            const wn = wts.find(w => w.id === r.wood_id)?.name || r.wood_id;
            const ts = new Date(r.timestamp);
            const time = ts.toLocaleDateString('vi-VN') + ' ' + ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            return {
              time,
              type: r.old_price == null ? 'add' : 'update',
              desc: wn + ' — ' + r.sku_key,
              op: r.old_price,
              np: r.new_price,
              reason: r.reason,
              fromApi: true,
            };
          });
          setApiLogs(normalized);
        })
        .catch(() => {})
    );
  }, [sw, useAPI]); // wts ổn định — không cần thêm

  const onReq = useCallback((mks, op, d, sc, ocp, op2) => {
    setPend({ mks, op, d, sc, ocp, op2 });
  }, []);

  const handleConfirm = useCallback((reason, cp, newPrice, newPrice2) => {
    if (!pend) return;
    // V-06: bulk update uses forcePrice baked into pend
    const effectivePrice = pend.forcePrice !== undefined ? pend.forcePrice : newPrice;
    const effectivePrice2 = newPrice2;
    const priceUnchanged = effectivePrice === pend.op && effectivePrice2 === pend.op2;
    const costUnchanged = (cp ?? null) === (pend.ocp ?? null);
    if (priceUnchanged && costUnchanged) { setPend(null); return; }
    // Cập nhật state local ngay lập tức (UI phản hồi nhanh)
    setP(p => {
      const n = { ...p };
      pend.mks.forEach(k => {
        if (effectivePrice == null) delete n[k];
        else n[k] = {
          price: effectivePrice,
          ...(effectivePrice2 != null && { price2: effectivePrice2 }),
          costPrice: cp ?? p[k]?.costPrice ?? undefined,
          updated: new Date().toISOString().slice(0, 10)
        };
      });
      return n;
    });
    const t = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const wn = wts.find(w => w.id === pend.mks[0]?.split("||")[0])?.name || "";
    setLogs(p => [...p, { time: t, type: pend.op ? "update" : "add", desc: wn + " — " + pend.d, op: pend.op, np: effectivePrice, reason }]);

    // Ghi vào Supabase qua API (chạy ngầm, không block UI)
    if (useAPI) {
      import('../api.js').then(api => {
        pend.mks.forEach(k => {
          const parts = k.split("||");
          const woodId = parts[0];
          const skuKey = parts.slice(1).join("||");
          api.updatePrice(woodId, skuKey, effectivePrice, pend.op, reason, "admin", cp ?? null, effectivePrice2 ?? null)
            .then(r => { if (r?.error) notify("Lỗi lưu giá: " + r.error, false); })
            .catch(err => notify("Lỗi kết nối: " + err.message, false));
        });
      });
    }

    setPend(null);
  }, [pend, setP, setLogs, wts, useAPI, notify]);

  const w = wts.find(x => x.id === sw);
  const isPerBundleWood = w?.pricingMode === 'perBundle';
  const isM2 = isM2Wood(sw, wts);

  return (
    <div>
      {pend && <RDlg op={pend.op} op2={pend.op2} desc={pend.d} sc={pend.sc} curCostPrice={pend.ocp ?? null} onOk={handleConfirm} onNo={() => setPend(null)} isM2={isM2} />}
      <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>📊 Bảng giá</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} badges={unpricedBadges} />
      {w && isPerBundleWood && (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--br)" }}>{w.icon} {w.name}</span>
            <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--tm)" }}>Định giá theo kiện</span>
          </div>
          <PinePriceManager woodId={sw} bundles={bundles} setBundles={setBundles} ats={ats} ce={ce} useAPI={useAPI} notify={notify} />
        </div>
      )}
      {w && !isPerBundleWood && (
        <div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--br)" }}>{w.icon} {w.name}</span>
            <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--tm)" }}>{pc} SKU | {isM2 ? "k/m²" : "tr/m³"}{ce ? " | Click sửa" : ""}</span>
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
          {/* V-06: Bulk price update */}
          {ce && (
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => { setShowBulk(p => !p); setBulkFilters({}); setBulkPrice(""); }}
                style={{ padding: "5px 12px", borderRadius: 5, border: "1.5px solid var(--brl)", background: showBulk ? "var(--brl)" : "transparent", color: showBulk ? "#fff" : "var(--brl)", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>
                {showBulk ? "✕ Đóng hàng loạt" : "🔧 Cập nhật hàng loạt"}
              </button>
            </div>
          )}
          {ce && showBulk && (
            <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 8, background: "var(--bgs)", border: "1.5px solid var(--brl)" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", marginBottom: 10 }}>Lọc SKU cần cập nhật</div>
              {wc.attrs.map(ak => {
                const at = ats.find(a => a.id === ak);
                const vals = wc.attrValues?.[ak] || [];
                const sel = bulkFilters[ak] || new Set();
                return (
                  <div key={ak} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--tm)", marginBottom: 4 }}>{at?.name || ak} <span style={{ color: "var(--ac)" }}>{sel.size > 0 ? `(chọn ${sel.size})` : "(tất cả)"}</span></div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {vals.map(v => {
                        const isSel = sel.has(v);
                        return (
                          <button key={v} onClick={() => setBulkFilters(p => {
                            const prev = new Set(p[ak] || []);
                            isSel ? prev.delete(v) : prev.add(v);
                            return { ...p, [ak]: prev };
                          })} style={{ padding: "3px 9px", borderRadius: 4, fontSize: "0.72rem", fontWeight: isSel ? 700 : 500, border: "1.5px solid " + (isSel ? "var(--br)" : "var(--bd)"), background: isSel ? "var(--br)" : "transparent", color: isSel ? "#FAF6F0" : "var(--ts)", cursor: "pointer" }}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--ts)" }}>Giá mới (tr/m³):</span>
                <input type="number" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="Nhập giá..."
                  style={{ width: 110, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none" }} />
                <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>→ <b style={{ color: bulkMatchKeys.length > 0 ? "var(--ac)" : "var(--tm)" }}>{bulkMatchKeys.length} SKU</b></span>
                <button
                  disabled={!bulkMatchKeys.length || !bulkPrice}
                  onClick={() => {
                    const np = parseFloat(bulkPrice);
                    if (!np || isNaN(np)) return;
                    const desc = `Hàng loạt ${bulkMatchKeys.length} SKU — ${wts.find(w => w.id === sw)?.name}`;
                    onReq(bulkMatchKeys, null, desc, false, null);
                    setShowBulk(false);
                  }}
                  style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: (!bulkMatchKeys.length || !bulkPrice) ? "var(--bd)" : "var(--ac)", color: (!bulkMatchKeys.length || !bulkPrice) ? "var(--tm)" : "#fff", cursor: (!bulkMatchKeys.length || !bulkPrice) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                  Áp dụng
                </button>
              </div>
            </div>
          )}
          <Matrix wk={sw} wc={wc} prices={prices} onReq={onReq} hak={hak} sop={sop} soi={soi} ug={ug} grps={grps} ul={ul} lgrps={lgrps} ce={ce} seeCostPrice={seeCostPrice} ats={ats} unpricedSet={unpricedInStockSet} stockSet={stockSet} isM2={isM2} />
        </div>
      )}
      {w && (logs.length > 0 || apiLogs.length > 0) && !isPerBundleWood && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
                Lịch sử thay đổi giá
                {apiLogs.length > 0 && <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--tm)" }}>({apiLogs.length} bản ghi)</span>}
              </h3>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Session logs (ưu tiên hiện trước) */}
                {logs.slice().reverse().slice(0, 15).map((l, i) => (
                  <div key={"s" + i} style={{ padding: "5px 8px", borderRadius: 5, background: "rgba(242,101,34,0.05)", fontSize: "0.72rem", border: "1px solid rgba(242,101,34,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: l.type === "add" ? "var(--gn)" : "var(--ac)", flexShrink: 0 }} />
                      <span style={{ color: "var(--tm)", fontSize: "0.65rem", flexShrink: 0 }}>{l.time}</span>
                      <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.desc}</span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>
                        {l.op != null && <><span style={{ textDecoration: "line-through", color: "var(--tm)" }}>{l.op}</span>{" → "}</>}
                        <span style={{ color: l.type === "add" ? "var(--gn)" : "var(--ac)" }}>{l.np ?? "-"}</span>
                      </span>
                    </div>
                    {l.reason && <div style={{ paddingLeft: 11, color: "var(--tm)", fontSize: "0.65rem", fontStyle: "italic", marginTop: 1 }}>💬 {l.reason}</div>}
                  </div>
                ))}
                {/* API logs (lịch sử từ DB) */}
                {apiLogs.map((l, i) => (
                  <div key={"a" + i} style={{ padding: "5px 8px", borderRadius: 5, background: "var(--bgs)", fontSize: "0.72rem", border: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: l.type === "add" ? "var(--gn)" : "var(--ac)", flexShrink: 0 }} />
                      <span style={{ color: "var(--tm)", fontSize: "0.65rem", flexShrink: 0 }}>{l.time}</span>
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
  );
}
