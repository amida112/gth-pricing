import React, { useState } from "react";
import { WoodPicker } from "../components/Matrix";

export default function PgCFG({ wts, ats, cfg, setCfg, ce, useAPI, notify, bundles = [] }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const [migFrom, setMigFrom] = useState('');
  const [migTo, setMigTo] = useState('');
  const [migAttr, setMigAttr] = useState('');
  const [migRunning, setMigRunning] = useState(false);

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
    const cur = draft.attrValues[atId] || [];
    const removing = cur.includes(val);
    if (removing) {
      const affected = bundles.filter(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[atId] === val).length;
      if (affected > 0 && !window.confirm(`${affected} gỗ kiện đang dùng giá trị "${val}" sẽ không hiển thị trong bảng giá nếu bỏ chọn. Vẫn tiếp tục?`)) {
        return;
      }
    }
    setDraft(p => ({ ...p, attrValues: { ...p.attrValues, [atId]: removing ? cur.filter(v => v !== val) : [...cur, val] } }));
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
      import('../api.js').then(api => api.saveWoodConfig(sw, finalDraft)
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

        {/* Migrate dữ liệu nhóm dài */}
        {ce && useAPI && (() => {
          const rangeAttrs = draft.attrs.filter(atId => {
            const atDef = ats.find(a => a.id === atId);
            return atDef?.rangeGroups?.length;
          });
          if (!rangeAttrs.length) return null;
          const activeAttr = migAttr || rangeAttrs[0];
          const atDef = ats.find(a => a.id === activeAttr);
          const allLabels = atDef?.rangeGroups?.map(g => g.label) || [];
          const configuredLabels = draft.attrValues[activeAttr] || [];
          // Các nhóm có trong DB (bundles) nhưng không nằm trong cấu hình hiện tại
          const unconfiguredInUse = allLabels.filter(l => !configuredLabels.includes(l) && bundles.some(b => (b.woodId === sw || b.wood_id === sw) && b.attributes?.[activeAttr] === l));
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
            } catch (e) {
              notify('Lỗi kết nối: ' + e.message, false);
            } finally {
              setMigRunning(false);
            }
          };

          return (
            <div style={{ background: 'var(--bgc)', borderRadius: 10, border: '1.5px solid var(--ac)', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ac)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                🔄 Migrate dữ liệu nhóm
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 10 }}>
                Đổi nhóm thuộc tính cho tất cả kiện gỗ loại này đang bị phân sai nhóm.
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
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Từ nhóm</label>
                  <select value={migFrom} onChange={e => setMigFrom(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none', minWidth: 140 }}>
                    <option value="">— Chọn —</option>
                    {allLabels.map(l => (
                      <option key={l} value={l}>
                        {l}{unconfiguredInUse.includes(l) ? ' ⚠ không cấu hình' : ''}{bundles.filter(b => (b.woodId===sw||b.wood_id===sw) && b.attributes?.[activeAttr]===l).length > 0 ? ` (${bundles.filter(b=>(b.woodId===sw||b.wood_id===sw)&&b.attributes?.[activeAttr]===l).length} kiện)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: '1rem', color: 'var(--tm)', paddingBottom: 6 }}>→</div>
                <div>
                  <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Sang nhóm</label>
                  <select value={migTo} onChange={e => setMigTo(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', fontSize: '0.78rem', background: 'var(--bgc)', outline: 'none', minWidth: 140 }}>
                    <option value="">— Chọn —</option>
                    {configuredLabels.filter(l => l !== migFrom).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <button onClick={runMigration} disabled={!migFrom || !migTo || migFrom === migTo || migRunning || countFrom === 0}
                  style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: (migFrom && migTo && migFrom !== migTo && countFrom > 0) ? 'var(--ac)' : 'var(--bd)', color: (migFrom && migTo && migFrom !== migTo && countFrom > 0) ? '#fff' : 'var(--tm)', cursor: (migFrom && migTo && migFrom !== migTo && countFrom > 0) ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {migRunning ? '⏳ Đang migrate...' : `Migrate${countFrom > 0 ? ` ${countFrom} kiện` : ''}`}
                </button>
              </div>
              {migFrom && countFrom === 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--tm)', marginTop: 6 }}>Không có kiện nào thuộc nhóm "{migFrom}" cho loại gỗ này.</div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
