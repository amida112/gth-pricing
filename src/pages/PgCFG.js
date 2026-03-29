import React, { useState, useEffect, useRef } from "react";
import Dialog from '../components/Dialog';
import { WoodPicker } from "../components/Matrix";
import { resolveRangeGroup, bpk } from "../utils";

// ── Dọn mã hàng (thickness chips) không còn tồn kho ───────────────────────────
function CleanupChipsBtn({ unusedChips, woodId, woodName, bundles, prices, cfg, setCfg, setP, useAPI, notify, draft, setDraft, setSaved }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(unusedChips));
  const [deletePrice, setDeletePrice] = useState(false);

  // Thông tin chi tiết cho mỗi chip không dùng
  const chipInfo = unusedChips.map(chip => {
    const woodBundles = bundles.filter(b =>
      (b.woodId || b.wood_id) === woodId && b.attributes?.thickness === chip
    );
    const soldCount = woodBundles.filter(b => b.status === 'Đã bán').length;
    const pendingCount = woodBundles.filter(b => b.status === 'Chưa được bán').length; // đã gán đơn hàng
    const priceCount = Object.keys(prices).filter(k =>
      k.startsWith(woodId + '||') && k.includes(`thickness:${chip}`)
    ).length;
    const neverHad = woodBundles.length === 0; // chưa từng có kiện nào
    return { chip, soldCount, pendingCount, priceCount, neverHad };
  });
  const hasPending = chipInfo.some(c => c.pendingCount > 0);

  const handleCleanup = async () => {
    const chips = [...selected];
    if (!chips.length) return;
    // Xóa chip khỏi draft + cfg
    const newVals = (draft.attrValues.thickness || []).filter(v => !selected.has(v));
    setDraft(p => ({ ...p, attrValues: { ...p.attrValues, thickness: newVals } }));
    setCfg(prev => {
      const wc = prev[woodId];
      if (!wc) return prev;
      const next = { ...prev, [woodId]: { ...wc, attrValues: { ...wc.attrValues, thickness: newVals } } };
      if (useAPI) import('../api.js').then(api => api.saveWoodConfig(woodId, next[woodId]));
      return next;
    });
    // Xóa giá nếu được chọn
    if (deletePrice) {
      const keysToDelete = [];
      chips.forEach(chip => {
        Object.keys(prices).forEach(k => {
          if (k.startsWith(woodId + '||') && k.includes(`thickness:${chip}`)) keysToDelete.push(k);
        });
      });
      if (keysToDelete.length) {
        setP(prev => {
          const next = { ...prev };
          keysToDelete.forEach(k => delete next[k]);
          return next;
        });
        if (useAPI) {
          import('../api.js').then(api =>
            api.deletePrices(woodId, keysToDelete.map(k => k.split('||').slice(1).join('||')))
          );
        }
      }
    }
    setSaved(false);
    setOpen(false);
    notify(`Đã dọn ${chips.length} mã hàng của ${woodName}`);
  };

  return (
    <>
      <button onClick={() => { setSelected(new Set(unusedChips)); setDeletePrice(false); setOpen(true); }}
        style={{ marginBottom: 6, padding: "5px 12px", borderRadius: 5, border: "1.5px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>
        🗑 Dọn mã hàng không dùng ({unusedChips.length})
      </button>
      <Dialog open={!!open} onClose={() => setOpen(false)} onOk={handleCleanup} title="Dọn mã SKU" width={520}>
            <p style={{ margin: "0 0 12px", fontSize: "0.78rem", color: "var(--ts)", lineHeight: 1.5 }}>
              Các độ dày sau không còn kiện nào <strong>chưa bán</strong> trong kho <strong>{woodName}</strong>:
            </p>
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 12, borderRadius: 7, border: "1px solid var(--bd)", background: "var(--bgs)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "5px 8px", textAlign: "left", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem" }}></th>
                    <th style={{ padding: "5px 8px", textAlign: "left", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>Độ dày</th>
                    <th style={{ padding: "5px 8px", textAlign: "center", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>Trạng thái</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>Kiện đã bán</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1.5px solid var(--bd)", fontWeight: 700, color: "var(--brl)", fontSize: "0.62rem", textTransform: "uppercase" }}>Mức giá</th>
                  </tr>
                </thead>
                <tbody>
                  {chipInfo.map(({ chip, soldCount, pendingCount, priceCount, neverHad }, i) => (
                    <tr key={chip} style={{ background: i % 2 ? "#fff" : "var(--bgs)" }}>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)" }}>
                        <input type="checkbox" checked={selected.has(chip)} onChange={e => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(chip) : next.delete(chip);
                          setSelected(next);
                        }} style={{ accentColor: "var(--dg)" }} />
                      </td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700 }}>{chip}</td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontSize: "0.62rem" }}>
                        {pendingCount > 0
                          ? <span style={{ color: "#ea580c", fontWeight: 700 }}>⚠ {pendingCount} kiện chờ bán</span>
                          : neverHad
                            ? <span style={{ color: "var(--tm)" }}>Chưa từng nhập</span>
                            : <span style={{ color: "var(--gn)" }}>Đã bán hết</span>}
                      </td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: "var(--tm)" }}>{soldCount}</td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: priceCount ? "var(--ac)" : "var(--tm)" }}>{priceCount || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasPending && (
              <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(234,88,12,0.08)", border: "1.5px solid rgba(234,88,12,0.4)", fontSize: "0.72rem", color: "#ea580c", fontWeight: 600, lineHeight: 1.6 }}>
                ⚠ Một số chip đang có kiện ở trạng thái "Chưa được bán" (đã gán vào đơn hàng). Dọn chip không ảnh hưởng dữ liệu kiện, nhưng giá tra cứu sẽ ẩn nếu chọn "Xóa luôn giá".
              </div>
            )}
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(124,92,191,0.06)", border: "1px solid var(--gbd)", fontSize: "0.72rem", color: "var(--ts)", lineHeight: 1.6 }}>
              <div>• Chip bị xóa khỏi cấu hình — không hiển thị trong bảng giá và tồn kho</div>
              <div>• Kiện đã bán vẫn giữ nguyên dữ liệu — đơn hàng cũ không bị ảnh hưởng</div>
              <div>• Nếu nhập kho dày này lại → chip tự sinh lại{!deletePrice && ', giá cũ vẫn hiển thị'}</div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--dg)" }}>
              <input type="checkbox" checked={deletePrice} onChange={e => setDeletePrice(e.target.checked)} style={{ accentColor: "var(--dg)" }} />
              Xóa luôn giá kèm theo (không khôi phục)
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>Hủy</button>
              <button onClick={handleCleanup} disabled={!selected.size}
                style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: selected.size ? "var(--dg)" : "var(--bd)", color: selected.size ? "#fff" : "var(--tm)", cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.8rem" }}>
                Dọn {selected.size} mã đã chọn
              </button>
            </div>
      </Dialog>
    </>
  );
}

export default function PgCFG({ wts, ats, cfg, setCfg, prices, setP, ce, useAPI, notify, bundles = [], setBundles, onRenameAttrValForWood, onMigratePriceGroup }) {
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
  const [outOfRangeAtId, setOutOfRangeAtId] = useState(null); // at.id đang mở detail kiện ngoài khoảng
  const [manualAssign, setManualAssign] = useState({});       // { bundleId_atId: targetGroup }
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  // Ref để tránh stale closure trong hotkey handler
  const delFnRef = useRef(null);

  const cloneCfg = (id) => {
    const c = cfg[id];
    if (!c) return { attrs: [], attrValues: {}, defaultHeader: [], attrPriceGroups: {}, rangeGroups: {}, attrAliases: {} };
    return {
      attrs: [...(c.attrs || [])],
      attrValues: Object.fromEntries(Object.entries(c.attrValues || {}).map(([k, v]) => [k, [...v]])),
      defaultHeader: [...(c.defaultHeader || [])],
      attrPriceGroups: JSON.parse(JSON.stringify(c.attrPriceGroups || {})),
      rangeGroups: JSON.parse(JSON.stringify(c.rangeGroups || {})),
      attrAliases: JSON.parse(JSON.stringify(c.attrAliases || {})),
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
    setManualAssign({}); setOutOfRangeAtId(null);
    setBulkSelected(new Set()); setSavingBulk(false);
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(cloneCfg(sw));

  // === Bật/tắt attribute cho wood ===
  const toggleAttr = (atId) => {
    if (draft.attrs.includes(atId)) {
      const atName = ats.find(a => a.id === atId)?.name || atId;
      if (!window.confirm(`Bỏ cấu hình thuộc tính "${atName}" cho loại gỗ này?\n\nToàn bộ chip values và rangeGroups của thuộc tính này sẽ bị xóa khỏi cấu hình.`)) return;
    }
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

    // Detect NCC chuyển từ default → special: migrate giá
    if (onMigratePriceGroup) {
      const oldCfg = cfg[sw];
      Object.entries(draft.attrPriceGroups || {}).forEach(([atId, pg]) => {
        const oldPg = oldCfg?.attrPriceGroups?.[atId];
        if (!oldPg) return; // chưa có nhóm giá trước đó → không cần migrate
        const oldSpecials = new Set(oldPg.special || []);
        const newSpecials = pg.special || [];
        const defaultLabel = oldPg.default || 'Chung';
        // NCC mới thêm vào special = trước đó nằm trong default group
        const movedToSpecial = newSpecials.filter(v => !oldSpecials.has(v));
        if (movedToSpecial.length > 0) {
          // Kiểm tra: còn NCC nào KHÔNG nằm trong special không?
          const allValues = draft.attrValues?.[atId] || [];
          const allNowSpecial = allValues.every(v => newSpecials.includes(v));
          onMigratePriceGroup(sw, atId, defaultLabel, movedToSpecial, allNowSpecial);
        }
      });
    }

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

  // Hotkey X: xóa chip đang chọn khi không đang focus vào input
  delFnRef.current = deleteValFromAttr;
  useEffect(() => {
    if (selChipIdx === null || !editAtId || !ce) return;
    const atId = editAtId;
    const idx = selChipIdx;
    const handler = (e) => {
      if ((e.key === 'x' || e.key === 'X') && !(e.ctrlKey || e.metaKey || e.altKey) &&
          document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        delFnRef.current?.(atId, idx);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selChipIdx, editAtId, ce]);

  const secHd = { padding: "9px 14px", background: "var(--bgh)", borderBottom: "1px solid var(--bds)", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" };
  const chipBase = { padding: "4px 11px", borderRadius: 5, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", userSelect: "none", transition: "all 0.12s" };

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
                    {active && at.id === 'thickness' && wts.find(w => w.id === sw)?.thicknessMode === 'auto' && (
                      <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.6rem", fontWeight: 700, background: "var(--gbg)", color: "var(--gtx)", border: "1px solid var(--gbd)" }}>Chip tự sinh</span>
                    )}
                    {active && at.id === 'thickness' && wts.find(w => w.id === sw)?.thicknessMode !== 'auto' && (
                      <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.6rem", fontWeight: 700, background: "var(--bgs)", color: "var(--tm)", border: "1px solid var(--bd)" }}>Chip cố định</span>
                    )}
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

                      {/* Alias summary — hiển thị aliases đã gán cho mỗi chip */}
                      {(() => {
                        const aliasMap = draft.attrAliases?.[at.id];
                        if (!aliasMap || !Object.keys(aliasMap).length) return null;
                        const entries = Object.entries(aliasMap).filter(([chip, als]) => als?.length && selVals.includes(chip));
                        if (!entries.length) return null;
                        return (
                          <div style={{ marginBottom: 6, padding: '5px 8px', borderRadius: 5, background: 'rgba(90,62,39,0.03)', border: '1px solid var(--bd)', fontSize: '0.63rem', color: 'var(--tm)' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.58rem', letterSpacing: '0.04em' }}>Alias: </span>
                            {entries.map(([chip, als]) => (
                              <span key={chip} style={{ marginRight: 10 }}>
                                <span style={{ fontWeight: 700, color: 'var(--ts)' }}>{chip}</span>
                                {' ← '}
                                {als.map((a, i) => (
                                  <span key={i}>
                                    <span style={{ color: 'var(--ac)', fontWeight: 600 }}>{a}</span>
                                    {ce && <span onClick={() => {
                                      const next = { ...draft };
                                      const am = { ...(next.attrAliases || {}) };
                                      const atAl = { ...(am[at.id] || {}) };
                                      atAl[chip] = atAl[chip].filter((_, j) => j !== i);
                                      if (!atAl[chip].length) delete atAl[chip];
                                      am[at.id] = atAl;
                                      if (!Object.keys(atAl).length) delete am[at.id];
                                      next.attrAliases = am;
                                      setDraft(next); setSaved(false);
                                    }} style={{ cursor: 'pointer', color: 'var(--dg)', fontWeight: 800, marginLeft: 2, fontSize: '0.65rem', transition: 'all 0.12s' }}>×</span>}
                                    {i < als.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        );
                      })()}

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
                          <button onClick={() => deleteValFromAttr(at.id, selChipIdx)} title="Xóa chip này (phím X)"
                            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem", flexShrink: 0 }}>Xóa <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>[X]</span></button>
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

                      {/* Alias (bí danh) cho chip đang chọn */}
                      {ce && editAtId === at.id && selChipIdx !== null && !isSupplier && (() => {
                        const chipVal = selVals[selChipIdx];
                        const aliases = draft.attrAliases?.[at.id]?.[chipVal] || [];
                        return (
                          <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(90,62,39,0.03)", border: "1px solid var(--bd)" }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--tm)", marginBottom: 4, textTransform: "uppercase" }}>Bí danh (alias) — giá trị quy đổi về "{chipVal}"</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: aliases.length ? 4 : 0 }}>
                              {aliases.map((a, ai) => (
                                <span key={ai} style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.68rem", background: "var(--bgs)", border: "1px solid var(--bds)", color: "var(--ts)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  {a}
                                  <span onClick={() => {
                                    const next = { ...draft };
                                    const am = { ...(next.attrAliases || {}) };
                                    const atAl = { ...(am[at.id] || {}) };
                                    atAl[chipVal] = (atAl[chipVal] || []).filter((_, j) => j !== ai);
                                    if (!atAl[chipVal].length) delete atAl[chipVal];
                                    am[at.id] = atAl;
                                    if (!Object.keys(atAl).length) delete am[at.id];
                                    next.attrAliases = am;
                                    setDraft(next);
                                  }} style={{ cursor: "pointer", color: "var(--dg)", fontWeight: 800, fontSize: "0.7rem", lineHeight: 1, transition: "all 0.12s" }}>×</span>
                                </span>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                placeholder='VD: "A" hoặc "19-29"'
                                onKeyDown={e => {
                                  if (e.key !== 'Enter') return;
                                  const v = e.target.value.trim();
                                  if (!v) return;
                                  // Check trùng
                                  if (v === chipVal || selVals.includes(v) || aliases.includes(v)) return;
                                  // Check không trùng alias chip khác
                                  const otherAliases = Object.entries(draft.attrAliases?.[at.id] || {}).filter(([k]) => k !== chipVal);
                                  if (otherAliases.some(([, als]) => als?.includes(v))) return;
                                  const next = { ...draft };
                                  const am = { ...(next.attrAliases || {}) };
                                  const atAl = { ...(am[at.id] || {}) };
                                  atAl[chipVal] = [...(atAl[chipVal] || []), v];
                                  am[at.id] = atAl;
                                  next.attrAliases = am;
                                  setDraft(next);
                                  e.target.value = '';
                                }}
                                style={{ flex: 1, padding: "3px 7px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.7rem", outline: "none", maxWidth: 160 }} />
                              <span style={{ fontSize: "0.58rem", color: "var(--tm)" }}>Enter để thêm</span>
                            </div>
                          </div>
                        );
                      })()}

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
                          {at.id === 'thickness' && wts.find(w => w.id === sw)?.thicknessMode === 'auto' && (
                            <div style={{ fontSize: "0.62rem", color: "var(--gtx)", marginTop: 4, padding: "4px 8px", borderRadius: 4, background: "var(--gbg)", border: "1px solid var(--gbd)" }}>
                              Chip tự sinh khi nhập kho — không cần thêm thủ công. Thêm ở đây chỉ để pre-populate cho bảng giá.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dọn mã hàng không còn tồn kho — chỉ hiện cho thickness auto mode */}
                      {ce && at.id === 'thickness' && wts.find(w => w.id === sw)?.thicknessMode === 'auto' && (() => {
                        const unusedChips = selVals.filter(chip => {
                          return !bundles.some(b =>
                            (b.woodId || b.wood_id) === sw &&
                            b.status !== 'Đã bán' &&
                            b.attributes?.thickness === chip
                          );
                        });
                        if (!unusedChips.length) return null;
                        return (
                          <CleanupChipsBtn
                            unusedChips={unusedChips}
                            woodId={sw}
                            woodName={wts.find(w => w.id === sw)?.name || sw}
                            bundles={bundles}
                            prices={prices}
                            cfg={cfg}
                            setCfg={setCfg}
                            setP={setP}
                            useAPI={useAPI}
                            notify={notify}
                            draft={draft}
                            setDraft={setDraft}
                            setSaved={setSaved}
                          />
                        );
                      })()}

                      {/* Orphan values — giá trị bundle không khớp chip */}
                      {(() => {
                        // Bỏ qua thickness auto (chip tự sinh) và supplier (đồng bộ từ NCC)
                        const isAutoTh = at.id === 'thickness' && wts.find(w => w.id === sw)?.thicknessMode === 'auto';
                        if (isAutoTh || isSupplier || !selVals.length) return null;
                        // Tập hợp giá trị hợp lệ: chips + aliases
                        const validSet = new Set(selVals);
                        const aliasMap = draft.attrAliases?.[at.id] || {};
                        Object.values(aliasMap).forEach(als => als?.forEach(a => validSet.add(a)));
                        // Tìm bundles orphan
                        const woodBundles = bundles.filter(b => (b.woodId || b.wood_id) === sw && b.status !== 'Đã bán');
                        const orphanMap = {};
                        woodBundles.forEach(b => {
                          const v = b.attributes?.[at.id];
                          if (v && !validSet.has(v)) {
                            if (!orphanMap[v]) orphanMap[v] = { count: 0, volume: 0 };
                            orphanMap[v].count += 1;
                            orphanMap[v].volume += parseFloat(b.remainingVolume) || 0;
                          }
                        });
                        const orphanList = Object.entries(orphanMap).sort((a, b) => b[1].count - a[1].count);
                        if (!orphanList.length) return null;
                        const totalCount = orphanList.reduce((s, [, d]) => s + d.count, 0);
                        const totalVol = orphanList.reduce((s, [, d]) => s + d.volume, 0);
                        return (
                          <div style={{ marginBottom: 8, borderRadius: 7, border: '1.5px solid #E8A838', background: '#FFF8F0', padding: '8px 10px' }}>
                            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#C07000', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>⚠</span> {orphanList.length} giá trị chưa khớp ({totalCount} kiện · {totalVol.toFixed(1)} m³)
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {orphanList.map(([val, data]) => (
                                <div key={val} style={{ padding: '5px 8px', borderRadius: 5, background: '#fff', border: '1px solid #F0DFC0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ minWidth: 100 }}>
                                    <span style={{ fontWeight: 800, color: '#8B2500', fontSize: '0.76rem' }}>"{val}"</span>
                                    <span style={{ fontSize: '0.62rem', color: '#8B6914', marginLeft: 6 }}>{data.count} kiện · {data.volume.toFixed(1)} m³</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem' }}>
                                    <span style={{ color: '#8B6914' }}>→ Gán alias vào:</span>
                                    <select
                                      defaultValue=""
                                      onChange={e => {
                                        const chip = e.target.value;
                                        if (!chip) return;
                                        const next = { ...draft };
                                        const am = { ...(next.attrAliases || {}) };
                                        const atAl = { ...(am[at.id] || {}) };
                                        atAl[chip] = [...(atAl[chip] || []), val];
                                        am[at.id] = atAl;
                                        next.attrAliases = am;
                                        setDraft(next);
                                        setSaved(false);
                                        e.target.value = '';
                                      }}
                                      style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #E8A838', fontSize: '0.7rem', background: '#fff', outline: 'none', minWidth: 100 }}>
                                      <option value="">— Chọn chip —</option>
                                      {selVals.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <span style={{ color: '#aaa', fontSize: '0.62rem' }}>hoặc</span>
                                    <button
                                      onClick={() => {
                                        // Tạo chip mới = giá trị orphan
                                        const next = { ...draft, attrValues: { ...draft.attrValues, [at.id]: [...selVals, val] } };
                                        setDraft(next);
                                        setSaved(false);
                                      }}
                                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--br)', background: 'transparent', color: 'var(--br)', cursor: 'pointer', fontWeight: 700, fontSize: '0.64rem', whiteSpace: 'nowrap' }}>
                                      + Tạo chip "{val}"
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* rangeGroups toggle + editor — chỉ cho length/width, loại bỏ hoàn toàn cho thickness */}
                      {ce && at.id !== 'thickness' && (at.id === 'length' || at.id === 'width' || !!draft.rangeGroups?.[at.id]) && (
                        <div style={{ marginTop: 6 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--ts)", userSelect: "none", marginBottom: rgEnabled ? 8 : 0 }}>
                            <input type="checkbox" checked={rgEnabled} onChange={e => toggleRangeGroups(at.id, e.target.checked)} style={{ accentColor: "var(--ac)" }} />
                            Nhóm theo khoảng đo lường (rangeGroups)
                            <span style={{ fontWeight: 400, color: "var(--tm)", fontSize: "0.65rem" }}>— nhập giá trị thực đo, tự khớp nhóm bảng giá</span>
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
                                    {(() => {
                                      const chipOrder = draft.attrValues?.[at.id] || [];
                                      return (draft.rangeGroups[at.id] || [])
                                        .map((g, gi) => ({ g, gi }))
                                        .sort((a, b) => {
                                          const ia = chipOrder.indexOf(a.g.label);
                                          const ib = chipOrder.indexOf(b.g.label);
                                          return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
                                        })
                                        .map(({ g, gi }, rowI) => (
                                          <tr key={gi} style={{ background: rowI % 2 ? "var(--bgs)" : "#fff" }}>
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
                                        ));
                                    })()}
                                    {!(draft.rangeGroups[at.id] || []).length && (
                                      <tr><td colSpan={3} style={{ padding: "8px 10px", color: "var(--tm)", fontStyle: "italic", fontSize: "0.72rem" }}>Chưa có giá trị nào — thêm giá trị bên trên trước</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              {gapWarn && <div style={{ fontSize: "0.65rem", color: "#856404", background: "#FFF3CD", border: "1px solid #FFD54F", borderRadius: 4, padding: "4px 8px", marginTop: 6 }}>{gapWarn}</div>}
                              {overlapWarn && <div style={{ fontSize: "0.65rem", color: "var(--dg)", background: "rgba(192,57,43,0.07)", border: "1px solid var(--dg)", borderRadius: 4, padding: "4px 8px", marginTop: 4 }}>⚠ {overlapWarn}</div>}
                              {/* Thống kê phân nhóm + cảnh báo kiện cần xử lý — unified */}
                              {(() => {
                                const curRg = draft.rangeGroups?.[at.id];
                                if (!curRg?.length) return null;
                                // Groupable attrs (thickness): lưu giá trị thực, không phải nhãn nhóm
                                // → group được resolve động tại pricing time, không cần migrate hay mismatch check
                                if (at.groupable) return null;
                                const woodBundles = bundles.filter(b => (b.woodId === sw || b.wood_id === sw) && b.rawMeasurements?.[at.id]);
                                const groupOpts = draft.attrValues?.[at.id] || [];

                                // Phân loại từng kiện
                                const countByGroup = {};
                                groupOpts.forEach(g => { countByGroup[g] = 0; });
                                const problemBundles = [];
                                woodBundles.forEach(b => {
                                  const raw = b.rawMeasurements[at.id];
                                  const resolved = resolveRangeGroup(raw, curRg);
                                  const assigned = b.attributes?.[at.id];
                                  if (resolved !== null) {
                                    countByGroup[resolved] = (countByGroup[resolved] || 0) + 1;
                                    if (resolved !== assigned) problemBundles.push({ b, raw, resolved, assigned, type: 'mismatch' });
                                  } else {
                                    problemBundles.push({ b, raw, resolved: null, assigned, type: 'noGroup' });
                                  }
                                });

                                const mismatchCount = problemBundles.filter(x => x.type === 'mismatch').length;
                                const noGroupCount = problemBundles.filter(x => x.type === 'noGroup').length;
                                const isOpen = outOfRangeAtId === at.id;

                                // Bulk select
                                const problemIds = problemBundles.map(x => x.b.id);
                                const allSelected = problemIds.length > 0 && problemIds.every(id => bulkSelected.has(id));
                                const someSelected = problemIds.some(id => bulkSelected.has(id));
                                const selectedCount = problemIds.filter(id => bulkSelected.has(id)).length;
                                const toggleAll = () => allSelected ? setBulkSelected(new Set()) : setBulkSelected(new Set(problemIds));
                                const toggleOne = id => setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

                                const doBulkSave = async () => {
                                  const toSave = problemBundles
                                    .filter(x => bulkSelected.has(x.b.id))
                                    .map(x => {
                                      const key = x.b.id + '_' + at.id;
                                      const sel = manualAssign[key] !== undefined ? manualAssign[key] : (x.resolved || '');
                                      return { b: x.b, sel };
                                    })
                                    .filter(({ sel }) => sel);
                                  if (!toSave.length) return;
                                  setSavingBulk(true);
                                  try {
                                    const api = await import('../api.js');
                                    let errors = 0;
                                    for (const { b, sel } of toSave) {
                                      const newAttrs = { ...b.attributes, [at.id]: sel };
                                      const r = await api.updateBundle(b.id, { attributes: newAttrs, sku_key: bpk(b.woodId || b.wood_id, newAttrs) });
                                      if (r.error) { errors++; continue; }
                                      setManualAssign(p => { const n = { ...p }; delete n[b.id + '_' + at.id]; return n; });
                                      if (setBundles) setBundles(prev => prev.map(x => x.id === b.id ? { ...x, attributes: newAttrs } : x));
                                    }
                                    if (errors > 0) notify(`Hoàn thành với ${errors} lỗi`, false);
                                    else notify(`✓ Đã cập nhật ${toSave.length} kiện`, true);
                                    setBulkSelected(new Set());
                                  } catch (e) { notify('Lỗi: ' + e.message, false); }
                                  finally { setSavingBulk(false); }
                                };

                                return (
                                  <div style={{ marginTop: 8 }}>
                                    {/* Stats row compact */}
                                    <div style={{ borderRadius: 6, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: problemBundles.length ? 8 : 0 }}>
                                      <div style={{ display: "flex", alignItems: "stretch" }}>
                                        {groupOpts.map((g, gi) => {
                                          const rg = curRg.find(r => r.label === g);
                                          return (
                                            <div key={g} style={{ flex: "1 1 0", padding: "6px 10px", borderRight: gi < groupOpts.length - 1 ? "1px solid var(--bd)" : "none", minWidth: 0 }}>
                                              <div title={g} style={{ fontSize: "0.6rem", color: "var(--tm)", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g}</div>
                                              <div style={{ fontWeight: 800, fontSize: "0.88rem", color: (countByGroup[g] || 0) > 0 ? "var(--br)" : "var(--tm)" }}>{countByGroup[g] || 0}</div>
                                              {rg && <div style={{ fontSize: "0.57rem", color: "var(--tm)", fontFamily: "monospace", marginTop: 1 }}>≥{rg.min ?? '?'} / ≤{rg.max ?? '?'}</div>}
                                            </div>
                                          );
                                        })}
                                        <div style={{ flex: "0 0 auto", padding: "6px 10px", borderLeft: groupOpts.length > 0 ? "1px solid var(--bd)" : "none", display: "flex", alignItems: "center" }}>
                                          {problemBundles.length === 0
                                            ? <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gn)", whiteSpace: "nowrap" }}>✓ Tất cả khớp đúng</span>
                                            : <span style={{ fontSize: "0.65rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                {mismatchCount > 0 && <span style={{ color: "#856404" }}>⚠ {mismatchCount} sai nhóm</span>}
                                                {mismatchCount > 0 && noGroupCount > 0 && <span style={{ color: "var(--tm)", margin: "0 4px" }}>·</span>}
                                                {noGroupCount > 0 && <span style={{ color: "var(--dg)" }}>✕ {noGroupCount} ngoài khoảng</span>}
                                              </span>
                                          }
                                        </div>
                                      </div>
                                    </div>

                                    {/* Unified alert list */}
                                    {problemBundles.length > 0 && (
                                      <div style={{ borderRadius: 6, border: "1px solid #856404", overflow: "hidden" }}>
                                        <button onClick={() => { setOutOfRangeAtId(isOpen ? null : at.id); setBulkSelected(new Set()); }}
                                          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: isOpen ? "rgba(133,100,4,0.1)" : "rgba(133,100,4,0.06)", border: "none", cursor: "pointer", textAlign: "left" }}>
                                          <div>
                                            <span style={{ fontWeight: 700, fontSize: "0.72rem", color: "#856404" }}>⚠ {problemBundles.length} kiện cần xử lý</span>
                                            <div style={{ marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                              {mismatchCount > 0 && <span style={{ fontSize: "0.65rem", color: "#a87c10" }}>• <strong>{mismatchCount} sai nhóm</strong> — số đo thực tế khớp nhóm khác với nhãn đang gán</span>}
                                              {noGroupCount > 0 && <span style={{ fontSize: "0.65rem", color: "var(--dg)" }}>• <strong>{noGroupCount} ngoài khoảng</strong> — số đo không rơi vào bất kỳ nhóm nào đã cấu hình</span>}
                                            </div>
                                          </div>
                                          <span style={{ fontSize: "0.6rem", color: "#856404", flexShrink: 0, marginLeft: 8 }}>{isOpen ? "▲" : "▼"}</span>
                                        </button>
                                        {isOpen && (
                                          <div>
                                            {useAPI && (
                                              <div style={{ padding: "6px 10px", background: "rgba(133,100,4,0.05)", borderTop: "1px solid #c8a84b", borderBottom: "1px solid #c8a84b", display: "flex", alignItems: "center", gap: 10 }}>
                                                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", fontWeight: 600, color: "#856404", cursor: "pointer", userSelect: "none" }}>
                                                  <input type="checkbox" checked={allSelected}
                                                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                                    onChange={toggleAll} style={{ accentColor: "#856404" }} />
                                                  Chọn tất cả ({problemBundles.length})
                                                </label>
                                                {selectedCount > 0 && (
                                                  <button onClick={doBulkSave} disabled={savingBulk}
                                                    style={{ padding: "4px 14px", borderRadius: 4, border: "none", background: savingBulk ? "var(--bd)" : "#856404", color: "#fff", fontWeight: 700, fontSize: "0.7rem", cursor: savingBulk ? "not-allowed" : "pointer" }}>
                                                    {savingBulk ? "Đang lưu..." : `Lưu ${selectedCount} kiện đã chọn`}
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                            <div style={{ overflowX: "auto" }}>
                                              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.71rem" }}>
                                                <thead>
                                                  <tr style={{ background: "rgba(133,100,4,0.07)" }}>
                                                    {useAPI && <th style={{ padding: "4px 8px", borderBottom: "1px solid #c8a84b", width: 32 }}></th>}
                                                    <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--ts)", borderBottom: "1px solid #c8a84b", whiteSpace: "nowrap" }}>Mã kiện</th>
                                                    <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--ts)", borderBottom: "1px solid #c8a84b", whiteSpace: "nowrap" }}>Số đo thực tế<span style={{ fontWeight: 400, marginLeft: 4, color: "var(--tm)" }}>(đã nhập kho)</span></th>
                                                    <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--ts)", borderBottom: "1px solid #c8a84b", whiteSpace: "nowrap" }}>Nhãn đang gán<span style={{ fontWeight: 400, marginLeft: 4, color: "var(--tm)" }}>(trong kho)</span></th>
                                                    <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--ts)", borderBottom: "1px solid #c8a84b", whiteSpace: "nowrap" }}>Nhóm đúng theo khoảng<span style={{ fontWeight: 400, marginLeft: 4, color: "var(--tm)" }}>(theo cấu hình hiện tại)</span></th>
                                                    <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 700, color: "var(--ts)", borderBottom: "1px solid #c8a84b", whiteSpace: "nowrap" }}>Cập nhật sang</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {problemBundles.map(({ b, raw, resolved, assigned, type }, i) => {
                                                    const key = b.id + '_' + at.id;
                                                    const sel = manualAssign[key] !== undefined ? manualAssign[key] : (resolved || '');
                                                    const isChecked = bulkSelected.has(b.id);
                                                    const rawUnit = at.id === 'length' ? 'm' : at.id === 'width' ? 'mm' : '';
                                                    const isMismatch = type === 'mismatch';
                                                    return (
                                                      <tr key={b.id} style={{ background: isChecked ? "rgba(133,100,4,0.08)" : i % 2 ? "rgba(133,100,4,0.02)" : "#fff" }}>
                                                        {useAPI && (
                                                          <td style={{ padding: "4px 8px", borderBottom: "1px solid #e8d5a3", textAlign: "center" }}>
                                                            <input type="checkbox" checked={isChecked} onChange={() => toggleOne(b.id)} style={{ accentColor: "#856404" }} />
                                                          </td>
                                                        )}
                                                        <td style={{ padding: "4px 10px", borderBottom: "1px solid #e8d5a3", fontFamily: "monospace", fontSize: "0.68rem" }}>{b.bundleCode}</td>
                                                        <td style={{ padding: "4px 10px", borderBottom: "1px solid #e8d5a3", fontWeight: 700, color: "#856404" }}>{raw}{rawUnit}</td>
                                                        <td style={{ padding: "4px 10px", borderBottom: "1px solid #e8d5a3" }}>
                                                          {assigned
                                                            ? <span style={{ color: isMismatch ? "var(--dg)" : "var(--ts)", fontWeight: isMismatch ? 700 : 400, textDecoration: isMismatch ? "line-through" : "none" }}>{assigned}</span>
                                                            : <em style={{ color: "var(--tm)" }}>chưa gán</em>}
                                                        </td>
                                                        <td style={{ padding: "4px 10px", borderBottom: "1px solid #e8d5a3" }}>
                                                          {type === 'noGroup'
                                                            ? <span style={{ color: "var(--dg)", fontSize: "0.68rem", fontWeight: 600 }}>✕ Không khớp nhóm nào</span>
                                                            : <span style={{ color: "var(--gn)", fontWeight: 700 }}>✓ {resolved}</span>}
                                                        </td>
                                                        <td style={{ padding: "4px 10px", borderBottom: "1px solid #e8d5a3" }}>
                                                          <select value={sel} onChange={e => setManualAssign(p => ({ ...p, [key]: e.target.value }))}
                                                            style={{ padding: "3px 8px", borderRadius: 4, border: "1.5px solid #856404", fontSize: "0.71rem", background: "var(--bgc)", outline: "none", minWidth: 110 }}>
                                                            <option value="">— Giữ nguyên —</option>
                                                            {groupOpts.map(l => <option key={l} value={l}>{l}{l === assigned ? ' ← hiện tại' : l === resolved ? ' ← đúng theo khoảng' : ''}</option>)}
                                                          </select>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
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
          // Detect orphans cho tất cả attrs có chip cấu hình
          // (trừ thickness auto — chip tự sinh, không cần migrate)
          const wt = wts.find(w => w.id === sw);
          const isAutoTh = wt?.thickness_mode === 'auto';
          const rangeAttrs = draft.attrs.filter(atId => {
            if (atId === 'thickness' && isAutoTh) return false;
            const vals = draft.attrValues[atId];
            return vals && vals.length > 0;
          });
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
