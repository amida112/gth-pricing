import React, { useState } from "react";
import { ConfirmDlg } from "../components/Matrix";

function PgWT({ wts, setWts, cfg, ce, useAPI, notify, bundles = [] }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ name: "", nameEn: "", icon: "🌳", code: "", desc: "", unit: "m3", thicknessMode: "fixed" });
  const [fmErr, setFmErr] = useState({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(null); // { wood }
  const [origCode, setOrigCode] = useState(""); // V-08: lưu code gốc khi mở edit

  const hasConfig = (id) => (cfg[id]?.attrs || []).length > 0;
  // V-07: kiểm tra loại gỗ có bundle nào không
  const hasBundles = (id) => bundles.some(b => b.woodId === id || b.wood_id === id);

  const openEditWood = (w) => {
    const newFm = { name: w.name, nameEn: w.nameEn, icon: w.icon, code: w.code || "", desc: w.desc || "", thicknessMode: w.thicknessMode || "fixed" };
    setOrigCode(w.code || ""); // V-08: lưu code gốc
    if (hasConfig(w.id)) {
      setConfirmEdit(w);
    } else {
      setFm(newFm);
      setFmErr({});
      setEd(w.id);
    }
  };

  const deleteWood = (w) => {
    // V-07: chặn xóa nếu có bundle tham chiếu
    if (hasBundles(w.id)) {
      notify(`Không thể xóa "${w.name}" — loại gỗ này đang có gỗ kiện trong kho. Cần xóa hết kiện trước.`, false);
      return;
    }
    setWts(p => p.filter(x => x.id !== w.id));
    if (useAPI) import('../api.js').then(api => api.deleteWoodType(w.id)
      .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã xóa " + w.name), !r?.error))
      .catch(e => notify("Lỗi kết nối: " + e.message, false)));
  };

  const genId = (nameEn) => (nameEn || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const previewId = genId(fm.nameEn);

  const validate = () => {
    const errs = {};
    if (!fm.name.trim()) { errs.name = "Không được để trống"; }
    if (!fm.nameEn.trim()) { errs.nameEn = "Không được để trống"; }
    if (ed === "new") {
      const id = previewId || ("wood_" + Date.now());
      if (!previewId) errs.nameEn = "Tên EN cần có ký tự latin để tạo ID";
      const dupId = wts.find(w => w.id === id);
      if (dupId) errs.nameEn = `ID "${id}" đã tồn tại (${dupId.name})`;
      const dupName = wts.find(w => w.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên này đã tồn tại";
    } else {
      const dupName = wts.find(w => w.id !== ed && w.name.trim().toLowerCase() === fm.name.trim().toLowerCase());
      if (dupName) errs.name = "Tên này đã tồn tại";
    }
    return errs;
  };

  const sv = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    if (ed === "new") {
      const id = previewId || ("wood_" + Date.now());
      setWts(p => [...p, { id, ...fm }]);
      if (useAPI) import('../api.js').then(api => api.addWoodType(id, fm.name, fm.nameEn, fm.icon, fm.code, fm.unit, fm.thicknessMode)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã thêm " + fm.name), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      // V-08: cảnh báo khi đổi mã nếu đang có bundle
      if (fm.code !== origCode && hasBundles(ed)) {
        notify(`⚠ Mã loại gỗ đã đổi từ "${origCode || '(trống)'}" → "${fm.code}". Các gỗ kiện hiện có trong kho không bị ảnh hưởng, nhưng cần kiểm tra lại báo cáo SKU.`, true);
      }
      // Cảnh báo khi đổi thicknessMode trên loại gỗ đã có bundle
      const oldMode = wts.find(w => w.id === ed)?.thicknessMode || 'fixed';
      if (fm.thicknessMode !== oldMode && hasBundles(ed)) {
        const chipCount = (cfg[ed]?.attrValues?.thickness || []).length;
        if (fm.thicknessMode === 'auto') {
          if (!window.confirm(`Chuyển sang "Chip tự sinh"?\n\nLoại gỗ này có ${bundles.filter(b => b.woodId === ed || b.wood_id === ed).length} kiện trong kho. Chuyển sang chip tự sinh sẽ cho phép nhập dày bất kỳ.\n\n${chipCount} chips hiện có vẫn giữ nguyên.`)) return;
        } else {
          if (!window.confirm(`Chuyển sang "Chip cố định"?\n\nLoại gỗ này đang có ${chipCount} chip tự sinh. Chuyển sang chip cố định sẽ khóa danh sách — chỉ được nhập giá trị trong danh sách.\n\nHãy dọn bớt chip không cần trong Cấu hình sau khi chuyển.`)) return;
        }
      }
      setWts(p => p.map(w => w.id === ed ? { ...w, ...fm } : w));
      if (useAPI) import('../api.js').then(api => api.apiUpdateWoodType(ed, fm.name, fm.nameEn, fm.icon, fm.code, fm.thicknessMode)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : ("Đã cập nhật " + fm.name), !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setEd(null);
  };

  const moveWood = (idx, dir) => {
    const sw = idx + dir;
    if (sw < 0 || sw >= wts.length) return;
    setWts(p => {
      const arr = [...p];
      [arr[idx], arr[sw]] = [arr[sw], arr[idx]];
      return arr;
    });
    setOrderDirty(true);
  };

  const saveOrder = () => {
    if (useAPI) {
      import('../api.js').then(api => api.updateWoodOrder(wts.map(w => w.id))
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã lưu thứ tự loại gỗ", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      notify("Đã lưu thứ tự (offline)");
    }
    setOrderDirty(false);
  };

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };

  return (
    <div>
      {confirmEdit && (
        <ConfirmDlg
          title="Xác nhận chỉnh sửa"
          message={`"${confirmEdit.name}" đang được cấu hình với ${(cfg[confirmEdit.id]?.attrs || []).length} thuộc tính. Bạn vẫn muốn chỉnh sửa thông tin loại gỗ này?`}
          warn="Lưu ý: chỉnh sửa tên không ảnh hưởng đến cấu hình và giá hiện có."
          onOk={() => { setFm({ name: confirmEdit.name, nameEn: confirmEdit.nameEn, icon: confirmEdit.icon, code: confirmEdit.code || "", desc: confirmEdit.desc || "", thicknessMode: confirmEdit.thicknessMode || "fixed" }); setFmErr({}); setEd(confirmEdit.id); setConfirmEdit(null); }}
          onNo={() => setConfirmEdit(null)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🌳 Loại gỗ</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {ce && orderDirty && (
            <button onClick={saveOrder} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--gn)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
              Lưu thứ tự
            </button>
          )}
          {ce && <button onClick={() => { setFm({ name: "", nameEn: "", icon: "🌳", desc: "" }); setFmErr({}); setEd("new"); }} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
        </div>
      </div>
      {ce && orderDirty && (
        <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 7, background: "rgba(50,79,39,0.08)", border: "1px solid var(--gn)", fontSize: "0.75rem", color: "var(--gn)", fontWeight: 600 }}>
          Thứ tự đã thay đổi — bấm <b>Lưu thứ tự</b> để cập nhật vào CSDL
        </div>
      )}

      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Icon</label>
              <input value={fm.icon} onChange={e => setFm({ ...fm, icon: e.target.value })} style={{ width: 60, padding: "8px", borderRadius: 6, border: "1.5px solid var(--bd)", textAlign: "center", fontSize: "1.2rem", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên tiếng Việt</label>
              <input value={fm.name} onChange={e => { setFm({ ...fm, name: e.target.value }); setFmErr(p => ({ ...p, name: "" })); }} placeholder="vd: Óc Chó"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.name ? "var(--dg)" : "var(--bd)"), fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.name && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.name}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên tiếng Anh</label>
              <input value={fm.nameEn} onChange={e => { setFm({ ...fm, nameEn: e.target.value }); setFmErr(p => ({ ...p, nameEn: "" })); }} placeholder="vd: Walnut"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.nameEn ? "var(--dg)" : "var(--bd)"), fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
              {ed === "new" && previewId && !fmErr.nameEn && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 3 }}>ID: <code>{previewId}</code></div>}
              {fmErr.nameEn && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.nameEn}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mã loại gỗ</label>
              <input value={fm.code || ""} onChange={e => setFm({ ...fm, code: e.target.value })} placeholder="vd: OC, SO, ASH (tùy chọn)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            {ed === "new" && (
              <div style={{ minWidth: 140 }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Đơn vị tính</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["m3", "m2"].map(u => (
                    <button key={u} type="button" onClick={() => setFm({ ...fm, unit: u })}
                      style={{ flex: 1, padding: "8px 6px", borderRadius: 6, border: fm.unit === u ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: fm.unit === u ? "var(--acbg)" : "var(--bgc)", color: fm.unit === u ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontWeight: fm.unit === u ? 700 : 500, fontSize: "0.82rem" }}>
                      {u === "m3" ? "m³" : "m²"}
                    </button>
                  ))}
                </div>
                {fm.unit === "m2" && <div style={{ fontSize: "0.63rem", color: "var(--ac)", marginTop: 3, fontWeight: 600 }}>Giá lưu 2 mức: lẻ / nguyên kiện</div>}
              </div>
            )}
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mô tả</label>
              <input value={fm.desc || ""} onChange={e => setFm({ ...fm, desc: e.target.value })} placeholder="Mô tả ngắn về loại gỗ (tùy chọn)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ minWidth: 200 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Độ dày</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { val: "auto", label: "Chip tự sinh", hint: "Gỗ xẻ sấy — nhập dày bất kỳ" },
                  { val: "fixed", label: "Chip cố định", hint: "Gỗ nhập khẩu — admin tạo chip" },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setFm({ ...fm, thicknessMode: opt.val })}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: fm.thicknessMode === opt.val ? "2px solid var(--gtx)" : "1.5px solid var(--bd)", background: fm.thicknessMode === opt.val ? "var(--gbg)" : "var(--bgc)", color: fm.thicknessMode === opt.val ? "var(--gtx)" : "var(--ts)", cursor: "pointer", fontWeight: fm.thicknessMode === opt.val ? 700 : 500, fontSize: "0.78rem" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--tm)", marginTop: 3 }}>
                {fm.thicknessMode === "auto" ? "Nhập kho tự tạo chip — gộp dày theo giá" : "Admin quản lý danh sách chip cố định"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); }} style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={sv} style={{ padding: "7px 20px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </div>
      )}

      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, width: 40, textAlign: "center" }}>STT</th>
              <th style={{ ...ths, width: 48 }}>Icon</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Mã</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Tên</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Tên EN</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Đơn vị</th>
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Độ dày</th>
              <th style={ths}>Mô tả</th>
              {ce && <th style={{ ...ths, width: 110 }}></th>}
            </tr>
          </thead>
          <tbody>
            {wts.map((w, i) => (
              <tr key={w.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>
                  {i + 1}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontSize: "1.1rem" }}>{w.icon}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontFamily: "monospace", fontSize: "0.82rem", color: "var(--br)", whiteSpace: "nowrap" }}>
                  {w.code || <span style={{ color: "var(--tm)", fontStyle: "italic", fontFamily: "inherit", fontWeight: 400 }}>—</span>}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {w.name}
                  <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 400, fontFamily: "monospace" }}>{w.id}</div>
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", whiteSpace: "nowrap" }}>{w.nameEn}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {w.unit === 'm2'
                    ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ac)", background: "var(--acbg)", padding: "2px 7px", borderRadius: 4 }}>m²</span>
                    : <span style={{ fontSize: "0.7rem", color: "var(--tm)" }}>m³</span>}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {w.thicknessMode === 'auto'
                    ? <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gtx)", background: "var(--gbg)", padding: "2px 7px", borderRadius: 4, border: "1px solid var(--gbd)" }}>Tự sinh</span>
                    : <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>Cố định</span>}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.75rem" }}>{w.desc || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                {ce && (
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button onClick={() => moveWood(i, -1)} disabled={i === 0} title="Lên"
                        style={{ width: 24, height: 24, padding: 0, border: "1px solid var(--bd)", borderRadius: 4, background: i === 0 ? "transparent" : "var(--bgc)", color: i === 0 ? "var(--tm)" : "var(--ts)", cursor: i === 0 ? "default" : "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                      <button onClick={() => moveWood(i, 1)} disabled={i === wts.length - 1} title="Xuống"
                        style={{ width: 24, height: 24, padding: 0, border: "1px solid var(--bd)", borderRadius: 4, background: i === wts.length - 1 ? "transparent" : "var(--bgc)", color: i === wts.length - 1 ? "var(--tm)" : "var(--ts)", cursor: i === wts.length - 1 ? "default" : "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                      <button onClick={() => openEditWood(w)}
                        style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>
                        Sửa{hasConfig(w.id) ? " ⚠" : ""}
                      </button>
                      {(() => {
                        const blocked = hasConfig(w.id) || hasBundles(w.id);
                        const title = hasConfig(w.id) ? "Đang có cấu hình thuộc tính — không thể xóa" : hasBundles(w.id) ? "Đang có gỗ kiện trong kho — không thể xóa" : "Xóa";
                        return (
                          <button onClick={() => deleteWood(w)} disabled={blocked} title={title}
                            style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: blocked ? "var(--tm)" : "var(--dg)", border: "1px solid " + (blocked ? "var(--bd)" : "var(--dg)"), cursor: blocked ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.68rem", opacity: blocked ? 0.4 : 1 }}>Xóa</button>
                        );
                      })()}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(PgWT);
