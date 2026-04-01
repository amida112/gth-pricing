import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { bpk, autoGrp, resolvePriceAttrs, getPriceGroupValues, isM2Wood } from "../utils";
import { WoodPicker } from "../components/Matrix";
import Matrix from "../components/Matrix";
import Dialog from "../components/Dialog";

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

// ── PendingCellDlg — Dialog nhập giá trong edit mode (không lý do) ────────────

function PendingCellDlg({ op, op2, desc, sc, curCostPrice, onOk, onNo, isM2, attrs, wk, wc, prices, stockSet }) {
  const npRef = useRef(null);
  const [np, setNp] = useState(op != null ? String(op) : "");
  const [np2, setNp2] = useState(op2 != null ? String(op2) : "");
  const [cp, setCp] = useState(curCostPrice != null ? String(curCostPrice) : "");
  const [selThick, setSelThick] = useState(new Set()); // dày khác được chọn
  // Danh sách dày khác (cùng thuộc tính, chỉ khác thickness)
  const curThickness = attrs?.thickness;
  const allThicknesses = wc?.attrValues?.thickness || [];
  const otherAttrs = attrs ? Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'thickness')) : null;
  const showThicknessList = curThickness && allThicknesses.length > 1 && otherAttrs;

  const thicknessOptions = useMemo(() => {
    if (!showThicknessList) return [];
    return allThicknesses.filter(t => t !== curThickness).map(t => {
      const key = bpk(wk, { ...otherAttrs, thickness: t });
      const p = prices?.[key];
      const inStock = stockSet?.has(key) || false;
      return { thickness: t, key, price: p?.price ?? null, inStock };
    });
  }, [showThicknessList, allThicknesses, curThickness, otherAttrs, wk, prices]);

  const handleOk = useCallback(() => {
    const newPrice = np.trim() ? parseFloat(np) : null;
    const newPrice2 = isM2 ? (np2.trim() ? parseFloat(np2) : null) : undefined;
    const cpVal = cp.trim() ? parseFloat(cp) : (curCostPrice ?? null);
    // Build extra items cho các dày được chọn (key + thickness để build desc đúng)
    const extraItems = thicknessOptions.filter(o => selThick.has(o.thickness)).map(o => ({ key: o.key, thickness: o.thickness }));
    onOk(newPrice, newPrice2, cpVal, extraItems.length ? extraItems : undefined);
  }, [np, np2, cp, curCostPrice, isM2, onOk, selThick, thicknessOptions]);

  const IS = (hi) => ({ width: "100%", padding: "8px 10px", borderRadius: 7, border: hi ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: "var(--bg)", color: hi ? "var(--ac)" : "var(--tp)", fontSize: "1rem", fontWeight: hi ? 800 : 600, outline: "none", boxSizing: "border-box", textAlign: "center" });
  const OldBox = ({ val, label }) => (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--tm)", display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "var(--bgs)", color: val != null ? "var(--br)" : "var(--tm)", fontSize: "1rem", fontWeight: 800, textAlign: "center" }}>{val != null ? (isM2 ? val.toFixed(0) : val.toFixed(1)) : "—"}</div>
    </div>
  );

  const otherDesc = otherAttrs ? Object.values(otherAttrs).join(' | ') : '';

  return (
    <Dialog open={true} onClose={onNo} onOk={handleOk} title="Chỉnh giá" width={isM2 ? 460 : 420}>
        <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "var(--ts)" }}>
          {desc}{sc > 1 && <span style={{ marginLeft: 6, color: "var(--ac)", fontWeight: 700 }}>×{sc} SKU</span>}
          <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 4, background: "rgba(234,179,8,0.15)", color: "#92701a", fontSize: "0.68rem", fontWeight: 700 }}>Đang trong đợt chỉnh giá</span>
        </p>
        {isM2 ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <OldBox val={op} label="Giá lẻ cũ (k/m²)" />
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá lẻ mới (k/m²)</label>
                <input ref={npRef} autoFocus type="number" step="1" value={np} onChange={e => setNp(e.target.value)} style={IS(true)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <OldBox val={op2} label="Giá nguyên kiện cũ" />
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá nguyên kiện mới</label>
                <input type="number" step="1" value={np2} onChange={e => setNp2(e.target.value)} style={IS(false)} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <OldBox val={op} label="Giá cũ" />
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá mới</label>
              <input ref={npRef} autoFocus type="number" step="0.1" value={np} onChange={e => setNp(e.target.value)} style={IS(true)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Giá nhập</label>
              <input type="number" step="0.1" value={cp} onChange={e => setCp(e.target.value)} placeholder={curCostPrice != null ? String(curCostPrice) : "—"} style={IS(false)} />
            </div>
          </div>
        )}

        {/* Section áp dụng cho dày khác */}
        {showThicknessList && thicknessOptions.length > 0 && (
          <div style={{ marginBottom: 14, borderTop: "1px solid var(--bd)", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>Áp dụng cho dày khác</span>
              <span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>({otherDesc})</span>
              {selThick.size > 0 && <span style={{ marginLeft: "auto", fontSize: "0.62rem", fontWeight: 700, color: "var(--ac)" }}>+{selThick.size} dày</span>}
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 7, border: "1px solid var(--bd)", background: "var(--bgs)" }}>
              {thicknessOptions.map(({ thickness: t, price: tp, inStock }, i) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", borderBottom: i < thicknessOptions.length - 1 ? "1px solid var(--bd)" : "none", background: selThick.has(t) ? "rgba(242,101,34,0.06)" : "transparent" }}>
                  <input type="checkbox" checked={selThick.has(t)} onChange={e => {
                    const next = new Set(selThick);
                    e.target.checked ? next.add(t) : next.delete(t);
                    setSelThick(next);
                  }} style={{ accentColor: "var(--ac)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--br)", minWidth: 40 }}>{t}</span>
                  <span style={{ fontSize: "0.72rem", color: tp != null ? "var(--ts)" : "var(--tm)", fontStyle: tp != null ? "normal" : "italic", flex: 1 }}>
                    {tp != null ? `giá: ${isM2 ? tp.toFixed(0) : tp.toFixed(1)}` : "chưa có giá"}
                  </span>
                  <span style={{ fontSize: "0.6rem", fontWeight: 600, padding: "1px 6px", borderRadius: 3, flexShrink: 0, background: inStock ? "rgba(50,79,39,0.1)" : "rgba(107,66,38,0.08)", color: inStock ? "var(--gn)" : "var(--tm)" }}>
                    {inStock ? "Có kho" : "Trống"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
          <button onClick={handleOk} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
            OK{selThick.size > 0 && ` (+${selThick.size} dày)`}
          </button>
        </div>
    </Dialog>
  );
}

// ── BatchReasonDlg — Dialog nhập lý do khi kết thúc đợt ─────────────────────

function BatchReasonDlg({ changeCount, changes, onOk, onNo }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const handleOk = useCallback(() => { setTouched(true); if (!reason.trim()) return; onOk(reason.trim()); }, [reason, onOk]);

  return (
    <Dialog open={true} onClose={onNo} onOk={handleOk} title="Kết thúc đợt điều chỉnh giá" width={440}>
        <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--ts)", lineHeight: 1.5 }}>
          Sẽ lưu <strong style={{ color: "var(--ac)" }}>{changeCount} thay đổi giá</strong>. Nhập lý do để tra cứu sau.
        </p>
        {changes.length > 0 && (
          <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 12, padding: "8px 10px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)", display: "flex", flexDirection: "column", gap: 3 }}>
            {changes.map((ch, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem" }}>
                <span title={ch.desc} style={{ flex: 1, color: "var(--ts)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.desc}</span>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>
                  {ch.op != null && <><span style={{ textDecoration: "line-through", color: "var(--tm)" }}>{typeof ch.op === 'number' ? ch.op.toFixed(1) : ch.op}</span>{" → "}</>}
                  <span style={{ color: "var(--ac)" }}>{ch.np != null ? (typeof ch.np === 'number' ? ch.np.toFixed(1) : ch.np) : "—"}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--br)", display: "block", marginBottom: 4 }}>Lý do điều chỉnh *</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="VD: Nhà cung cấp tăng giá tháng 3..."
          style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: (touched && !reason.trim()) ? "2px solid var(--dg)" : "1.5px solid var(--bd)", background: "var(--bg)", color: "var(--tp)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", marginBottom: (touched && !reason.trim()) ? 4 : 16 }} />
        {touched && !reason.trim() && <p style={{ color: "var(--dg)", fontSize: "0.72rem", margin: "0 0 12px", fontWeight: 600 }}>⚠ Cần nhập lý do trước khi lưu</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy bỏ đợt</button>
          <button onClick={handleOk} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: reason.trim() ? "var(--ac)" : "var(--bd)", color: reason.trim() ? "#fff" : "var(--tm)", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>Lưu đợt giá</button>
        </div>
    </Dialog>
  );
}

// ── PgPrice ───────────────────────────────────────────────────────────────────

export default function PgPrice({ wts, ats, cfg, prices, setP, logs, setLogs, ce, seeCostPrice = true, useAPI, notify, bundles = [], setBundles, ugPersist = false, onToggleUg }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [hm, setHm] = useState(() => { const m = {}; Object.entries(cfg).forEach(([k, c]) => { m[k] = c.defaultHeader || []; }); return m; });
  const ug = ugPersist;
  const setUg = onToggleUg || (() => {});
  const [sop, setSop] = useState(false);
  const [soi, setSoi] = useState(true);

  // ── Ghi chú bảng giá (per wood type) ────────────────────────────────────
  const [priceNote, setPriceNote] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  useEffect(() => {
    if (!useAPI || !sw) return;
    import('../api.js').then(api => api.fetchPriceNote(sw).then(v => { setPriceNote(v); setNoteEditing(false); }));
  }, [sw, useAPI]); // eslint-disable-line
  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      const api = await import('../api.js');
      const r = await api.savePriceNote(sw, noteDraft.trim());
      if (r.error) { notify('Lỗi lưu ghi chú: ' + r.error, false); return; }
      setPriceNote(noteDraft.trim());
      setNoteEditing(false);
    } finally { setNoteSaving(false); }
  };

  // ── Edit mode state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  // pendingChanges: { bpkKey → { oldPrice, newPrice, oldPrice2, newPrice2, oldCostPrice, newCostPrice, desc } }
  const [pendingChanges, setPendingChanges] = useState({});
  const [pendingCellDlg, setPendingCellDlg] = useState(null); // {mks, op, op2, d, sc, ocp}
  const [batchReasonDlg, setBatchReasonDlg] = useState(false);
  const [batchLogs, setBatchLogs] = useState([]); // session batch logs
  const [expandedBatches, setExpandedBatches] = useState(new Set());
  const [cleanupDlg, setCleanupDlg] = useState(false); // dialog xác nhận xóa giá không tồn kho

  const wc = cfg[sw] || { attrs: [], attrValues: {}, defaultHeader: [] };
  const hak = hm[sw] || wc.defaultHeader || [];
  const grps = useMemo(() => ug ? autoGrp(sw, wc, prices) : null, [ug, sw, wc, prices]);
  const gc = grps ? grps.filter(g => g.members.length > 1).length : 0;
  const pc = useMemo(() => Object.keys(prices).filter(k => k.startsWith(sw + "||")).length, [prices, sw]);

  // displayPrices: prices merged với pendingChanges (preview trong bảng)
  const displayPrices = useMemo(() => {
    const pKeys = Object.keys(pendingChanges);
    if (!pKeys.length) return prices;
    const merged = { ...prices };
    pKeys.forEach(k => {
      const ch = pendingChanges[k];
      merged[k] = { ...prices[k], price: ch.newPrice, ...(ch.newPrice2 != null && { price2: ch.newPrice2 }), costPrice: ch.newCostPrice ?? prices[k]?.costPrice, updated: new Date().toISOString().slice(0, 10) };
    });
    return merged;
  }, [prices, pendingChanges]);

  const pendingSet = useMemo(() => new Set(Object.keys(pendingChanges)), [pendingChanges]);

  // Tính tồn kho từ bundles
  const inventoryMap = useMemo(() => {
    const map = {};
    bundles.forEach(b => {
      if (b.status === 'Đã bán' || b.status === 'Chưa được bán') return;
      const key = bpk(b.woodId, resolvePriceAttrs(b.woodId, b.attributes, cfg));
      map[key] = (map[key] || 0) + (b.remainingBoards || 0);
    });
    return map;
  }, [bundles, cfg]);

  const stockSet = useMemo(() => {
    const set = new Set();
    Object.entries(inventoryMap).forEach(([key, boards]) => {
      if (boards > 0 && key.startsWith(sw + '||')) set.add(key);
    });
    return set;
  }, [inventoryMap, sw]);

  const unpricedBadges = useMemo(() => {
    const counts = {};
    wts.forEach(w => {
      if (w.pricingMode === 'perBundle') { counts[w.id] = 0; return; }
      const woodCfg = cfg[w.id];
      if (!woodCfg) { counts[w.id] = 0; return; }
      let combos = [{}];
      (woodCfg.attrs || []).forEach(atId => {
        const vals = getPriceGroupValues(atId, woodCfg);
        const isOptional = atId === 'width'; // width luôn optional — trống = BT
        if (!vals.length && !isOptional) return;
        const next = [];
        combos.forEach(c => {
          if (isOptional) next.push({ ...c });
          vals.forEach(v => next.push({ ...c, [atId]: v }));
        });
        combos = next;
      });
      counts[w.id] = combos.filter(combo => {
        const key = bpk(w.id, combo);
        return (inventoryMap[key] || 0) > 0 && (prices[key] === undefined || prices[key]?.price == null);
      }).length;
    });
    return counts;
  }, [wts, cfg, prices, inventoryMap]);

  const unpricedInStockSet = useMemo(() => {
    const set = new Set();
    const woodCfg = cfg[sw];
    if (!woodCfg || wts.find(w => w.id === sw)?.pricingMode === 'perBundle') return set;
    let combos = [{}];
    (woodCfg.attrs || []).forEach(atId => {
      const vals = getPriceGroupValues(atId, woodCfg);
      const isOptional = atId === 'width'; // width luôn optional — trống = BT
      if (!vals.length && !isOptional) return;
      const next = [];
      combos.forEach(c => {
        if (isOptional) next.push({ ...c });
        vals.forEach(v => next.push({ ...c, [atId]: v }));
      });
      combos = next;
    });
    combos.forEach(combo => {
      const key = bpk(sw, combo);
      if ((inventoryMap[key] || 0) > 0 && (prices[key] === undefined || prices[key]?.price == null)) set.add(key);
    });
    return set;
  }, [sw, cfg, prices, inventoryMap]);

  // V-05: Load lịch sử từ API
  const [apiLogs, setApiLogs] = useState([]);
  useEffect(() => {
    if (!useAPI || !sw) return;
    import('../api.js').then(api =>
      api.fetchChangeLogs(sw, 60)
        .then(data => {
          const normalized = (data || []).map(r => {
            const wn = wts.find(w => w.id === r.wood_id)?.name || r.wood_id;
            const ts = new Date(r.timestamp);
            const time = ts.toLocaleDateString('vi-VN') + ' ' + ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const date = ts.toLocaleDateString('vi-VN');
            return {
              time, date, rawTime: r.timestamp,
              type: r.old_price == null ? 'add' : 'update',
              desc: wn + ' — ' + r.sku_key,
              bpkKey: r.wood_id + '||' + r.sku_key,
              op: r.old_price, np: r.new_price,
              reason: r.reason, fromApi: true,
            };
          });
          setApiLogs(normalized);
        })
        .catch(() => {})
    );
  }, [sw, useAPI]); // eslint-disable-line

  // Group apiLogs thành batches theo (reason, date)
  const apiLogBatches = useMemo(() => {
    const groups = [];
    const keyMap = {};
    [...apiLogs].sort((a, b) => new Date(b.rawTime || 0) - new Date(a.rawTime || 0)).forEach(l => {
      const gKey = (l.reason || '') + '||' + l.date;
      if (!keyMap[gKey]) {
        const g = { key: 'api-' + gKey, reason: l.reason, time: l.time, date: l.date, changes: [] };
        groups.push(g);
        keyMap[gKey] = g;
      }
      keyMap[gKey].changes.push(l);
    });
    return groups;
  }, [apiLogs]);

  // Reset editMode khi đổi loại gỗ
  useEffect(() => {
    setEditMode(false);
    setPendingChanges({});
    setPendingCellDlg(null);
    setBatchReasonDlg(false);
  }, [sw]);

  // ── Edit mode handlers ───────────────────────────────────────────────────
  const handleStartEdit = () => { setPendingChanges({}); setEditMode(true); };
  const handleCancelEdit = () => { setPendingChanges({}); setEditMode(false); };
  const handleFinishEdit = () => {
    if (!Object.keys(pendingChanges).length) { setEditMode(false); return; }
    setBatchReasonDlg(true);
  };

  // onReq: chỉ nhận click khi đang editMode
  const onReq = useCallback((mks, op, d, sc, ocp, op2, attrs) => {
    if (!editMode) return;
    setPendingCellDlg({ mks, op, d, sc, ocp, op2, attrs });
  }, [editMode]);

  // Khi OK trong PendingCellDlg: lưu vào pendingChanges (bao gồm extra thickness items)
  const handleCellConfirm = useCallback((newPrice, newPrice2, newCostPrice, extraItems) => {
    if (!pendingCellDlg) return;
    const srcAttrs = pendingCellDlg.attrs;
    setPendingChanges(prev => {
      const next = { ...prev };
      // Keys chính (cell được click)
      pendingCellDlg.mks.forEach(k => {
        next[k] = {
          oldPrice: prev[k] !== undefined ? prev[k].oldPrice : (prices[k]?.price ?? null),
          newPrice,
          oldPrice2: prev[k] !== undefined ? prev[k].oldPrice2 : (prices[k]?.price2 ?? null),
          newPrice2: newPrice2 ?? null,
          oldCostPrice: prev[k] !== undefined ? prev[k].oldCostPrice : (prices[k]?.costPrice ?? null),
          newCostPrice: newCostPrice ?? null,
          desc: pendingCellDlg.d,
        };
      });
      // Extra items từ "áp dụng cho dày khác" — build desc riêng cho từng dày
      if (extraItems?.length) {
        extraItems.forEach(({ key: k, thickness: t }) => {
          // Build desc đúng: thay thickness gốc bằng thickness đích
          const extraDesc = srcAttrs
            ? Object.entries(srcAttrs).map(([ak, av]) => ak === 'thickness' ? t : av).join(' | ')
            : pendingCellDlg.d;
          next[k] = {
            oldPrice: prev[k] !== undefined ? prev[k].oldPrice : (prices[k]?.price ?? null),
            newPrice,
            oldPrice2: prev[k] !== undefined ? prev[k].oldPrice2 : (prices[k]?.price2 ?? null),
            newPrice2: newPrice2 ?? null,
            oldCostPrice: prev[k] !== undefined ? prev[k].oldCostPrice : (prices[k]?.costPrice ?? null),
            newCostPrice: newCostPrice ?? null,
            desc: extraDesc,
          };
        });
      }
      return next;
    });
    setPendingCellDlg(null);
  }, [pendingCellDlg, prices]);

  // Khi lưu cả đợt
  const handleBatchSave = useCallback((reason) => {
    const changes = Object.entries(pendingChanges);
    if (!changes.length) return;

    setP(prev => {
      const next = { ...prev };
      changes.forEach(([k, ch]) => {
        if (ch.newPrice == null) delete next[k];
        else next[k] = { price: ch.newPrice, ...(ch.newPrice2 != null && { price2: ch.newPrice2 }), costPrice: ch.newCostPrice ?? prev[k]?.costPrice ?? undefined, updated: new Date().toISOString().slice(0, 10) };
      });
      return next;
    });

    const t = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const d = new Date().toLocaleDateString("vi-VN");
    const batchKey = 'session-' + Date.now();
    const batchChanges = changes.map(([k, ch]) => ({ key: k, desc: ch.desc, op: ch.oldPrice, np: ch.newPrice }));
    setBatchLogs(prev => [{ key: batchKey, time: t, date: d, reason, count: changes.length, changes: batchChanges }, ...prev]);

    // Backward compat với logs prop
    setLogs(prev => [...prev, ...changes.map(([, ch]) => ({ time: t, type: ch.oldPrice == null ? 'add' : 'update', desc: ch.desc, op: ch.oldPrice, np: ch.newPrice, reason }))]);

    if (useAPI) {
      import('../api.js').then(api => {
        changes.forEach(([k, ch]) => {
          const parts = k.split("||");
          const woodId = parts[0];
          const skuKey = parts.slice(1).join("||");
          api.updatePrice(woodId, skuKey, ch.newPrice, ch.oldPrice, reason, "admin", ch.newCostPrice ?? null, ch.newPrice2 ?? null)
            .then(r => { if (r?.error) notify("Lỗi lưu giá: " + r.error, false); })
            .catch(err => notify("Lỗi kết nối: " + err.message, false));
        });
      });
    }

    setPendingChanges({});
    setEditMode(false);
    setBatchReasonDlg(false);
    notify(`Đã lưu đợt giá: ${changes.length} SKU — "${reason}"`);
  }, [pendingChanges, setP, setLogs, useAPI, notify]);

  // Tính danh sách giá không có tồn kho (cho cleanup)
  const noStockPrices = useMemo(() => {
    if (!sw) return [];
    const woodW = wts.find(x => x.id === sw);
    if (!woodW || woodW.pricingMode === 'perBundle') return [];
    return Object.entries(prices)
      .filter(([k, v]) => k.startsWith(sw + '||') && v?.price != null && !inventoryMap[k])
      .map(([k, v]) => {
        // Parse key thành mô tả
        const parts = k.split('||').slice(1); // bỏ woodId
        const desc = parts.map(p => p.split(':')[1]).join(' | ');
        const skuKey = parts.join('||');
        return { key: k, skuKey, desc, price: v.price, price2: v.price2, costPrice: v.costPrice };
      })
      .sort((a, b) => a.desc.localeCompare(b.desc));
  }, [sw, prices, inventoryMap, wts]);

  const handleCleanupPrices = useCallback(() => {
    if (!noStockPrices.length) return;
    // Xóa local
    setP(prev => {
      const next = { ...prev };
      noStockPrices.forEach(p => delete next[p.key]);
      return next;
    });
    // Xóa DB
    if (useAPI) {
      import('../api.js').then(api =>
        api.deletePrices(sw, noStockPrices.map(p => p.skuKey))
          .then(r => {
            if (r?.error) notify('Lỗi xóa: ' + r.error, false);
            else notify(`Đã xóa ${r.deleted} giá không tồn kho`);
          })
          .catch(e => notify('Lỗi kết nối: ' + e.message, false))
      );
    }
    setCleanupDlg(false);
  }, [noStockPrices, sw, setP, useAPI, notify]);

  const toggleBatch = (key) => setExpandedBatches(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const w = wts.find(x => x.id === sw);
  const isPerBundleWood = w?.pricingMode === 'perBundle';
  const isM2 = isM2Wood(sw, wts);
  const pendingCount = Object.keys(pendingChanges).length;
  const hasHistory = batchLogs.length > 0 || apiLogBatches.length > 0;

  return (
    <div>
      {pendingCellDlg && (
        <PendingCellDlg
          op={pendingCellDlg.op} op2={pendingCellDlg.op2} desc={pendingCellDlg.d}
          sc={pendingCellDlg.sc} curCostPrice={pendingCellDlg.ocp ?? null}
          onOk={handleCellConfirm} onNo={() => setPendingCellDlg(null)} isM2={isM2}
          attrs={pendingCellDlg.attrs} wk={sw} wc={wc} prices={displayPrices} stockSet={stockSet} />
      )}
      {batchReasonDlg && (
        <BatchReasonDlg
          changeCount={pendingCount}
          changes={Object.entries(pendingChanges).map(([, ch]) => ({ desc: ch.desc, op: ch.oldPrice, np: ch.newPrice }))}
          onOk={handleBatchSave} onNo={() => setBatchReasonDlg(false)} />
      )}
      <Dialog open={cleanupDlg} onClose={() => setCleanupDlg(false)} onOk={handleCleanupPrices} title="Xóa giá không tồn kho" width={480}>
            <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--ts)", lineHeight: 1.5 }}>
              Có <strong style={{ color: "var(--dg)" }}>{noStockPrices.length} giá</strong> của <strong>{w?.name}</strong> không có kiện nào trong kho. Xóa để dọn dẹp bảng giá.
            </p>
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 14, borderRadius: 7, border: "1px solid var(--bd)", background: "var(--bgs)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "5px 8px", textAlign: "left", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>SKU</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {noStockPrices.map((p, i) => (
                    <tr key={p.key} style={{ background: i % 2 ? "#fff" : "var(--bgs)" }}>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", color: "var(--ts)" }}>{p.desc}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontWeight: 700, color: "var(--ac)" }}>{isM2 ? p.price.toFixed(0) : p.price.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: "0.72rem", color: "var(--dg)", fontWeight: 600, padding: "6px 10px", borderRadius: 6, background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.2)" }}>
              Thao tác này không thể hoàn tác. Giá sẽ bị xóa khỏi bảng giá và cơ sở dữ liệu.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCleanupDlg(false)} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
              <button onClick={handleCleanupPrices} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>Xóa {noStockPrices.length} giá</button>
            </div>
      </Dialog>
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
          {/* Tiêu đề + nút edit mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--br)" }}>{w.icon} {w.name}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>{pc} SKU | {isM2 ? "k/m²" : "tr/m³"}</span>
            {ce && !editMode && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                {noStockPrices.length > 0 && (
                  <button onClick={() => setCleanupDlg(true)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem" }}>
                    🗑 Dọn giá ({noStockPrices.length})
                  </button>
                )}
                <button onClick={handleStartEdit}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--br)", background: "transparent", color: "var(--br)", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                  ✏️ Bắt đầu chỉnh giá
                </button>
              </div>
            )}
            {ce && editMode && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 5, background: "rgba(234,179,8,0.15)", color: "#92701a", fontSize: "0.72rem", fontWeight: 700, border: "1px solid rgba(234,179,8,0.4)" }}>
                  ✏️ Đang chỉnh giá {pendingCount > 0 && `· ${pendingCount} thay đổi`}
                </span>
                <button onClick={handleCancelEdit}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>
                  Hủy
                </button>
                <button onClick={handleFinishEdit}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: pendingCount > 0 ? "var(--ac)" : "var(--bd)", color: pendingCount > 0 ? "#fff" : "var(--tm)", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                  {pendingCount > 0 ? `Kết thúc (${pendingCount})` : "Kết thúc"}
                </button>
              </div>
            )}
          </div>

          {/* Edit mode hint */}
          {ce && editMode && (
            <div style={{ marginBottom: 8, padding: "7px 12px", borderRadius: 7, background: "rgba(234,179,8,0.08)", border: "1px dashed rgba(234,179,8,0.5)", fontSize: "0.72rem", color: "#92701a" }}>
              Click vào ô giá để điều chỉnh — có thể áp dụng giá cho nhiều độ dày cùng lúc. Nhấn <strong>Kết thúc</strong> để nhập lý do và lưu cả đợt.
            </div>
          )}
          {ce && !editMode && (
            <div style={{ marginBottom: 8, fontSize: "0.72rem", color: "var(--tm)" }}>
              Nhấn <strong>Bắt đầu chỉnh giá</strong> để điều chỉnh bảng giá theo đợt.
            </div>
          )}

          {/* Ghi chú bảng giá */}
          {(priceNote || (ce && !editMode)) && (
            <div style={{ marginBottom: 10, borderRadius: 7, border: '1.5px solid #F0C040', background: noteEditing ? '#FFFDF0' : priceNote ? '#FFFBE6' : 'transparent', padding: noteEditing ? '10px 12px' : priceNote ? '8px 12px' : 0 }}>
              {noteEditing ? (
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#856404', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ghi chú bảng giá (hiển thị cho nhân viên bán hàng)</div>
                  <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={3} placeholder="Nhập ghi chú lưu ý cho nhân viên bán hàng khi xem bảng giá này..."
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 5, border: '1.5px solid #F0C040', fontSize: '0.8rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', lineHeight: 1.5 }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button onClick={() => setNoteEditing(false)} style={{ padding: '4px 12px', borderRadius: 5, border: '1.5px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}>Hủy</button>
                    <button onClick={handleSaveNote} disabled={noteSaving} style={{ padding: '4px 14px', borderRadius: 5, border: 'none', background: '#856404', color: '#fff', cursor: noteSaving ? 'not-allowed' : 'pointer', fontSize: '0.74rem', fontWeight: 700 }}>{noteSaving ? 'Đang lưu...' : 'Lưu'}</button>
                  </div>
                </div>
              ) : priceNote ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.88rem', flexShrink: 0 }}>📌</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#856404', marginBottom: 3 }}>Lưu ý</div>
                    <div style={{ fontSize: '0.78rem', color: '#5D4037', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{priceNote}</div>
                  </div>
                  {ce && !editMode && (
                    <button onClick={() => { setNoteDraft(priceNote); setNoteEditing(true); }} title="Chỉnh sửa ghi chú"
                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #F0C040', background: 'transparent', color: '#856404', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, flexShrink: 0 }}>✏ Sửa</button>
                  )}
                </div>
              ) : ce && !editMode ? (
                <button onClick={() => { setNoteDraft(''); setNoteEditing(true); }}
                  style={{ padding: '5px 12px', borderRadius: 5, border: '1.5px dashed #F0C040', background: 'transparent', color: '#856404', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                  + Thêm ghi chú lưu ý cho nhân viên bán hàng
                </button>
              ) : null}
            </div>
          )}

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
          <Matrix wk={sw} wc={wc} prices={displayPrices} onReq={onReq} hak={hak} sop={sop} soi={soi} ug={ug} grps={grps} ce={ce && editMode} seeCostPrice={seeCostPrice} ats={ats} unpricedSet={unpricedInStockSet} stockSet={stockSet} isM2={isM2} pendingSet={pendingSet} />
        </div>
      )}

      {/* ── Lịch sử điều chỉnh giá theo đợt ── */}
      {w && !isPerBundleWood && hasHistory && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
            Lịch sử điều chỉnh giá
            <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--tm)" }}>
              ({batchLogs.length + apiLogBatches.length} đợt)
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Session batch logs */}
            {batchLogs.map(batch => {
              const expanded = expandedBatches.has(batch.key);
              return (
                <div key={batch.key} style={{ borderRadius: 7, border: "1.5px solid rgba(242,101,34,0.3)", background: "rgba(242,101,34,0.04)", overflow: "hidden" }}>
                  <div onClick={() => toggleBatch(batch.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ac)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--tm)", flexShrink: 0 }}>{batch.date} {batch.time}</span>
                    <span title={batch.reason} style={{ flex: 1, fontWeight: 700, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {batch.reason}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--ac)", fontWeight: 700, flexShrink: 0 }}>{batch.count} SKU</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--tm)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: "1px solid rgba(242,101,34,0.2)", padding: "6px 10px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                      {batch.changes.map((ch, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem" }}>
                          <span title={ch.desc} style={{ flex: 1, color: "var(--ts)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.desc}</span>
                          <span style={{ fontWeight: 700, flexShrink: 0 }}>
                            {ch.op != null && <><span style={{ textDecoration: "line-through", color: "var(--tm)" }}>{typeof ch.op === 'number' ? ch.op.toFixed(1) : ch.op}</span>{" → "}</>}
                            <span style={{ color: "var(--ac)" }}>{ch.np != null ? (typeof ch.np === 'number' ? ch.np.toFixed(1) : ch.np) : "—"}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* API log batches */}
            {apiLogBatches.map(batch => {
              const expanded = expandedBatches.has(batch.key);
              return (
                <div key={batch.key} style={{ borderRadius: 7, border: "1px solid var(--bd)", background: "var(--bgs)", overflow: "hidden" }}>
                  <div onClick={() => toggleBatch(batch.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brl)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--tm)", flexShrink: 0 }}>{batch.date} {batch.time}</span>
                    <span title={batch.reason || ''} style={{ flex: 1, fontWeight: 600, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {batch.reason ? <span>💬 {batch.reason}</span> : <span style={{ color: "var(--tm)", fontStyle: "italic" }}>(không có lý do)</span>}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "var(--brl)", fontWeight: 700, flexShrink: 0 }}>{batch.changes.length} SKU</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--tm)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: "1px solid var(--bd)", padding: "6px 10px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                      {batch.changes.map((ch, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem" }}>
                          <span title={ch.desc} style={{ flex: 1, color: "var(--ts)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.desc}</span>
                          <span style={{ fontWeight: 700, flexShrink: 0 }}>
                            {ch.op != null && <><span style={{ textDecoration: "line-through", color: "var(--tm)" }}>{ch.op}</span>{" → "}</>}
                            <span style={{ color: ch.type === "add" ? "var(--gn)" : "var(--brl)" }}>{ch.np ?? "—"}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
