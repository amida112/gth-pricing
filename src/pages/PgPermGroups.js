import React, { useState } from "react";
import { USERS } from "../auth";
import Dialog from "../components/Dialog";
import { audit } from "../utils/auditHelper";

const DEFAULT_ICONS = ['🔐', '🔑', '🛒', '🏪', '📊', '👤', '🛡️', '📋', '⚙️', '🏭', '📦', '🔥'];
const DEFAULT_COLORS = ['#327F27', '#7C5CBF', '#F26522', '#2980B9', '#E74C3C', '#16A085', '#8E44AD', '#D35400', '#2C3E50', '#C0392B'];

export default function PgPermGroups({ permGroups, setPermGroups, dynamicUsers, useAPI, notify }) {
  const [ed, setEd] = useState(null); // null | 'new' | groupId
  const [fm, setFm] = useState({ code: '', name: '', description: '', icon: '🔐', color: '#666' });
  const [fmErr, setFmErr] = useState({});
  const [delConfirm, setDelConfirm] = useState(null);

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };
  const lblS = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };
  const inpS = (hasErr) => ({ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (hasErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" });
  const errS = { fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 };

  const getUserCount = (groupId, groupCode) => {
    // Đếm dynamic users gán nhóm quyền trực tiếp
    const dynamicCount = (dynamicUsers || []).filter(u => u.permissionGroupId === groupId).length;
    // Đếm dynamic users chưa gán nhóm quyền nhưng role khớp code
    const dynamicByRole = (dynamicUsers || []).filter(u => !u.permissionGroupId && u.role === groupCode).length;
    // Đếm hardcode users có role khớp code
    const hardcodeCount = Object.values(USERS).filter(u => u.role === groupCode).length;
    return dynamicCount + dynamicByRole + hardcodeCount;
  };

  const openNew = () => {
    setFm({ code: '', name: '', description: '', icon: '🔐', color: '#666' });
    setFmErr({}); setEd('new');
  };

  const openEdit = (g) => {
    setFm({ code: g.code, name: g.name, description: g.description || '', icon: g.icon || '🔐', color: g.color || '#666' });
    setFmErr({}); setEd(g.id);
  };

  const validate = (isNew) => {
    const errs = {};
    const code = fm.code.trim();
    if (!code) errs.code = "Không được để trống";
    else if (/\s/.test(code)) errs.code = "Không được chứa dấu cách";
    else if (!/^[a-z0-9_]+$/.test(code)) errs.code = "Chỉ gồm chữ thường, số, gạch dưới";
    else {
      const dup = permGroups.find(g => g.code === code && (isNew || g.id !== ed));
      if (dup) errs.code = "Mã nhóm đã tồn tại";
    }
    if (!fm.name.trim()) errs.name = "Tên nhóm không được để trống";
    return errs;
  };

  const sv = async () => {
    const isNew = ed === 'new';
    const errs = validate(isNew);
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});

    if (isNew) {
      const tmp = { id: 'tmp_' + Date.now(), code: fm.code.trim(), name: fm.name.trim(), description: fm.description.trim(), icon: fm.icon, color: fm.color, isSystem: false, active: true };
      setPermGroups(p => [...p, tmp]);
      if (useAPI) {
        import('../api.js').then(api => api.addPermissionGroup(fm.code.trim(), fm.name.trim(), fm.description.trim(), fm.icon, fm.color)
          .then(r => {
            if (r?.error) { notify("Lỗi: " + r.error, false); setPermGroups(p => p.filter(g => g.id !== tmp.id)); }
            else { api.fetchPermissionGroups().then(gs => setPermGroups(gs)).catch(() => {}); notify("Đã thêm nhóm quyền"); audit('system', 'permissions', 'create', `Tạo nhóm quyền "${fm.name.trim()}" (${fm.code.trim()})`, { entityType: 'permission_group' }); }
          }).catch(e => notify("Lỗi: " + e.message, false)));
      }
    } else {
      setPermGroups(p => p.map(g => g.id === ed ? { ...g, code: fm.code.trim(), name: fm.name.trim(), description: fm.description.trim(), icon: fm.icon, color: fm.color } : g));
      if (useAPI) {
        import('../api.js').then(api => api.updatePermissionGroup(ed, { code: fm.code.trim(), name: fm.name.trim(), description: fm.description.trim(), icon: fm.icon, color: fm.color })
          .then(r => { notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error); if (!r?.error) audit('system', 'permissions', 'update', `Cập nhật nhóm quyền "${fm.name.trim()}"`, { entityType: 'permission_group', entityId: ed }); })
          .catch(e => notify("Lỗi: " + e.message, false)));
      }
    }
    setEd(null);
  };

  const del = (g) => {
    if (g.isSystem) { notify("Không thể xóa nhóm hệ thống", false); return; }
    const count = getUserCount(g.id, g.code);
    if (count > 0) { notify(`Không thể xóa — có ${count} user đang dùng nhóm này`, false); return; }
    if (delConfirm !== g.id) { setDelConfirm(g.id); return; }
    setDelConfirm(null);
    setPermGroups(p => p.filter(x => x.id !== g.id));
    if (useAPI) {
      import('../api.js').then(api => api.deletePermissionGroup(g.id)
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify("Đã xóa nhóm " + g.name); })
        .catch(e => notify("Lỗi: " + e.message, false)));
    }
  };

  const toggleActive = (g) => {
    if (g.isSystem) return;
    const newActive = !g.active;
    setPermGroups(p => p.map(x => x.id === g.id ? { ...x, active: newActive } : x));
    if (useAPI) {
      import('../api.js').then(api => api.updatePermissionGroup(g.id, { active: newActive })
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
        .catch(e => notify("Lỗi: " + e.message, false)));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Nhóm quyền</h2>
        <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm nhóm</button>
      </div>

      {/* Form thêm/sửa */}
      {ed != null && (
        <Dialog open={true} onClose={() => { setEd(null); setFmErr({}); }} onOk={sv} title={ed === 'new' ? 'Thêm nhóm quyền' : 'Sửa nhóm quyền'} width={500}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Mã nhóm</label>
                <input value={fm.code} onChange={e => { setFm(p => ({ ...p, code: e.target.value })); setFmErr(p => ({ ...p, code: '' })); }}
                  placeholder="VD: quanly" style={inpS(fmErr.code)} disabled={ed !== 'new' && permGroups.find(g => g.id === ed)?.isSystem} />
                {fmErr.code && <div style={errS}>{fmErr.code}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Tên nhóm</label>
                <input value={fm.name} onChange={e => { setFm(p => ({ ...p, name: e.target.value })); setFmErr(p => ({ ...p, name: '' })); }}
                  placeholder="VD: Quản lý" style={inpS(fmErr.name)} />
                {fmErr.name && <div style={errS}>{fmErr.name}</div>}
              </div>
            </div>

            <div>
              <label style={lblS}>Mô tả</label>
              <input value={fm.description} onChange={e => setFm(p => ({ ...p, description: e.target.value }))}
                placeholder="Mô tả ngắn về nhóm quyền" style={inpS(false)} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Icon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {DEFAULT_ICONS.map(ic => (
                    <button key={ic} onClick={() => setFm(p => ({ ...p, icon: ic }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: fm.icon === ic ? "2px solid var(--ac)" : "1px solid var(--bd)", background: fm.icon === ic ? "rgba(242,101,34,0.1)" : "#fff", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Màu sắc</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => setFm(p => ({ ...p, color: c }))}
                      style={{ width: 32, height: 32, borderRadius: 6, border: fm.color === c ? "2px solid var(--ac)" : "1px solid var(--bd)", background: c, cursor: "pointer" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Bảng danh sách */}
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, width: 40, textAlign: "center" }}>STT</th>
              <th style={{ ...ths, width: 50, textAlign: "center" }}>Icon</th>
              <th style={{ ...ths, width: 120 }}>Mã nhóm</th>
              <th style={ths}>Tên nhóm</th>
              <th style={ths}>Mô tả</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Số user</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Loại</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Trạng thái</th>
              <th style={{ ...ths, width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {permGroups.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Chưa có nhóm quyền nào</td></tr>
            )}
            {permGroups.map((g, i) => (
              <tr key={g.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff", opacity: g.active === false ? 0.5 : 1 }} data-clickable="true">
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>{i + 1}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontSize: "1.1rem" }}>{g.icon}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontFamily: "monospace", fontWeight: 700, color: g.color || "var(--br)" }}>{g.code}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>{g.name}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.74rem" }}>{g.description || '—'}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontWeight: 700 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 10, background: "rgba(52,152,219,0.1)", color: "#2980B9", fontSize: "0.72rem" }}>{getUserCount(g.id, g.code)}</span>
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontSize: "0.68rem" }}>
                  {g.isSystem
                    ? <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(231,76,60,0.1)", color: "#E74C3C", fontWeight: 600 }}>Hệ thống</span>
                    : <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(52,152,219,0.1)", color: "#2980B9", fontWeight: 600 }}>Tùy chỉnh</span>}
                </td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                  {g.active !== false
                    ? <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(50,79,39,0.1)", color: "var(--gn)", fontWeight: 700, fontSize: "0.68rem" }}>Hoạt động</span>
                    : <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(192,57,43,0.1)", color: "var(--dg)", fontWeight: 700, fontSize: "0.68rem" }}>Vô hiệu</span>}
                </td>
                <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(g)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>Sửa</button>
                    {!g.isSystem && (
                      <>
                        <button onClick={() => toggleActive(g)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: g.active !== false ? "var(--tm)" : "var(--gn)", border: "1px solid " + (g.active !== false ? "var(--bd)" : "var(--gn)"), cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {g.active !== false ? "Khóa" : "Mở"}
                        </button>
                        <button onClick={() => del(g)} style={{ padding: "3px 7px", borderRadius: 4, background: delConfirm === g.id ? "var(--dg)" : "transparent", color: delConfirm === g.id ? "#fff" : "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {delConfirm === g.id ? "Chắc chắn?" : "Xóa"}
                        </button>
                      </>
                    )}
                    {g.isSystem && <span style={{ fontSize: "0.65rem", color: "var(--tm)", fontStyle: "italic" }}>Mặc định</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
