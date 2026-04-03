import React, { useState } from "react";
import { USERS, ASSIGNABLE_ROLES, ROLE_LABELS, hashPassword } from "../auth";
import Dialog from "../components/Dialog";
import { audit } from "../utils/auditHelper";

export default function PgUsers({ dynamicUsers, setDynamicUsers, permGroups, useAPI, notify, currentUser }) {
  const [ed, setEd] = useState(null); // null | "new" | userId
  const [fm, setFm] = useState({ username: "", password: "", role: "banhang", label: "", email: "", phone: "", permissionGroupId: "", notes: "" });
  const [fmErr, setFmErr] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [resetPwUser, setResetPwUser] = useState(null); // user đang reset mật khẩu
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // --- User CRUD ---
  const hardcodeUsers = Object.entries(USERS).map(([uname, u]) => ({
    id: "__hc_" + uname, username: uname, role: u.role, label: u.label, hardcode: true, active: true,
    email: '', phone: '', permissionGroupId: null, notes: '', lastLoginAt: null, lastLoginIp: null,
  }));
  const allUsers = [...hardcodeUsers, ...dynamicUsers.map(u => ({ ...u, hardcode: false }))];

  const getGroupName = (groupId) => {
    if (!groupId) return null;
    const g = (permGroups || []).find(g => g.id === groupId);
    return g || null;
  };

  const openNew = () => {
    setFm({ username: "", password: "", role: "banhang", label: "", email: "", phone: "", permissionGroupId: "", notes: "" });
    setFmErr({}); setShowPw(false); setEd("new");
  };

  const openEdit = (u) => {
    setFm({
      username: u.username, password: "", role: u.role, label: u.label || "",
      email: u.email || "", phone: u.phone || "",
      permissionGroupId: u.permissionGroupId || "",
      notes: u.notes || "",
    });
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
    if (fm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fm.email)) errs.email = "Email không hợp lệ";
    return errs;
  };

  const sv = async () => {
    const isNew = ed === "new";
    const errs = validate(isNew);
    if (Object.keys(errs).length) { setFmErr(errs); return; }
    setFmErr({});
    const pwHash = fm.password ? await hashPassword(fm.password) : null;
    const label = fm.label.trim() || ROLE_LABELS[fm.role]?.text || fm.role;
    const extra = { email: fm.email.trim(), phone: fm.phone.trim(), permissionGroupId: fm.permissionGroupId || null, notes: fm.notes.trim() };

    if (isNew) {
      const tmp = { id: "tmp_" + Date.now(), username: fm.username.trim(), passwordHash: pwHash, role: fm.role, label, active: true, ...extra };
      setDynamicUsers(p => [...p, tmp]);
      if (useAPI) {
        import('../api.js').then(api => api.saveUser(null, fm.username.trim(), pwHash, fm.role, label, true, currentUser?.username, extra)
          .then(r => {
            if (r?.error) { notify("Lỗi: " + r.error, false); setDynamicUsers(p => p.filter(u => u.id !== tmp.id)); }
            else { api.fetchUsers().then(users => setDynamicUsers(users)).catch(() => {}); notify("Đã thêm tài khoản " + fm.username.trim()); audit(currentUser?.username, 'users', 'create', `Tạo tài khoản ${fm.username.trim()} (${fm.role})`, { entityType: 'user' }); }
          }).catch(e => notify("Lỗi kết nối: " + e.message, false)));
      }
    } else {
      setDynamicUsers(p => p.map(u => u.id === ed ? { ...u, username: fm.username.trim(), role: fm.role, label, ...(pwHash ? { passwordHash: pwHash } : {}), ...extra } : u));
      if (useAPI) {
        import('../api.js').then(api => api.saveUser(ed, fm.username.trim(), pwHash, fm.role, label, true, currentUser?.username, extra)
          .then(r => { notify(r?.error ? ("Lỗi: " + r.error) : "Đã cập nhật", !r?.error); if (!r?.error) audit(currentUser?.username, 'users', 'update', `Cập nhật tài khoản ${fm.username.trim()}`, { entityType: 'user', entityId: ed }); })
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
        .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else { notify("Đã xóa " + u.username); audit(currentUser?.username, 'users', 'delete', `Xóa tài khoản ${u.username}`, { entityType: 'user', entityId: u.id }); } })
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

  const resetPassword = async () => {
    if (!resetPwUser || !newPw) return;
    if (newPw.length < 4) { notify("Mật khẩu tối thiểu 4 ký tự", false); return; }
    setSavingPw(true);
    const pwHash = await hashPassword(newPw);
    setDynamicUsers(p => p.map(u => u.id === resetPwUser.id ? { ...u, passwordHash: pwHash } : u));
    if (useAPI) {
      import('../api.js').then(api => api.saveUser(resetPwUser.id, resetPwUser.username, pwHash, resetPwUser.role, resetPwUser.label, resetPwUser.active, currentUser?.username)
        .then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else { notify("Đã đặt lại mật khẩu cho " + resetPwUser.username); audit(currentUser?.username, 'users', 'update', `Reset mật khẩu cho ${resetPwUser.username}`, { entityType: 'user', entityId: resetPwUser.id }); }
        }).catch(e => notify("Lỗi: " + e.message, false)));
    }
    setSavingPw(false);
    setResetPwUser(null);
    setNewPw('');
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // --- Styles ---
  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };
  const lblS = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };
  const inpS = (hasErr) => ({ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid " + (hasErr ? "var(--dg)" : "var(--bd)"), fontSize: "0.82rem", outline: "none", boxSizing: "border-box" });
  const errS = { fontSize: "0.65rem", color: "var(--dg)", marginTop: 3 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Quản lý tài khoản</h2>
        <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm tài khoản</button>
      </div>

      {/* ======= FORM THÊM/SỬA USER ======= */}
      {ed != null && (
        <Dialog open={true} onClose={() => { setEd(null); setFmErr({}); }} onOk={sv} title={ed === "new" ? "Thêm tài khoản mới" : "Sửa tài khoản"} width={600} noEnter>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Row 1: username + password */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Tên đăng nhập</label>
                <input value={fm.username} onChange={e => { setFm(p => ({ ...p, username: e.target.value })); setFmErr(p => ({ ...p, username: "" })); }}
                  placeholder="VD: nhanvien01" autoComplete="off" style={inpS(fmErr.username)} />
                {fmErr.username && <div style={errS}>{fmErr.username}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>{ed === "new" ? "Mật khẩu" : "Mật khẩu mới (bỏ trống = giữ nguyên)"}</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={fm.password} onChange={e => { setFm(p => ({ ...p, password: e.target.value })); setFmErr(p => ({ ...p, password: "" })); }}
                    placeholder={ed === "new" ? "Nhập mật khẩu" : "Để trống nếu không đổi"} autoComplete="new-password"
                    style={{ ...inpS(fmErr.password), paddingRight: 36 }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "var(--tm)", fontSize: "0.8rem", padding: 2 }}>
                    {showPw ? "\u{1F648}" : "\u{1F441}"}
                  </button>
                </div>
                {fmErr.password && <div style={errS}>{fmErr.password}</div>}
              </div>
            </div>

            {/* Row 2: role + nhóm quyền + tên hiển thị */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Vai trò</label>
                <select value={fm.role} onChange={e => setFm(p => ({ ...p, role: e.target.value }))}
                  style={{ ...inpS(fmErr.role), cursor: "pointer" }}>
                  {ASSIGNABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]?.icon} {ROLE_LABELS[r]?.text}</option>
                  ))}
                </select>
                {fmErr.role && <div style={errS}>{fmErr.role}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Nhóm quyền</label>
                <select value={fm.permissionGroupId} onChange={e => setFm(p => ({ ...p, permissionGroupId: e.target.value }))}
                  style={{ ...inpS(false), cursor: "pointer" }}>
                  <option value="">— Dùng mặc định theo vai trò —</option>
                  {(permGroups || []).filter(g => g.active !== false).map(g => (
                    <option key={g.id} value={g.id}>{g.icon} {g.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Tên hiển thị</label>
                <input value={fm.label} onChange={e => setFm(p => ({ ...p, label: e.target.value }))}
                  placeholder="VD: Nguyễn Văn A" style={inpS(false)} />
              </div>
            </div>

            {/* Row 3: email + phone */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Email</label>
                <input value={fm.email} onChange={e => { setFm(p => ({ ...p, email: e.target.value })); setFmErr(p => ({ ...p, email: "" })); }}
                  placeholder="VD: nhanvien@gth.vn" style={inpS(fmErr.email)} />
                {fmErr.email && <div style={errS}>{fmErr.email}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={lblS}>Số điện thoại</label>
                <input value={fm.phone} onChange={e => setFm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="VD: 0901234567" style={inpS(false)} />
              </div>
            </div>

            {/* Row 4: notes */}
            <div>
              <label style={lblS}>Ghi chú</label>
              <textarea value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Ghi chú thêm về tài khoản"
                style={{ ...inpS(false), minHeight: 50, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => { setEd(null); setFmErr({}); }} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
              <button onClick={sv} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>{ed === "new" ? "Tạo tài khoản" : "Lưu"}</button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ======= DIALOG RESET MẬT KHẨU ======= */}
      {resetPwUser && (
        <Dialog open={true} onClose={() => { setResetPwUser(null); setNewPw(''); }} onOk={resetPassword} title={`Đặt lại mật khẩu — ${resetPwUser.username}`} width={400}>
          <div style={{ marginBottom: 8, fontSize: "0.78rem", color: "var(--ts)" }}>
            Nhập mật khẩu mới cho tài khoản <strong>{resetPwUser.username}</strong>:
          </div>
          <div style={{ position: "relative" }}>
            <input type={showNewPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Mật khẩu mới (tối thiểu 4 ký tự)" autoFocus
              style={{ ...inpS(!newPw || newPw.length < 4), paddingRight: 36 }} />
            <button type="button" onClick={() => setShowNewPw(p => !p)}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "var(--tm)", fontSize: "0.8rem", padding: 2 }}>
              {showNewPw ? "\u{1F648}" : "\u{1F441}"}
            </button>
          </div>
          {newPw && newPw.length < 4 && <div style={errS}>Mật khẩu tối thiểu 4 ký tự</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => { setResetPwUser(null); setNewPw(''); }} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={resetPassword} disabled={!newPw || newPw.length < 4} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: !newPw || newPw.length < 4 ? "var(--bd)" : "var(--ac)", color: "#fff", cursor: !newPw || newPw.length < 4 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Đặt lại</button>
          </div>
        </Dialog>
      )}

      {/* ======= BẢNG USER ======= */}
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ ...ths, width: 40, textAlign: "center" }}>STT</th>
              <th style={ths}>Tên đăng nhập</th>
              <th style={ths}>Tên hiển thị</th>
              <th style={{ ...ths, width: 100, textAlign: "center" }}>Vai trò</th>
              <th style={{ ...ths, width: 120, textAlign: "center" }}>Nhóm quyền</th>
              <th style={{ ...ths, width: 140 }}>Liên hệ</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Loại</th>
              <th style={{ ...ths, width: 80, textAlign: "center" }}>Trạng thái</th>
              <th style={{ ...ths, width: 120 }}>Đăng nhập cuối</th>
              <th style={{ ...ths, width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {allUsers.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Chưa có tài khoản nào</td></tr>
            )}
            {allUsers.map((u, i) => {
              const rl = ROLE_LABELS[u.role];
              const grp = getGroupName(u.permissionGroupId);
              return (
                <tr key={u.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff", opacity: u.active === false ? 0.5 : 1 }}>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.72rem" }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontFamily: "monospace", color: "var(--br)" }}>{u.username}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{u.label || <span style={{ color: "var(--tm)", fontStyle: "italic" }}>—</span>}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                    {rl && <span style={{ padding: "2px 8px", borderRadius: 4, background: rl.bg, color: rl.color, fontWeight: 700, fontSize: "0.7rem" }}>{rl.icon} {rl.text}</span>}
                  </td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                    {grp
                      ? <span style={{ padding: "2px 8px", borderRadius: 4, background: (grp.color || '#666') + '18', color: grp.color || '#666', fontWeight: 600, fontSize: "0.68rem" }}>{grp.icon} {grp.name}</span>
                      : <span style={{ fontSize: "0.66rem", color: "var(--tm)", fontStyle: "italic" }}>Mặc định</span>}
                  </td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem", color: "var(--ts)" }}>
                    {u.email && <div title={u.email} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{u.email}</div>}
                    {u.phone && <div style={{ color: "var(--tm)", fontSize: "0.68rem" }}>{u.phone}</div>}
                    {!u.email && !u.phone && <span style={{ color: "var(--tm)" }}>—</span>}
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
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", fontSize: "0.68rem", color: "var(--tm)" }}>
                    {u.lastLoginAt ? (
                      <div>
                        <div>{formatDate(u.lastLoginAt)}</div>
                        {u.lastLoginIp && <div style={{ fontSize: "0.62rem", fontFamily: "monospace" }}>{u.lastLoginIp}</div>}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid var(--bd)" }}>
                    {!u.hardcode && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => openEdit(u)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "var(--ac)", border: "1px solid var(--ac)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>Sửa</button>
                        <button onClick={() => { setResetPwUser(u); setNewPw(''); setShowNewPw(false); }} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: "#8e44ad", border: "1px solid #8e44ad", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>Đặt MK</button>
                        <button onClick={() => toggleActive(u)} style={{ padding: "3px 7px", borderRadius: 4, background: "transparent", color: u.active !== false ? "var(--tm)" : "var(--gn)", border: "1px solid " + (u.active !== false ? "var(--bd)" : "var(--gn)"), cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {u.active !== false ? "Khóa" : "Mở"}
                        </button>
                        <button onClick={() => del(u)} style={{ padding: "3px 7px", borderRadius: 4, background: delConfirm === u.id ? "var(--dg)" : "transparent", color: delConfirm === u.id ? "#fff" : "var(--dg)", border: "1px solid var(--dg)", cursor: "pointer", fontWeight: 600, fontSize: "0.66rem" }}>
                          {delConfirm === u.id ? "Chắc chắn?" : "Xóa"}
                        </button>
                      </div>
                    )}
                    {u.hardcode && <span style={{ fontSize: "0.65rem", color: "var(--tm)", fontStyle: "italic" }}>Hệ thống</span>}
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
