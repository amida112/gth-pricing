import React, { useState } from "react";

export const CONTAINER_STATUSES = ["Tạo mới", "Đang vận chuyển", "Đã về", "Đã nhập kho"];

export default function PgNCC({ suppliers, setSuppliers, ce, addOnly, useAPI, notify, bundles = [] }) {
  const [ed, setEd] = useState(null);
  const [fm, setFm] = useState({ nccId: "", name: "", code: "", description: "", configurable: false });
  const [fmErr, setFmErr] = useState({});
  const [origConfigurable, setOrigConfigurable] = useState(false); // V-16

  const openNew = () => { setFm({ nccId: "", name: "", code: "", description: "", configurable: false }); setFmErr({}); setEd("new"); };
  const openEdit = (s) => {
    setOrigConfigurable(s.configurable ?? false); // V-16
    setFm({ nccId: s.nccId, name: s.name, code: s.code || "", description: s.description || "", configurable: s.configurable ?? false });
    setFmErr({}); setEd(s.id);
  };

  const validate = () => {
    const errs = {};
    if (!fm.nccId.trim()) errs.nccId = "Không được để trống";
    if (!fm.name.trim()) errs.name = "Không được để trống";
    const dup = suppliers.find(s => s.id !== ed && s.nccId.toLowerCase() === fm.nccId.trim().toLowerCase());
    if (dup) errs.nccId = "Mã NCC này đã tồn tại";
    return errs;
  };

  const sv = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    if (ed === "new") {
      const tmp = { id: "tmp_" + Date.now(), nccId: fm.nccId.trim(), name: fm.name.trim(), code: fm.code.trim(), description: fm.description.trim(), configurable: fm.configurable };
      setSuppliers(p => [...p, tmp]);
      if (useAPI) import('../api.js').then(api => api.addSupplier(fm.nccId.trim(), fm.name.trim(), fm.code.trim(), fm.description.trim(), fm.configurable)
        .then(r => {
          if (r?.error) { notify("Lỗi: " + r.error, false); setSuppliers(p => p.filter(s => s.id !== tmp.id)); }
          else { setSuppliers(p => p.map(s => s.id === tmp.id ? { ...s, id: r.id ?? s.id } : s)); notify("Đã thêm " + fm.name.trim()); }
        }).catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      // V-16: cảnh báo khi tắt configurable mà đang có bundle dùng nhà cung cấp này
      const supName = suppliers.find(s => s.id === ed)?.name;
      if (origConfigurable && !fm.configurable && supName) {
        const bundleCount = bundles.filter(b => b.attributes?.supplier === supName).length;
        if (bundleCount > 0) {
          notify(`⚠ Đã tắt "Hiển thị trong thuộc tính" của "${supName}" — có ${bundleCount} gỗ kiện trong kho đang gắn với NCC này.`, true);
        }
      }
      setSuppliers(p => p.map(s => s.id === ed ? { ...s, nccId: fm.nccId.trim(), name: fm.name.trim(), code: fm.code.trim(), description: fm.description.trim(), configurable: fm.configurable } : s));
      if (useAPI) import('../api.js').then(api => api.updateSupplier(ed, fm.nccId.trim(), fm.name.trim(), fm.code.trim(), fm.description.trim(), fm.configurable)
        .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error))
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
    setEd(null);
  };

  const del = (s) => {
    // V-15: chặn xóa nếu có bundle dùng NCC này
    const bundleCount = bundles.filter(b => b.attributes?.supplier === s.name || b.supplierId === s.id || b.supplier_id === s.id).length;
    if (bundleCount > 0) {
      notify(`Không thể xóa "${s.name}" — đang có ${bundleCount} gỗ kiện trong kho tham chiếu nhà cung cấp này.`, false);
      return;
    }
    // V-15: nếu useAPI, thử xóa và bắt lỗi FK từ Supabase
    if (useAPI) {
      import('../api.js').then(api => api.deleteSupplier(s.id)
        .then(r => {
          if (r?.error) {
            if (r.error.includes('foreign key') || r.error.includes('violates')) notify(`Không thể xóa "${s.name}" — đang có container hoặc gỗ kiện tham chiếu.`, false);
            else notify("Lỗi: " + r.error, false);
          } else {
            setSuppliers(p => p.filter(x => x.id !== s.id));
            notify("Đã xóa " + s.name);
          }
        })
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    } else {
      setSuppliers(p => p.filter(x => x.id !== s.id));
      notify("Đã xóa " + s.name);
    }
  };

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏭 Nhà cung cấp</h2>
        {ce && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm</button>}
      </div>

      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mã NCC</label>
              <input value={fm.nccId} onChange={e => { setFm(p => ({ ...p, nccId: e.target.value })); setFmErr(p => ({ ...p, nccId: "" })); }} placeholder="VD: NCC001"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.nccId ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.nccId && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.nccId}</div>}
            </div>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Tên nhà cung cấp</label>
              <input value={fm.name} onChange={e => { setFm(p => ({ ...p, name: e.target.value })); setFmErr(p => ({ ...p, name: "" })); }} placeholder="VD: Công ty ABC"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (fmErr.name ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
              {fmErr.name && <div style={{ fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 }}>{fmErr.name}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mã (tùy chọn)</label>
              <input value={fm.code} onChange={e => setFm(p => ({ ...p, code: e.target.value }))} placeholder="Mã nội bộ"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 }}>Mô tả</label>
              <input value={fm.description} onChange={e => setFm(p => ({ ...p, description: e.target.value }))} placeholder="Mô tả ngắn (tùy chọn)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 12px", borderRadius: 6, border: "1.5px solid " + (fm.configurable ? "var(--gn)" : "var(--bd)"), background: fm.configurable ? "rgba(50,79,39,0.08)" : "transparent", fontSize: "0.78rem", fontWeight: 600, color: fm.configurable ? "var(--gn)" : "var(--ts)" }}>
                <input type="checkbox" checked={fm.configurable} onChange={e => setFm(p => ({ ...p, configurable: e.target.checked }))} style={{ accentColor: "var(--gn)" }} />
                Hiển thị trong thuộc tính
              </label>
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
              <th style={{ ...ths, whiteSpace: "nowrap" }}>Mã NCC</th>
              <th style={ths}>Tên nhà cung cấp</th>
              <th style={ths}>Mã</th>
              <th style={ths}>Mô tả</th>
              <th style={{ ...ths, width: 90, textAlign: "center" }}>Cấu hình</th>
              {ce && !addOnly && <th style={{ ...ths, width: 100 }}></th>}
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr><td colSpan={ce && !addOnly ? 7 : 6} style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.8rem" }}>Chưa có nhà cung cấp nào</td></tr>
            )}
            {suppliers.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>{i + 1}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontFamily: "monospace", color: "var(--br)" }}>{s.nccId}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.75rem" }}>{s.code || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.75rem" }}>{s.description || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                  {s.configurable
                    ? <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(50,79,39,0.1)", color: "var(--gn)", fontWeight: 700, fontSize: "0.7rem" }}>✓ Có</span>
                    : <span style={{ color: "var(--tm)", fontSize: "0.7rem" }}>—</span>}
                </td>
                {ce && !addOnly && (
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => openEdit(s)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Sửa</button>
                      <button onClick={() => del(s)} style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.68rem" }}>Xóa</button>
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
