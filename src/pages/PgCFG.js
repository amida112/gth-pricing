import React, { useState } from "react";
import { WoodPicker } from "../components/Matrix";

export default function PgCFG({ wts, ats, cfg, setCfg, ce, useAPI, notify, bundles = [], onRenameAttrValForWood }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [migFrom, setMigFrom] = useState('');
  const [migTo, setMigTo] = useState('');
  const [migAttr, setMigAttr] = useState('');
  const [migRunning, setMigRunning] = useState(false);

  // State cho CRUD giá trị per-wood
  const [editAtId, setEditAtId] = useState(null);   // attr nào đang focus (chip edit / add)
  const [selChipIdx, setSelChipIdx] = useState(null);
  const [editChipText, setEditChipText] = useState('');
  const [chipErr, setChipErr] = useState('');
  const [newChipText, setNewChipText] = useState('');
  const [newChipErr, setNewChipErr] = useState('');
  const [renames, setRenames] = useState({});        // { [atId]: { oldVal: newVal } }

  const cloneCfg = (id) => {
    const c = cfg[id];
    if (!c) return { attrs: [], attrValues: {}, defaultHeader: [], attrPriceGroups: {}, rangeGroups: {} };
    return {
      attrs: [...(c.attrs || [])],
      attrValues: Object.fromEntries(Object.entries(c.attrValues || {}).map(([k, v]) => [k, [...v]])),
      defaultHeader: [...(c.defaultHeader || [])],
      attrPriceGroups: JSON.parse(JSON.stringify(c.attrPriceGroups || {})),
      rangeGroups: JSON.parse(JSON.stringify(c.rangeGroups || {})),
    };
  };

  const [draft, setDraft] = useState(() => cloneCfg(wts[0]?.id));
  const [saved, setSaved] = useState(false);

  const resetChipState = () => {
    setEditAtId(null); setSelChipIdx(null); setEditChipText(''); setChipErr('');
    setNewChipText(''); setNewChipErr('');
  };

  const selectWood = (id) => {
    setSw(id); setDraft(cloneCfg(id)); setSaved(false);
    setMigAttr(''); setMigFrom(''); setMigTo('');
    resetChipState(); setRenames({});
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(cloneCfg(sw));

  // === Bật/tắt attribute cho wood ===
  const toggleAttr = (atId) => {
    setDraft(p => {
      if (p.attrs.includes(atId)) {
        const newAV = { ...p.attrValues }; delete newAV[atId];
        const newRG = { ...(p.rangeGroups || {}) }; delete newRG[atId];
        return { ...p, attrs: p.attrs.filter(a => a !== atId), attrValues: newAV, rangeGroups: newRG, defaultHeader: p.defaultHeader.filter(h => h !== atId) };
      }
      // Bật mới: pre-fill từ global ats[] làm template
      const atDef = ats.find(a => a.id === atId);
      return { ...p, attrs: [...p.attrs, atId], attrValues: { ...p.attrValues, [atId]: atDef ? [...atDef.values] : [] } };
    });
    if (editAtId === atId) resetChipState();
    setSaved(false);
  };

  // === Normalize giá trị chip ===
  const normalizeChipVal = (atId, text) => {
    const s = text.trim();
    if (!s) return '';
    const atDef = ats.find(a => a.id === atId);
    if (atDef?.groupable && /^[\d.]+$/.test(s)) return s + 'F';
    return s;
  };

  // === Switch attribute đang focus ===
  const switchEditAttr = (atId) => {
    if (editAtId !== atId) {
      setEditAtId(atId); setSelChipIdx(null); setEditChipText(''); setChipErr('');
      setNewChipText(''); setNewChipErr('');
    }
  };

  // === Select chip để đổi tên / xóa ===
  const selectChip = (atId, idx) => {
    switchEditAttr(atId);
    setSelChipIdx(idx);
    setEditChipText((draft.attrValues[atId] || [])[idx] || '');
    setChipErr('');
  };

  // === Commit đổi tên chip ===
  const commitChipRename = (atId) => {
    if (selChipIdx === null || editAtId !== atId) return;
    const vals = draft.attrValues[atId] || [];
    const oldVal = vals[selChipIdx];
    const v = normalizeChipVal(atId, editChipText);
    if (!v || v === oldVal) { setChipErr(''); return; }
    if (vals.some((x, i) => i !== selChipIdx && x.toLowerCase() === v.toLowerCase())) {
      setChipErr(`"${v}" đã tồn tại`); return;
    }
    const atDef = ats.find(a => a.id === atId);
    const newVals = vals.map((x, i) => i === selChipIdx ? v : x);
    const sortedVals = atDef?.groupable ? [...newVals].sort((a, b) => parseFloat(a) - parseFloat(b)) : newVals;
    const newDraft = { ...draft, attrValues: { ...draft.attrValues, [atId]: sortedVals } };
    // Đồng bộ rangeGroups label nếu có
    if (newDraft.rangeGroups?.[atId]) {
      newDraft.rangeGroups = { ...newDraft.rangeGroups, [atId]: newDraft.rangeGroups[atId].map(g => g.label === oldVal ? { ...g, label: v } : g) };
    }
    // Đồng bộ attrPriceGroups.special nếu có
    const apg = newDraft.attrPriceGroups?.[atId];
    if (apg?.special?.includes(oldVal)) {
      newDraft.attrPriceGroups = { ...newDraft.attrPriceGroups, [atId]: { ...apg, special: apg.special.map(s => s === oldVal ? v : s) } };
    }
    setDraft(newDraft);
    // Track rename để migrate khi save
    setRenames(prev => {
      const atR = { ...(prev[atId] || {}) };
      const origin = Object.keys(atR).find(k => atR[k] === oldVal);
      if (origin) { if (origin === v) delete atR[origin]; else atR[origin] = v; }
      else atR[oldVal] = v;
      return { ...prev, [atId]: atR };
    });
    const newIdx = atDef?.groupable ? sortedVals.indexOf(v) : selChipIdx;
    setSelChipIdx(newIdx); setEditChipText(v); setChipErr('');
    setSaved(false);
  };

  // === Di chuyển chip ===
  const moveChip = (atId, idx, dir) => {
    const cur = draft.attrValues[atId] || [];
    const sw2 = idx + dir;
    if (sw2 < 0 || sw2 >= cur.length) return;
    const next = [...cur]; [next[idx], next[sw2]] = [next[sw2], next[idx]];
    setDraft(p => ({ ...p, attrValues: { ...p.attrValues, [atId]: next } }));
    setSelChipIdx(sw2); setSaved(false);
  };

  // === Thêm giá trị mới ===
  const addValToAttr = (atId) => {
    const v = normalizeChipVal(atId, newChipText);
    if (!v) { setNewChipErr('Nhập giá trị'); return; }
    const cur = draft.attrValues[atId] || [];
    if (cur.some(x => x.toLowerCase() === v.toLowerCase())) { setNewChipErr(`"${v}" đã tồn tại`); return; }
    setNewChipErr('');
    const atDef = ats.find(a => a.id === atId);
    const next = atDef?.groupable ? [...cur, v].sort((a, b) => parseFloat(a) - parseFloat(b)) : [...cur, v];
    const newDraft = { ...draft, attrValues: { ...draft.attrValues, [atId]: next } };
    // Đồng bộ rangeGroups nếu đang bật
    if (newDraft.rangeGroups?.[atId]) {
      newDraft.rangeGroups = { ...newDraft.rangeGroups, [atId]: [...newDraft.rangeGroups[atId], { label: v, min: '', max: '' }] };
    }
    setDraft(newDraft); setNewChipText(''); setSaved(false);
  };

  // === Xóa giá trị ===
  const deleteValFromAttr = (atId, idx) => {
    const val = (draft.attrValues[atId] || [])[idx];
    const bundleCount = bundles.filter(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[atId] === val).length;
    if (bundleCount > 0 && !window.confirm(`${bundleCount} gỗ kiện đang dùng "${val}". Nếu xóa, các kiện này sẽ không tra được bảng giá. Tiếp tục?`)) return;
    const next = (draft.attrValues[atId] || []).filter((_, i) => i !== idx);
    const newDraft = { ...draft, attrValues: { ...draft.attrValues, [atId]: next } };
    if (newDraft.rangeGroups?.[atId]) {
      newDraft.rangeGroups = { ...newDraft.rangeGroups, [atId]: newDraft.rangeGroups[atId].filter(g => g.label !== val) };
    }
    const apg = newDraft.attrPriceGroups?.[atId];
    if (apg) {
      newDraft.attrPriceGroups = { ...newDraft.attrPriceGroups, [atId]: { ...apg, special: (apg.special || []).filter(v => v !== val) } };
    }
    setDraft(newDraft);
    if (selChipIdx === idx) { setSelChipIdx(null); setEditChipText(''); setChipErr(''); }
    else if (selChipIdx > idx) setSelChipIdx(selChipIdx - 1);
    setSaved(false);
  };

  // === Toggle rangeGroups cho attribute ===
  const toggleRangeGroups = (atId, on) => {
    setDraft(p => {
      const rg = { ...(p.rangeGroups || {}) };
      if (on) rg[atId] = (p.attrValues[atId] || []).map(label => ({ label, min: '', max: '' }));
      else delete rg[atId];
      return { ...p, rangeGroups: rg };
    });
    setSaved(false);
  };

  // === Kiểm tra overlap rangeGroups ===
  const checkRangeOverlap = (atId) => {
    const rg = draft.rangeGroups?.[atId];
    if (!rg?.length || rg.length < 2) return null;
    const sel = rg.map(g => ({
      label: g.label,
      min: g.min != null && g.min !== '' ? parseFloat(g.min) : -Infinity,
      max: g.max != null && g.max !== '' ? parseFloat(g.max) : Infinity,
    }));
    for (let a = 0; a < sel.length; a++)
      for (let b = a + 1; b < sel.length; b++)
        if (sel[a].min < sel[b].max && sel[a].max > sel[b].min)
          return `Nhóm "${sel[a].label}" và "${sel[b].label}" bị chồng lấn khoảng giá trị`;
    return null;
  };

  // === Kiểm tra gap rangeGroups ===
  const checkRangeGap = (atId) => {
    const rg = draft.rangeGroups?.[atId];
    if (!rg?.length || rg.length < 2) return null;
    const nums = rg
      .map(g => ({ min: g.min !== '' && g.min != null ? parseFloat(g.min) : null, max: g.max !== '' && g.max != null ? parseFloat(g.max) : null }))
      .filter(g => g.min != null && g.max != null)
      .sort((a, b) => a.min - b.min);
    for (let i = 0; i < nums.length - 1; i++)
      if (nums[i].max < nums[i + 1].min)
        return `⚠ Khoảng hở từ ${nums[i].max} đến ${nums[i + 1].min} — gỗ trong khoảng này sẽ không khớp nhóm nào`;
    return null;
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
    // Migrate giá + bundle cho các rename pending
    Object.entries(renames).forEach(([atId, r]) => {
      if (Object.keys(r).length > 0 && onRenameAttrValForWood) onRenameAttrValForWood(sw, atId, r);
    });
    setRenames({});
    const finalDraft = { ...draft };
    setCfg(p => ({ ...p, [sw]: finalDraft }));
    setDraft(finalDraft);
    setSaved(true);
    if (useAPI) {
      import('../api.js').then(api => api.saveWoodConfig(sw, finalDraft)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã lưu cấu hình", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
  };

  // Nhóm giá thuộc tính
  const togglePriceGroupEnabled = (atId) => {
    setDraft(p => {
      const apg = { ...(p.attrPriceGroups || {}) };
      if (apg[atId]) delete apg[atId]; else apg[atId] = { default: 'Chung', special: [] };
      return { ...p, attrPriceGroups: apg };
    }); setSaved(false);
  };
  const setPriceGroupDefault = (atId, val) => {
    setDraft(p => ({ ...p, attrPriceGroups: { ...p.attrPriceGroups, [atId]: { ...p.attrPriceGroups[atId], default: val } } })); setSaved(false);
  };
  const togglePriceGroupSpecial = (atId, val) => {
    setDraft(p => {
      const cur = p.attrPriceGroups[atId]; const sp = cur.special || [];
      return { ...p, attrPriceGroups: { ...p.attrPriceGroups, [atId]: { ...cur, special: sp.includes(val) ? sp.filter(v => v !== val) : [...sp, val] } } };
    }); setSaved(false);
  };

  const secHd = { padding: "9px 14px", background: "var(--bgh)", borderBottom: "1px solid var(--bds)", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" };
  const chipBase = { padding: "4px 11px", borderRadius: 5, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>⚙️ Cấu hình loại gỗ</h2>
      <WoodPicker wts={wts} sel={sw} onSel={selectWood} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Thuộc tính & Giá trị per-wood */}
        <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
          <div style={secHd}>
            Thuộc tính & Giá trị áp dụng
            <span style={{ marginLeft: 6, fontWeight: 500, textTransform: "none", fontSize: "0.65rem", color: "var(--tm)" }}>Giá trị riêng cho từng loại gỗ — bật thuộc tính rồi thêm/sửa/xóa trực tiếp</span>
          </div>
          <div>
            {ats.map((at, i) => {
              const active = draft.attrs.includes(at.id);
              const selVals = draft.attrValues[at.id] || [];
              const isSupplier = at.id === 'supplier';
              const rgEnabled = !!draft.rangeGroups?.[at.id];
              const overlapWarn = active ? checkRangeOverlap(at.id) : null;
              const gapWarn = active && rgEnabled ? checkRangeGap(at.id) : null;
              const atRenames = renames[at.id] || {};
              return (
                <div key={at.id} style={{ borderBottom: i < ats.length - 1 ? "1px solid var(--bd)" : "none", padding: "10px 14px", background: active ? "#fff" : "var(--bgs)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: ce ? "pointer" : "default", marginBottom: active ? 10 : 0, userSelect: "none" }}>
                    <input type="checkbox" checked={active} onChange={() => ce && toggleAttr(at.id)} disabled={!ce} style={{ width: 15, height: 15, accentColor: "var(--ac)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.83rem", color: active ? "var(--br)" : "var(--tm)" }}>{at.name}</span>
                    <span style={{ fontSize: "0.63rem", color: "var(--tm)", fontFamily: "monospace" }}>{at.id}</span>
                    {active && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--tm)" }}>{selVals.length} giá trị</span>}
                  </label>

                  {active && (
                    <div style={{ paddingLeft: 23 }}>
                      {/* Chips hiện tại */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {selVals.map((v, vi) => {
                          const isSel = editAtId === at.id && selChipIdx === vi;
                          const isRenamed = Object.values(atRenames).includes(v);
                          return (
                            <span key={vi} onClick={() => ce && selectChip(at.id, vi)}
                              style={{ ...chipBase,
                                background: isSel ? "var(--ac)" : isRenamed ? "rgba(242,101,34,0.08)" : "var(--bgs)",
                                border: "1.5px solid " + (isSel ? "var(--ac)" : isRenamed ? "var(--ac)" : "var(--bds)"),
                                color: isSel ? "#fff" : isRenamed ? "var(--ac)" : "var(--tp)",
                                cursor: ce ? "pointer" : "default" }}>
                              {v}{isRenamed && !isSel ? " *" : ""}
                            </span>
                          );
                        })}
                        {!selVals.length && <span style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic" }}>Chưa có giá trị — thêm bên dưới</span>}
                      </div>

                      {/* Thanh sửa chip đang chọn */}
                      {ce && editAtId === at.id && selChipIdx !== null && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, padding: "7px 10px", borderRadius: 6, background: "var(--acbg)", border: "1px solid var(--ac)" }}>
                          {!at.groupable && (
                            <button onClick={() => moveChip(at.id, selChipIdx, -1)} disabled={selChipIdx === 0}
                              style={{ width: 28, height: 28, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selChipIdx === 0 ? "transparent" : "var(--bgc)", color: selChipIdx === 0 ? "var(--tm)" : "var(--ts)", cursor: selChipIdx === 0 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>‹</button>
                          )}
                          {isSupplier
                            ? <div style={{ flex: 1, padding: "4px 9px", fontSize: "0.82rem", fontWeight: 700, color: "var(--br)" }}>{selVals[selChipIdx]}</div>
                            : (
                              <div style={{ flex: 1, minWidth: 60 }}>
                                <input value={editChipText} onChange={e => { setEditChipText(e.target.value); setChipErr(''); }}
                                  onBlur={() => commitChipRename(at.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitChipRename(at.id); if (e.key === 'Escape') { setEditChipText(selVals[selChipIdx]); setChipErr(''); } }}
                                  style={{ width: "100%", padding: "4px 9px", borderRadius: 5, border: "1.5px solid " + (chipErr ? "var(--dg)" : "var(--ac)"), fontSize: "0.8rem", outline: "none", background: "#fff", boxSizing: "border-box" }} />
                                {chipErr && <div style={{ fontSize: "0.62rem", color: "var(--dg)", marginTop: 2 }}>{chipErr}</div>}
                              </div>
                            )
                          }
                          {!at.groupable && (
                            <button onClick={() => moveChip(at.id, selChipIdx, 1)} disabled={selChipIdx === selVals.length - 1}
                              style={{ width: 28, height: 28, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selChipIdx === selVals.length - 1 ? "transparent" : "var(--bgc)", color: selChipIdx === selVals.length - 1 ? "var(--tm)" : "var(--ts)", cursor: selChipIdx === selVals.length - 1 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>›</button>
                          )}
                          <button onClick={() => deleteValFromAttr(at.id, selChipIdx)}
                            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem", flexShrink: 0 }}>Xóa</button>
                        </div>
                      )}

                      {/* Rename pending summary */}
                      {Object.keys(atRenames).length > 0 && (
                        <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 5, background: "rgba(242,101,34,0.07)", border: "1px solid var(--ac)", fontSize: "0.65rem", color: "var(--ac)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <strong>Đổi tên khi lưu:</strong>
                          {Object.entries(atRenames).map(([o, n]) => <span key={o} style={{ fontFamily: "monospace" }}>"{o}" → "{n}"</span>)}
                          <span style={{ color: "var(--tm)", fontStyle: "italic" }}>· sẽ migrate giá, kho</span>
                        </div>
                      )}

                      {/* Thêm giá trị mới */}
                      {ce && (
                        <div style={{ marginBottom: 6 }}>
                          {isSupplier
                            ? <div style={{ fontSize: "0.65rem", color: "var(--tm)", padding: "4px 0", fontStyle: "italic" }}>
                                Giá trị NCC đồng bộ từ màn hình Nhà cung cấp — bật "Cấu hình = Có" trên NCC để hiển thị ở đây.
                              </div>
                            : (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input
                                  value={editAtId === at.id ? newChipText : ''}
                                  onChange={e => { switchEditAttr(at.id); setNewChipText(e.target.value); setNewChipErr(''); }}
                                  onFocus={() => switchEditAttr(at.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') { switchEditAttr(at.id); addValToAttr(at.id); } }}
                                  placeholder={at.groupable ? "Nhập số VD: 3.5 → tự thành 3.5F" : "Thêm giá trị mới..."}
                                  style={{ flex: 1, padding: "5px 9px", borderRadius: 5, border: "1.5px solid " + (editAtId === at.id && newChipErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.78rem", outline: "none", maxWidth: 260 }} />
                                <button onClick={() => { switchEditAttr(at.id); addValToAttr(at.id); }}
                                  style={{ padding: "5px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem", flexShrink: 0 }}>+ Thêm</button>
                              </div>
                            )
                          }
                          {editAtId === at.id && newChipErr && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 2 }}>{newChipErr}</div>}
                        </div>
                      )}

                      {/* rangeGroups toggle + editor — chỉ cho thuộc tính đo lường khoảng (length) */}
                      {ce && !at.groupable && (at.id === 'length' || !!draft.rangeGroups?.[at.id]) && (
                        <div style={{ marginTop: 6 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--ts)", userSelect: "none", marginBottom: rgEnabled ? 8 : 0 }}>
                            <input type="checkbox" checked={rgEnabled} onChange={e => toggleRangeGroups(at.id, e.target.checked)} style={{ accentColor: "var(--ac)" }} />
                            Nhóm theo khoảng đo lường (rangeGroups)
                            <span style={{ fontWeight: 400, color: "var(--tm)", fontSize: "0.65rem" }}>— nhập chiều dài thực, tự khớp nhóm bảng giá</span>
                          </label>
                          {rgEnabled && (
                            <div style={{ paddingLeft: 20 }}>
                              <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginBottom: 6, lineHeight: 1.5 }}>
                                Mỗi giá trị bên trên là 1 nhóm — điền khoảng <strong>Min ≥</strong> / <strong>Max ≤</strong> để hệ thống tự nhận diện khi nhập kho.
                              </div>
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ borderCollapse: "collapse", fontSize: "0.73rem", width: "100%", maxWidth: 560 }}>
                                  <thead>
                                    <tr style={{ background: "var(--bgh)" }}>
                                      <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--brl)", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>Nhóm</th>
                                      <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--brl)", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>Min ≥ <span style={{ fontWeight: 400, color: "var(--tm)" }}>(trống = không giới hạn)</span></th>
                                      <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--brl)", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>Max ≤ <span style={{ fontWeight: 400, color: "var(--tm)" }}>(trống = không giới hạn)</span></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(draft.rangeGroups[at.id] || []).map((g, gi) => (
                                      <tr key={gi} style={{ background: gi % 2 ? "var(--bgs)" : "#fff" }}>
                                        <td style={{ padding: "3px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>{g.label}</td>
                                        <td style={{ padding: "3px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          <input type="number" step="0.1" value={g.min ?? ''} onChange={e => setDraft(p => { const rg = [...p.rangeGroups[at.id]]; rg[gi] = { ...rg[gi], min: e.target.value }; return { ...p, rangeGroups: { ...p.rangeGroups, [at.id]: rg } }; }) || setSaved(false)}
                                            placeholder="—" style={{ width: 90, padding: "3px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.73rem", outline: "none" }} />
                                        </td>
                                        <td style={{ padding: "3px 8px", borderBottom: "1px solid var(--bd)" }}>
                                          <input type="number" step="0.1" value={g.max ?? ''} onChange={e => setDraft(p => { const rg = [...p.rangeGroups[at.id]]; rg[gi] = { ...rg[gi], max: e.target.value }; return { ...p, rangeGroups: { ...p.rangeGroups, [at.id]: rg } }; }) || setSaved(false)}
                                            placeholder="—" style={{ width: 90, padding: "3px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.73rem", outline: "none" }} />
                                        </td>
                                      </tr>
                                    ))}
                                    {!(draft.rangeGroups[at.id] || []).length && (
                                      <tr><td colSpan={3} style={{ padding: "8px 10px", color: "var(--tm)", fontStyle: "italic", fontSize: "0.72rem" }}>Chưa có giá trị nào — thêm giá trị bên trên trước</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              {gapWarn && <div style={{ fontSize: "0.65rem", color: "#856404", background: "#FFF3CD", border: "1px solid #FFD54F", borderRadius: 4, padding: "4px 8px", marginTop: 6 }}>{gapWarn}</div>}
                              {overlapWarn && <div style={{ fontSize: "0.65rem", color: "var(--dg)", background: "rgba(192,57,43,0.07)", border: "1px solid var(--dg)", borderRadius: 4, padding: "4px 8px", marginTop: 4 }}>⚠ {overlapWarn}</div>}
                            </div>
                          )}
                          {!rgEnabled && overlapWarn && <div style={{ marginTop: 4, fontSize: "0.65rem", color: "#856404", background: "#FFF3CD", border: "1px solid #FFD54F", borderRadius: 4, padding: "4px 8px" }}>⚠ {overlapWarn} — cần điều chỉnh rangeGroups</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nhóm giá thuộc tính */}
        {draft.attrs.some(atId => (draft.attrValues[atId] || []).length >= 2) && (
          <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
            <div style={secHd}>
              Nhóm giá thuộc tính
              <span style={{ marginLeft: 6, fontWeight: 500, textTransform: "none", fontSize: "0.65rem", color: "var(--tm)" }}>Gộp nhiều giá trị thành 1 nhóm — bảng giá gọn hơn, kiện vẫn lưu giá trị thực</span>
            </div>
            {draft.attrs.map((atId, i) => {
              const at = ats.find(a => a.id === atId);
              const selVals = draft.attrValues[atId] || [];
              if (selVals.length < 2) return null;
              const pg = draft.attrPriceGroups?.[atId];
              const enabled = !!pg;
              const groupLabels = enabled ? [...(pg.special || []), pg.default || 'Chung'] : [];
              return (
                <div key={atId} style={{ borderBottom: i < draft.attrs.length - 1 ? "1px solid var(--bd)" : "none", padding: "10px 14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: ce ? "pointer" : "default", userSelect: "none" }}>
                    <input type="checkbox" checked={enabled} onChange={() => ce && togglePriceGroupEnabled(atId)} disabled={!ce} style={{ width: 15, height: 15, accentColor: "var(--gtx)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.83rem", color: enabled ? "var(--gtx)" : "var(--ts)" }}>{at?.name || atId}</span>
                    <span style={{ fontSize: "0.63rem", color: "var(--tm)", fontFamily: "monospace" }}>{atId}</span>
                  </label>
                  {enabled && (
                    <div style={{ paddingLeft: 23, marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--ts)", fontWeight: 600 }}>Nhóm mặc định:</span>
                        <input value={pg.default || 'Chung'} onChange={e => ce && setPriceGroupDefault(atId, e.target.value)} disabled={!ce}
                          style={{ padding: "3px 8px", borderRadius: 4, border: "1.5px solid var(--gbd)", fontSize: "0.76rem", outline: "none", width: 100, background: "var(--gbg)", color: "var(--gtx)", fontWeight: 700 }} />
                        <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>← tất cả NCC không chọn bên dưới đều vào nhóm này</span>
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginBottom: 5 }}>Định giá riêng (chip bật = có hàng/cột riêng trong bảng giá):</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                        {selVals.map(v => {
                          const isSpecial = (pg.special || []).includes(v);
                          return (
                            <button key={v} onClick={() => ce && togglePriceGroupSpecial(atId, v)} disabled={!ce}
                              style={{ padding: "3px 10px", borderRadius: 4, border: isSpecial ? "1.5px solid var(--gtx)" : "1.5px solid var(--bd)", background: isSpecial ? "var(--gbg)" : "transparent", color: isSpecial ? "var(--gtx)" : "var(--ts)", cursor: ce ? "pointer" : "default", fontWeight: isSpecial ? 700 : 500, fontSize: "0.73rem" }}>
                              {isSpecial ? "✓ " : ""}{v}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--gtx)", fontWeight: 600, padding: "5px 10px", borderRadius: 5, background: "var(--gbg)", border: "1px solid var(--gbd)", display: "inline-block" }}>
                        Bảng giá hiển thị: {groupLabels.join(" · ")}
                      </div>
                    </div>
                  )}
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}

        {/* Hiển thị ngang mặc định */}
        {draft.attrs.length > 0 && (
          <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
            <div style={secHd}>
              Hiển thị ngang mặc định
              <span style={{ marginLeft: 6, fontWeight: 500, textTransform: "none", fontSize: "0.65rem", color: "var(--tm)" }}>(tối đa 2 — sẽ là cột header của bảng giá)</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {draft.attrs.map(atId => {
                const at = ats.find(a => a.id === atId);
                const sel = draft.defaultHeader.includes(atId);
                const maxed = !sel && draft.defaultHeader.length >= 2;
                const ord = draft.defaultHeader.indexOf(atId);
                return (
                  <button key={atId} onClick={() => ce && !maxed && toggleHeader(atId)} disabled={!ce || maxed}
                    style={{ padding: "5px 14px", borderRadius: 5, border: sel ? "1.5px solid var(--br)" : "1.5px solid var(--bd)", background: sel ? "var(--br)" : "transparent", color: sel ? "#FAF6F0" : maxed ? "var(--tm)" : "var(--ts)", cursor: !ce || maxed ? "not-allowed" : "pointer", fontWeight: sel ? 700 : 500, fontSize: "0.76rem", opacity: maxed ? 0.4 : 1 }}>
                    {sel ? <span style={{ opacity: 0.65, marginRight: 3 }}>{ord + 1}.</span> : null}{at?.name || atId}
                  </button>
                );
              })}
              {ce && draft.defaultHeader.length === 2 && (
                <button onClick={() => { setDraft(p => ({ ...p, defaultHeader: [p.defaultHeader[1], p.defaultHeader[0]] })); setSaved(false); }} title="Đổi thứ tự"
                  style={{ padding: "5px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}>⇄</button>
              )}
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

        {/* Migrate dữ liệu nhóm — chỉ hiện khi có nhóm orphaned (nhãn cũ không còn trong config) */}
        {ce && useAPI && (() => {
          const rangeAttrs = draft.attrs.filter(atId => draft.rangeGroups?.[atId]?.length);
          if (!rangeAttrs.length) return null;
          const activeAttr = migAttr || rangeAttrs[0];
          const configuredLabels = draft.attrValues[activeAttr] || [];
          // Chỉ lấy nhãn không còn trong config nhưng vẫn còn kiện trong kho
          const orphanedLabels = bundles
            .filter(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[activeAttr] && !configuredLabels.includes(b.attributes[activeAttr]))
            .map(b => b.attributes[activeAttr])
            .filter((l, i, arr) => arr.indexOf(l) === i);
          if (!orphanedLabels.length) return null;
          const countFrom = migFrom ? bundles.filter(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[activeAttr] === migFrom).length : 0;

          const runMigration = async () => {
            if (!migFrom || !migTo || migFrom === migTo) return;
            if (!window.confirm(`Migrate ${countFrom} kiện: "${migFrom}" → "${migTo}" cho loại gỗ này. Không thể hoàn tác. Tiếp tục?`)) return;
            setMigRunning(true);
            try {
              const api = await import('../api.js');
              const r = await api.migrateBundleGroupValue(sw, activeAttr, migFrom, migTo);
              if (r.error) notify('Lỗi migrate: ' + r.error, false);
              else notify(`✓ Đã migrate ${r.count} kiện${r.failed ? `, ${r.failed} lỗi` : ''}`);
              setMigFrom(''); setMigTo('');
            } catch (e) { notify('Lỗi kết nối: ' + e.message, false); }
            finally { setMigRunning(false); }
          };

          return (
            <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--ac)', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ac)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔄 Migrate nhóm kiện gỗ</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 4, lineHeight: 1.5 }}>
                Có <strong>{orphanedLabels.length} nhóm cũ</strong> không còn trong cấu hình nhưng vẫn còn kiện gỗ đang gán nhãn đó — cần chuyển sang nhóm hiện tại.
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 10 }}>
                Tình huống xảy ra khi bạn đổi tên nhóm sau khi đã nhập kho. Thao tác <strong>không thể hoàn tác</strong>.
              </div>
              {rangeAttrs.length > 1 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Thuộc tính</label>
                  <select value={activeAttr} onChange={e => { setMigAttr(e.target.value); setMigFrom(''); setMigTo(''); }}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none' }}>
                    {rangeAttrs.map(id => <option key={id} value={id}>{ats.find(a => a.id === id)?.name || id}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Nhóm cũ (không còn cấu hình)</label>
                  <select value={migFrom} onChange={e => setMigFrom(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--ac)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none', minWidth: 160 }}>
                    <option value="">— Chọn —</option>
                    {orphanedLabels.map(l => {
                      const cnt = bundles.filter(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[activeAttr] === l).length;
                      return <option key={l} value={l}>⚠ {l} ({cnt} kiện)</option>;
                    })}
                  </select>
                </div>
                <div style={{ fontSize: '1rem', color: 'var(--tm)', paddingBottom: 6 }}>→</div>
                <div>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Nhóm mới (hiện tại)</label>
                  <select value={migTo} onChange={e => setMigTo(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none', minWidth: 160 }}>
                    <option value="">— Chọn —</option>
                    {configuredLabels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <button onClick={runMigration} disabled={!migFrom || !migTo || migRunning || countFrom === 0}
                  style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: (migFrom && migTo && countFrom > 0) ? 'var(--ac)' : 'var(--bd)', color: (migFrom && migTo && countFrom > 0) ? '#fff' : 'var(--tm)', cursor: (migFrom && migTo && countFrom > 0) ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {migRunning ? '⏳ Đang migrate...' : `Migrate${countFrom > 0 ? ` ${countFrom} kiện` : ''}`}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
