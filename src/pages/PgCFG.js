import React, { useState } from "react";
import { WoodPicker } from "../components/Matrix";

export default function PgCFG({ wts, ats, cfg, setCfg, ce, useAPI, notify }) {
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
      </div>
    </div>
  );
}
