import React, { useState } from "react";

export default function PgAT({ ats, setAts, cfg, prices, ce, useAPI, notify, suppliers = [], onRenameAttrVal, bundles = [] }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ id: "", name: "", groupable: false, values: [] });
  const [fmErr, setFmErr] = useState({});
  const [gapWarning, setGapWarning] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newValErr, setNewValErr] = useState("");
  const [selValIdx, setSelValIdx] = useState(null);
  const [editValText, setEditValText] = useState("");
  const [editValErr, setEditValErr] = useState("");
  const [renames, setRenames] = useState({}); // { oldVal: newVal } — tracked for migration on save

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

  const openNew = () => { setFm({ id: "", name: "", groupable: false, values: [] }); setFmErr({}); setGapWarning(""); setNewVal(""); setNewValErr(""); setSelValIdx(null); setEd("new"); };
  const openEdit = (at) => {
    let vals;
    if (at.id === "supplier") {
      const configNames = suppliers.filter(s => s.configurable).map(s => s.name);
      const existing = at.values.filter(v => configNames.includes(v));
      const newOnes = configNames.filter(v => !at.values.includes(v));
      vals = [...existing, ...newOnes];
    } else {
      vals = [...at.values];
    }
    setFm({ id: at.id, name: at.name, groupable: !!at.groupable, values: vals });
    setFmErr({}); setGapWarning(""); setNewVal(""); setNewValErr(""); setSelValIdx(null); setRenames({}); setEd(at.id);
  };

  const selectChip = (vi) => {
    setSelValIdx(vi);
    setEditValText(fm.values[vi]);
    setEditValErr("");
  };

  const applyValRename = (vi, oldV, newV) => {
    setFm(p => { const arr = [...p.values]; arr[vi] = newV; return { ...p, values: p.groupable ? sortNumeric(arr) : arr }; });
    if (fm.groupable) setSelValIdx(null);
    setEditValErr("");
    // Track rename: chain nếu oldV là đích của rename trước đó
    setRenames(prev => {
      const next = { ...prev };
      const origin = Object.keys(next).find(k => next[k] === oldV);
      if (origin) {
        if (origin === newV) delete next[origin]; // hoàn tác về giá trị gốc
        else next[origin] = newV;
      } else {
        next[oldV] = newV;
      }
      return next;
    });
  };

  const commitEditVal = () => {
    if (selValIdx === null) return;
    const v = normalizeVal(editValText, fm.groupable);
    if (!v) return;
    const oldVal = fm.values[selValIdx];
    if (v === oldVal) { setEditValErr(""); return; }
    const dup = fm.values.some((x, i) => i !== selValIdx && x.toLowerCase() === v.toLowerCase());
    if (dup) { setEditValErr(`"${v}" đã tồn tại`); return; }
    // Nếu giá trị cũ đang có trong bảng giá → yêu cầu xác nhận lần 2
    if (ed !== "new" && valUsedInPrices(ed, oldVal)) {
      if (editValErr.startsWith("⚠️")) {
        // Lần 2: xác nhận → áp dụng
        applyValRename(selValIdx, oldVal, v);
      } else {
        setEditValErr(`⚠️ "${oldVal}" đang có giá. Nhấn Enter lần nữa để xác nhận đổi tên và migrate toàn bộ giá, kho, lịch sử.`);
      }
      return;
    }
    applyValRename(selValIdx, oldVal, v);
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
    // V-09: chặn xóa nếu có bundle đang dùng giá trị này
    const bundleCount = bundles.filter(b => b.attributes && b.attributes[ed] === val).length;
    if (bundleCount > 0) {
      setEditValErr(`Không thể xóa — "${val}" đang được dùng bởi ${bundleCount} gỗ kiện trong kho`);
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
    if (!fm.values.length && ed !== "supplier") errs.values = "Cần ít nhất 1 giá trị";
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
    setGapWarning("");
    const finalVals = fm.groupable ? sortNumeric(fm.values) : fm.values;
    if (ed === "new") {
      const id = previewId || ("attr_" + Date.now());
      setAts(p => [...p, { id, name: fm.name.trim(), groupable: fm.groupable, values: finalVals }]);
      if (useAPI) import('../api.js').then(api => api.saveAttribute(id, fm.name.trim(), fm.groupable, finalVals, null)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã thêm thuộc tính " + fm.name.trim()), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      setAts(p => p.map(a => a.id === ed ? { ...a, name: fm.name.trim(), groupable: fm.groupable, values: finalVals } : a));
      if (useAPI) import('../api.js').then(api => api.saveAttribute(ed, fm.name.trim(), fm.groupable, finalVals, null)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã lưu thuộc tính " + fm.name.trim()), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
      // Migrate giá/kho/lịch sử cho các giá trị đã đổi tên
      if (Object.keys(renames).length > 0 && onRenameAttrVal) {
        onRenameAttrVal(ed, renames);
      }
    }
    setRenames({});
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
            {(() => {
              const isSupAttr = ed === "supplier";
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)" }}>Giá trị ({fm.values.length})</label>
                    {isSupAttr
                      ? <span style={{ fontSize: "0.65rem", padding: "1px 7px", borderRadius: 3, background: "rgba(50,79,39,0.08)", border: "1px solid rgba(50,79,39,0.2)", color: "var(--gn)", fontWeight: 600 }}>🔗 Đồng bộ từ NCC (cấu hình = Có) · Chỉ đổi vị trí</span>
                      : fm.groupable
                        ? <span style={{ fontSize: "0.65rem", padding: "1px 7px", borderRadius: 3, background: "var(--gbg)", color: "var(--gtx)", fontWeight: 600 }}>Tự động sắp xếp tăng dần · Nhập số, tự thêm hậu tố F</span>
                        : <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>Bấm vào giá trị để chọn, dùng &lt; &gt; đổi vị trí</span>
                    }
                  </div>

                  {/* Chips hiển thị theo chiều ngang */}
                  <div onClick={e => { if (e.target === e.currentTarget) setSelValIdx(null); }}
                    style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px", borderRadius: 6, border: "1.5px solid var(--bds)", background: "var(--bgs)", minHeight: 42, marginBottom: 8, cursor: "default" }}>
                    {fm.values.map((v, vi) => {
                      const isRenamed = Object.values(renames).includes(v);
                      const isSel = selValIdx === vi;
                      return (
                        <span key={vi} onClick={() => selectChip(vi)}
                          style={{ padding: "5px 11px", borderRadius: 5, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", userSelect: "none", transition: "all 0.12s",
                            background: isSel ? "var(--ac)" : isRenamed ? "rgba(242,101,34,0.08)" : "var(--bgc)",
                            border: "1.5px solid " + (isSel ? "var(--ac)" : isRenamed ? "var(--ac)" : "var(--bds)"),
                            color: isSel ? "#fff" : isRenamed ? "var(--ac)" : "var(--tp)"
                          }}>
                          {v}{isRenamed && !isSel ? " *" : ""}
                        </span>
                      );
                    })}
                    {!fm.values.length && <span style={{ fontSize: "0.72rem", color: "var(--tm)", fontStyle: "italic", alignSelf: "center" }}>{isSupAttr ? "Chưa có NCC nào có cấu hình = Có" : "Chưa có giá trị nào"}</span>}
                  </div>
                  {/* Tóm tắt rename chờ lưu */}
                  {Object.keys(renames).length > 0 && (
                    <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 5, background: "rgba(242,101,34,0.07)", border: "1px solid var(--ac)", fontSize: "0.65rem", color: "var(--ac)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <strong>Đổi tên khi lưu:</strong>
                      {Object.entries(renames).map(([o, n]) => <span key={o} style={{ fontFamily: "monospace" }}>"{o}" → "{n}"</span>)}
                      <span style={{ color: "var(--tm)", fontStyle: "italic" }}>· sẽ migrate giá, kho, lịch sử</span>
                    </div>
                  )}

                  {/* Thanh điều khiển khi đã chọn chip */}
                  {selValIdx !== null && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: "var(--acbg)", border: "1px solid var(--ac)" }}>
                      {!fm.groupable && (
                        <button onClick={() => moveValChip(-1)} disabled={selValIdx === 0}
                          style={{ width: 30, height: 30, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selValIdx === 0 ? "transparent" : "var(--bgc)", color: selValIdx === 0 ? "var(--tm)" : "var(--ts)", cursor: selValIdx === 0 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>
                          ‹
                        </button>
                      )}
                      {isSupAttr
                        ? <div style={{ flex: 1, padding: "5px 9px", fontSize: "0.82rem", fontWeight: 700, color: "var(--br)" }}>{fm.values[selValIdx]}</div>
                        : (
                          <div style={{ flex: 1, minWidth: 60 }}>
                            <input value={editValText} onChange={e => { setEditValText(e.target.value); setEditValErr(""); }}
                              onBlur={() => { if (editValErr.startsWith("⚠️")) setEditValErr(""); else commitEditVal(); }}
                              onKeyDown={e => { if (e.key === "Enter") commitEditVal(); if (e.key === "Escape") { setEditValText(fm.values[selValIdx]); setEditValErr(""); } }}
                              style={{ width: "100%", padding: "5px 9px", borderRadius: 5, border: "1.5px solid " + (editValErr.startsWith("⚠️") ? "var(--ac)" : editValErr ? "var(--dg)" : "var(--ac)"), fontSize: "0.8rem", outline: "none", background: "#fff", boxSizing: "border-box" }} />
                            {editValErr && <div style={{ fontSize: "0.62rem", color: editValErr.startsWith("⚠️") ? "var(--ac)" : "var(--dg)", marginTop: 2 }}>{editValErr}</div>}
                          </div>
                        )
                      }
                      {!fm.groupable && (
                        <button onClick={() => moveValChip(1)} disabled={selValIdx === fm.values.length - 1}
                          style={{ width: 30, height: 30, padding: 0, border: "1.5px solid var(--bd)", borderRadius: 5, background: selValIdx === fm.values.length - 1 ? "transparent" : "var(--bgc)", color: selValIdx === fm.values.length - 1 ? "var(--tm)" : "var(--ts)", cursor: selValIdx === fm.values.length - 1 ? "default" : "pointer", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>
                          ›
                        </button>
                      )}
                      {!isSupAttr && (
                        <button onClick={deleteSelectedVal}
                          style={{ padding: "5px 11px", borderRadius: 5, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem", flexShrink: 0 }}>
                          Xóa
                        </button>
                      )}
                    </div>
                  )}

                  {!isSupAttr && (
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
                  )}
                </>
              );
            })()}
          </div>

          {/* Nhóm theo khoảng đo lường đã chuyển sang cấu hình per-wood trong màn hình Cấu hình loại gỗ */}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); setNewValErr(""); setEditValErr(""); }} style={{ padding: "7px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={save} disabled={!fm.name.trim() || (!fm.values.length && ed !== "supplier")}
              style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: (fm.name.trim() && (fm.values.length || ed === "supplier")) ? "var(--ac)" : "var(--bd)", color: (fm.name.trim() && (fm.values.length || ed === "supplier")) ? "#fff" : "var(--tm)", cursor: (fm.name.trim() && (fm.values.length || ed === "supplier")) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.78rem" }}>
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
                    {(() => {
                      let displayVals = at.values;
                      let newUnsaved = [];
                      if (at.id === "supplier") {
                        const configNames = suppliers.filter(s => s.configurable).map(s => s.name);
                        newUnsaved = configNames.filter(n => !at.values.includes(n));
                        displayVals = [...at.values, ...newUnsaved];
                      }
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {displayVals.map(v => (
                            <span key={v} style={{ padding: "2px 6px", borderRadius: 3, background: newUnsaved.includes(v) ? "rgba(50,79,39,0.07)" : "var(--bgs)", border: "1px solid " + (newUnsaved.includes(v) ? "rgba(50,79,39,0.3)" : "var(--bds)"), fontSize: "0.7rem", color: newUnsaved.includes(v) ? "var(--gn)" : undefined }}>
                              {v}{newUnsaved.includes(v) ? " *" : ""}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  {ce && (
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {at.id === "supplier" && (() => {
                          const newOnes = suppliers.filter(s => s.configurable && !at.values.includes(s.name)).map(s => s.name);
                          if (!newOnes.length) return null;
                          return (
                            <button onClick={() => {
                              const merged = [...at.values, ...newOnes];
                              setAts(p => p.map(a => a.id === "supplier" ? { ...a, values: merged } : a));
                              if (useAPI) import('../api.js').then(api => api.saveAttribute("supplier", at.name, at.groupable, merged, at.rangeGroups || null)
                                .then(r => notify(r?.error ? ("Lỗi: " + r.error) : `Đã đồng bộ ${newOnes.length} NCC mới`, !r?.error))
                                .catch(e => notify("Lỗi kết nối: " + e.message, false)));
                            }} style={{ padding: "3px 8px", borderRadius: 4, background: "rgba(50,79,39,0.08)", color: "var(--gn)", border: "1px solid rgba(50,79,39,0.3)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem", whiteSpace: "nowrap" }}>
                              ↻ Đồng bộ ({newOnes.length})
                            </button>
                          );
                        })()}
                        <button onClick={() => openEdit(at)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                        <button onClick={() => { if (used) return; setAts(p => p.filter(a => a.id !== at.id)); if (useAPI) import('../api.js').then(api => api.deleteAttribute(at.id).then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã xóa " + at.name), !r?.error)).catch(e => notify("Lỗi kết nối: " + e.message, false))); }} disabled={used} title={used ? "Đang được dùng trong cấu hình" : "Xóa"}
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
