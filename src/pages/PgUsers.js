import React, { useState } from "react";
import { USERS, ASSIGNABLE_ROLES, ROLE_LABELS, PERM_DEFS, ALL_PAGES, DEFAULT_ROLE_PERMS, getPerms, hashPassword } from "../auth";

export default function PgUsers({ dynamicUsers, setDynamicUsers, rolePermsConfig, setRolePermsConfig, useAPI, notify, currentUser }) {
  const [ed, setEd] = useState(null); // null | "new" | userId
  const [fm, setFm] = useState({ username: "", password: "", role: "banhang", label: "" });
  const [fmErr, setFmErr] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [permsDirty, setPermsDirty] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // --- Helpers phân quyền ---
  // Working copy: nếu chưa có custom config thì dùng default
  const getEffective = (role, key) => {
    const custom = rolePermsConfig?.[role];
    if (custom && custom[key] !== undefined) return custom[key];
    return DEFAULT_ROLE_PERMS[role]?.[key] ?? false;
  };

  const togglePerm = (role, key) => {
    const prev = rolePermsConfig || {};
    const roleCfg = prev[role] || {};
    const current = roleCfg[key] !== undefined ? roleCfg[key] : (DEFAULT_ROLE_PERMS[role]?.[key] ?? false);
    const next = { ...prev, [role]: { ...roleCfg, [key]: !current } };
    setRolePermsConfig(next);
    setPermsDirty(true);
  };

  const togglePage = (role, pageId) => {
    const prev = rolePermsConfig || {};
    const roleCfg = prev[role] || {};
    const defaultPages = DEFAULT_ROLE_PERMS[role]?.pages;
    const currentPages = roleCfg.pages !== undefined ? roleCfg.pages : defaultPages;
    // null = tất cả trang
    let pagesArr = currentPages === null ? ALL_PAGES.map(p => p.id) : [...(currentPages || [])];
    if (pagesArr.includes(pageId)) {
      pagesArr = pagesArr.filter(p => p !== pageId);
    } else {
      pagesArr.push(pageId);
    }
    // Nếu chọn hết thì set null
    const nextPages = pagesArr.length === ALL_PAGES.length ? null : pagesArr;
    const next = { ...prev, [role]: { ...roleCfg, pages: nextPages } };
    setRolePermsConfig(next);
    setPermsDirty(true);
  };

  const getEffectivePages = (role) => {
    const custom = rolePermsConfig?.[role];
    if (custom && custom.pages !== undefined) return custom.pages;
    return DEFAULT_ROLE_PERMS[role]?.pages ?? ['pricing'];
  };

  const savePerms = async () => {
    setSavingPerms(true);
    if (useAPI) {
      try {
        const api = await import('../api.js');
        const r = await api.saveRolePermissions(rolePermsConfig || {});
        if (r?.error) notify("Lỗi lưu phân quyền: " + r.error, false);
        else { notify("Đã lưu phân quyền"); setPermsDirty(false); }
      } catch (e) { notify("Lỗi kết nối: " + e.message, false); }
    } else {
      notify("Đã lưu phân quyền (local)");
      setPermsDirty(false);
    }
    setSavingPerms(false);
  };

  const resetPerms = () => {
    setRolePermsConfig(null);
    setPermsDirty(true);
  };

  // --- User CRUD ---
  const hardcodeUsers = Object.entries(USERS).map(([uname, u]) => ({
    id: "__hc_" + uname, username: uname, role: u.role, label: u.label, hardcode: true, active: true,
  }));
  const allUsers = [...hardcodeUsers, ...dynamicUsers.map(u => ({ ...u, hardcode: false }))];

  const openNew = () => {
    setFm({ username: "", password: "", role: "banhang", label: "" });
    setFmErr({}); setShowPw(false); setEd("new");
  };

  const openEdit = (u) => {
    setFm({ username: u.username, password: "", role: u.role, label: u.label || "" });
    setFmErr({}); setShowPw(false); setEd(u.id);
  };

  const validate = (isNew) => {
    const errs = {};
    const uname = fm.username.trim();
    if (!uname) errs.username = "Không được để trống";
    else if (/\s/.test(uname)) errs.username = "Không được chứa dấu cách";
    else {
      if (USERS[uname] && (isNew || dynamicUsers.find(u => u.id === ed)?.username !== uname))
        errs.username = "Tên đăng nhập này đã tồn tại (hệ thống)";
      const dup = dynamicUsers.find(u => u.id !== ed && u.username.toLowerCase() === uname.toLowerCase());
      if (dup) errs.username = "Tên đăng nhập này đã tồn tại";
    }
    if (isNew && !fm.password) errs.password = "Mật khẩu bắt buộc khi tạo mới";
    if (fm.password && fm.password.length < 4) errs.password = "Mật khẩu tối thiểu 4 ký tự";
    if (!fm.role) errs.role = "Chọn vai trò";
    return errs;
  };

  const sv = async () => {
    const isNew = ed === "new";
    const errs = validate(isNew);
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    const pwHash = fm.password ? await hashPassword(fm.password) : null;
    const label = fm.label.trim() || ROLE_LABELS[fm.role]?.text || fm.role;
    if (isNew) {
      const tmp = { id: "tmp_" + Date.now(), username: fm.username.trim(), passwordHash: pwHash, role: fm.role, label, active: true };
      setDynamicUsers(p => [...p, tmp]);
      if (useAPI) {
        import('../api.js').then(api => api.saveUser(null, fm.username.trim(), pwHash, fm.role, label, true, currentUser?.username)
          .then(r => {
            if (r?.error) { notify("Lỗi: " + r.error, false); setDynamicUsers(p => p.filter(u => u.id !== tmp.id)); }
            else { api.fetchUsers().then(users => setDynamicUsers(users)).catch(() => {}); notify("Đã thêm tài khoản " + fm.username.trim()); }
          }).catch(e => notify("Lỗi kết nối: " + e.message, false)));
      }
    } else {
      setDynamicUsers(p => p.map(u => u.id === ed ? { ...u, username: fm.username.trim(), role: fm.role, label, ...(pwHash ? { passwordHash: pwHash } : {}) } : u));
      if (useAPI) {
        import('../api.js').then(api => api.saveUser(ed, fm.username.trim(), pwHash, fm.role, label, true, currentUser?.username)
          .then(r => notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error))
          .catch(e => notify("Lỗi kết nối: " + e.message, false)));
      }
    }
    setEd(null);
  };

  const del = (u) => {
    if (delConfirm !== u.id) { setDelConfirm(u.id); return; }
    setDelConfirm(null);
    setDynamicUsers(p => p.filter(x => x.id !== u.id));
    if (useAPI) {
      import('../api.js').then(api => api.deleteUser(u.id)
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else notify("Đã xóa " + u.username); })
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
  };

  const toggleActive = (u) => {
    const newActive = !u.active;
    setDynamicUsers(p => p.map(x => x.id === u.id ? { ...x, active: newActive } : x));
    if (useAPI) {
      import('../api.js').then(api => api.saveUser(u.id, u.username, null, u.role, u.label, newActive, currentUser?.username)
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); })
        .catch(e => notify("Lỗi kết nối: " + e.message, false)));
    }
  };

  // --- Styles ---
  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };
  const lblS = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };
  const inpS = (hasErr) => ({ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (hasErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" });
  const errS = { fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 };
  const chkTh = { padding: "6px 8px", textAlign: "center", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontSize: "0.7rem" };
  const chkTd = { padding: "5px 8px", textAlign: "center", borderBottom: "1px solid var(--bd)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Quản lý tài khoản</h2>
        <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm tài khoản</button>
      </div>

      {/* ======= PHÂN QUYỀN PER-ROLE ======= */}
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--bd)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--br)" }}>Phân quyền theo vai trò</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={resetPerms} style={{ padding: "5px 12px", borderRadius: 6, background: "transparent", color: "var(--tm)", border: "1px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>Khôi phục mặc định</button>
            <button onClick={savePerms} disabled={!permsDirty || savingPerms}
              style={{ padding: "5px 14px", borderRadius: 6, background: permsDirty ? "var(--ac)" : "var(--bd)", color: permsDirty ? "#fff" : "var(--tm)", border: "none", cursor: permsDirty ? "pointer" : "not-allowed", fontWeight: 700, fontSize: "0.7rem" }}>
              {savingPerms ? "Đang lưu..." : "Lưu phân quyền"}
            </button>
          </div>
        </div>

        {/* Quyền chức năng */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>Quyền chức năng</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ ...chkTh, textAlign: "left", width: 180 }}>Quyền</th>
              {ASSIGNABLE_ROLES.map(r => (
                <th key={r} style={{ ...chkTh, color: ROLE_LABELS[r]?.color }}>
                  {ROLE_LABELS[r]?.icon} {ROLE_LABELS[r]?.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_DEFS.map(pd => (
              <tr key={pd.key}>
                <td style={{ ...chkTd, textAlign: "left", fontWeight: 600, color: "var(--ts)" }}>{pd.label}</td>
                {ASSIGNABLE_ROLES.map(r => {
                  const val = getEffective(r, pd.key);
                  return (
                    <td key={r} style={chkTd}>
                      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <input type="checkbox" checked={!!val} onChange={() => togglePerm(r, pd.key)} style={{ accentColor: "var(--gn)", cursor: "pointer", width: 15, height: 15 }} />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Trang được phép truy cập */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6, textTransform: "uppercase" }}>Trang được phép truy cập</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              <th style={{ ...chkTh, textAlign: "left", width: 180 }}>Trang</th>
              {ASSIGNABLE_ROLES.map(r => (
                <th key={r} style={{ ...chkTh, color: ROLE_LABELS[r]?.color }}>
                  {ROLE_LABELS[r]?.icon} {ROLE_LABELS[r]?.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PAGES.map(pg => (
              <tr key={pg.id}>
                <td style={{ ...chkTd, textAlign: "left", fontWeight: 600, color: "var(--ts)" }}>{pg.label}</td>
                {ASSIGNABLE_ROLES.map(r => {
                  const pages = getEffectivePages(r);
                  const has = pages === null || (pages && pages.includes(pg.id));
                  return (
                    <td key={r} style={chkTd}>
                      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                        <input type="checkbox" checked={has} onChange={() => togglePage(r, pg.id)} style={{ accentColor: "var(--gn)", cursor: "pointer", width: 15, height: 15 }} />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {permsDirty && <div style={{ marginTop: 8, fontSize: "0.68rem", color: "var(--ac)", fontWeight: 600 }}>* Có thay đổi chưa lưu</div>}
      </div>

      {/* ======= FORM THÊM/SỬA USER ======= */}
      {ed != null && (
        <div style={{ padding: 16, borderRadius: 10, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 14 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--br)", marginBottom: 12 }}>
            {ed === "new" ? "Thêm tài khoản mới" : "Sửa tài khoản"}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={lblS}>Tên đăng nhập</label>
              <input value={fm.username} onChange={e => { setFm(p => ({ ...p, username: e.target.value })); setFmErr(p => ({ ...p, username: "" })); }}
                placeholder="VD: nhanvien01" autoComplete="off" style={inpS(fmErr.username)} />
              {fmErr.username && <div style={errS}>{fmErr.username}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={lblS}>{ed === "new" ? "Mật khẩu" : "Mật khẩu mới (bỏ trống = giữ nguyên)"}</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={fm.password} onChange={e => { setFm(p => ({ ...p, password: e.target.value })); setFmErr(p => ({ ...p, password: "" })); }}
                  placeholder={ed === "new" ? "Nhập mật khẩu" : "Để trống nếu không đổi"} autoComplete="new-password"
                  style={{ ...inpS(fmErr.password), paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "var(--tm)", fontSize: "0.8rem", padding: 2 }}>
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {fmErr.password && <div style={errS}>{fmErr.password}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lblS}>Vai trò</label>
              <select value={fm.role} onChange={e => setFm(p => ({ ...p, role: e.target.value }))}
                style={{ ...inpS(fmErr.role), cursor: "pointer" }}>
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]?.icon} {ROLE_LABELS[r]?.text}</option>
                ))}
              </select>
              {fmErr.role && <div style={errS}>{fmErr.role}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lblS}>Tên hiển thị (tùy chọn)</label>
              <input value={fm.label} onChange={e => setFm(p => ({ ...p, label: e.target.value }))}
                placeholder="VD: Nguyễn Văn A" style={inpS(false)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEd(null); setFmErr({}); }} style={{ padding: "7px 16px", borderRadius: 7, background: "transparent", color: "var(--ts)", border: "1.5px solid var(--bd)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={sv} style={{ padding: "7px 20px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </div>
      )}

      {/* ======= BẢNG USER ======= */}
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, width: 40, textAlign: "center" }}>STT</th>
              <th style={ths}>Tên đăng nhập</th>
              <th style={ths}>Tên hiển thị</th>
              <th style={{ ...ths, width: 120, textAlign: "center" }}>Vai trò</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Loại</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Trạng thái</th>
              <th style={{ ...ths, width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {allUsers.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Chưa có tài khoản nào</td></tr>
            )}
            {allUsers.map((u, i) => {
              const rl = ROLE_LABELS[u.role];
              return (
                <tr key={u.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff", opacity: u.active === false ? 0.5 : 1 }}>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontFamily: "monospace", color: "var(--br)" }}>{u.username}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{u.label || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                    {rl && <span style={{ padding: "2px 8px", borderRadius: 4, background: rl.bg, color: rl.color, fontWeight: 700, fontSize: "0.7rem" }}>{rl.icon} {rl.text}</span>}
                  </td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>
                    {u.hardcode ? <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(231,76,60,0.1)", color: "#E74C3C", fontWeight: 600 }}>Hệ thống</span>
                      : <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(52,152,219,0.1)", color: "#2980B9", fontWeight: 600 }}>Tùy chỉnh</span>}
                  </td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                    {u.active !== false
                      ? <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(50,79,39,0.1)", color: "var(--gn)", fontWeight: 700, fontSize: "0.68rem" }}>Hoạt động</span>
                      : <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(192,57,43,0.1)", color: "var(--dg)", fontWeight: 700, fontSize: "0.68rem" }}>Vô hiệu</span>}
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                    {!u.hardcode && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEdit(u)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>Sửa</button>
                        <button onClick={() => toggleActive(u)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: u.active !== false ? "var(--tm)" : "var(--gn)", border: "1px solid " + (u.active !== false ? "var(--bd)" : "var(--gn)"), cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {u.active !== false ? "Khóa" : "Mở"}
                        </button>
                        <button onClick={() => del(u)} style={{ padding: "3px 7px", borderRadius: 4, background: delConfirm === u.id ? "var(--dg)" : "transparent", color: delConfirm === u.id ? "#fff" : "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {delConfirm === u.id ? "Chắc chắn?" : "Xóa"}
                        </button>
                      </div>
                    )}
                    {u.hardcode && <span style={{ fontSize: "0.65rem", color: "var(--tm)", fontStyle: "italic" }}>Không thể sửa</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
