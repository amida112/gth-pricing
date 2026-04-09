import React, { useState, useEffect, useCallback } from "react";

const MODULE_LABELS = {
  auth: 'Đăng nhập', sales: 'Đơn hàng', customers: 'Khách hàng', warehouse: 'Kho gỗ kiện',
  raw_wood: 'Gỗ nguyên liệu', sawing: 'Xẻ gỗ', kiln: 'Lò sấy', pricing: 'Bảng giá',
  suppliers: 'NCC', containers: 'Container', shipments: 'Lịch hàng về', carriers: 'Vận tải',
  reconciliation: 'Đối soát', config: 'Cấu hình', users: 'Tài khoản', permissions: 'Phân quyền',
};

const ACTION_LABELS = {
  create: { text: 'Tạo mới', color: '#27ae60', bg: 'rgba(39,174,96,0.1)' },
  update: { text: 'Cập nhật', color: '#2980b9', bg: 'rgba(41,128,185,0.1)' },
  delete: { text: 'Xóa', color: '#e74c3c', bg: 'rgba(231,76,60,0.1)' },
  login: { text: 'Đăng nhập', color: '#8e44ad', bg: 'rgba(142,68,173,0.1)' },
  logout: { text: 'Đăng xuất', color: '#95a5a6', bg: 'rgba(149,165,166,0.1)' },
  login_fail: { text: 'Sai MK', color: '#e67e22', bg: 'rgba(230,126,34,0.1)' },
  approve: { text: 'Duyệt', color: '#16a085', bg: 'rgba(22,160,133,0.1)' },
  export: { text: 'Xuất', color: '#2c3e50', bg: 'rgba(44,62,80,0.1)' },
};

const PAGE_SIZE = 50;

function PgAuditLog({ useAPI, notify }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [fUsername, setFUsername] = useState('');
  const [fModule, setFModule] = useState('');
  const [fAction, setFAction] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');

  // Dropdown options
  const [usernames, setUsernames] = useState([]);
  const [modules, setModules] = useState([]);

  const loadLogs = useCallback(async (pg = 1) => {
    if (!useAPI) return;
    setLoading(true);
    try {
      const api = await import('../api.js');
      const result = await api.fetchAuditLogs({
        page: pg, pageSize: PAGE_SIZE,
        username: fUsername || undefined,
        module: fModule || undefined,
        action: fAction || undefined,
        dateFrom: fDateFrom || undefined,
        dateTo: fDateTo || undefined,
      });
      setLogs(result.logs);
      setTotal(result.total);
      setPage(pg);
    } catch (e) {
      notify("Lỗi tải nhật ký: " + e.message, false);
    }
    setLoading(false);
  }, [useAPI, fUsername, fModule, fAction, fDateFrom, fDateTo, notify]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  // Load filter options
  useEffect(() => {
    if (!useAPI) return;
    import('../api.js').then(api => {
      api.fetchAuditLogUsernames().then(setUsernames).catch(() => {});
      api.fetchAuditLogModules().then(setModules).catch(() => {});
    });
  }, [useAPI]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)" };
  const fltS = { width: "100%", fontSize: "0.76rem", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>Nhật ký hệ thống</h2>
        <div style={{ fontSize: "0.72rem", color: "var(--tm)" }}>
          Tổng: <strong>{total.toLocaleString('vi-VN')}</strong> bản ghi
        </div>
      </div>

      {!useAPI && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
          Nhật ký hệ thống yêu cầu kết nối API.
        </div>
      )}

      {useAPI && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600 }}>Người dùng</label>
              <select value={fUsername} onChange={e => setFUsername(e.target.value)} style={fltS}>
                <option value="">Tất cả</option>
                {usernames.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600 }}>Module</label>
              <select value={fModule} onChange={e => setFModule(e.target.value)} style={fltS}>
                <option value="">Tất cả</option>
                {modules.map(m => <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 100 }}>
              <label style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600 }}>Hành động</label>
              <select value={fAction} onChange={e => setFAction(e.target.value)} style={fltS}>
                <option value="">Tất cả</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600 }}>Từ ngày</label>
              <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={fltS} />
            </div>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: "0.62rem", color: "var(--tm)", fontWeight: 600 }}>Đến ngày</label>
              <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={fltS} />
            </div>
            <button onClick={() => { setFUsername(''); setFModule(''); setFAction(''); setFDateFrom(''); setFDateTo(''); }}
              style={{ padding: "3px 10px", borderRadius: 4, background: "transparent", color: "var(--tm)", border: "1px solid var(--bd)", cursor: "pointer", fontSize: "0.64rem", fontWeight: 600, alignSelf: "flex-end" }}>Xóa lọc</button>
          </div>

          {/* Bảng log */}
          <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
              <thead>
                <tr>
                  <th style={{ ...ths, width: 145, whiteSpace: "nowrap" }}>Thời gian</th>
                  <th style={{ ...ths, width: 100 }}>Người dùng</th>
                  <th style={{ ...ths, width: 120 }}>Module</th>
                  <th style={{ ...ths, width: 90, textAlign: "center" }}>Hành động</th>
                  <th style={ths}>Mô tả</th>
                  <th style={{ ...ths, width: 110 }}>IP</th>
                  <th style={{ ...ths, width: 40, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Đang tải...</td></tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Không có bản ghi nào</td></tr>
                )}
                {!loading && logs.map((log, i) => {
                  const act = ACTION_LABELS[log.action] || { text: log.action, color: '#666', bg: 'rgba(0,0,0,0.05)' };
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr style={{ background: i % 2 ? "var(--bgs)" : "#fff" }} data-clickable="true" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap", fontSize: "0.72rem", color: "var(--ts)" }}>{formatDate(log.createdAt)}</td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontFamily: "monospace", color: "var(--br)", fontSize: "0.74rem" }}>{log.username}</td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--ts)" }}>{MODULE_LABELS[log.module] || log.module}</span>
                        </td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, background: act.bg, color: act.color, fontWeight: 700, fontSize: "0.66rem" }}>{act.text}</span>
                        </td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", color: "var(--ts)", fontSize: "0.74rem" }} title={log.description}>{log.description}</td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontFamily: "monospace", fontSize: "0.68rem", color: "var(--tm)" }}>{log.ipAddress || '—'}</td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--bd)", textAlign: "center", fontSize: "0.6rem", color: "var(--tm)", cursor: "pointer" }}>
                          {(log.oldData || log.newData) ? (isExpanded ? '▲' : '▼') : ''}
                        </td>
                      </tr>
                      {isExpanded && (log.oldData || log.newData) && (
                        <tr style={{ background: "rgba(52,152,219,0.03)" }}>
                          <td colSpan={7} style={{ padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>
                            <div style={{ display: "flex", gap: 16, fontSize: "0.72rem" }}>
                              {log.oldData && (
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: "#e74c3c", marginBottom: 4, fontSize: "0.68rem", textTransform: "uppercase" }}>Dữ liệu cũ</div>
                                  <pre style={{ margin: 0, padding: 8, borderRadius: 6, background: "rgba(231,76,60,0.05)", border: "1px solid rgba(231,76,60,0.15)", fontSize: "0.68rem", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                    {JSON.stringify(log.oldData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newData && (
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: "#27ae60", marginBottom: 4, fontSize: "0.68rem", textTransform: "uppercase" }}>Dữ liệu mới</div>
                                  <pre style={{ margin: 0, padding: 8, borderRadius: 6, background: "rgba(39,174,96,0.05)", border: "1px solid rgba(39,174,96,0.15)", fontSize: "0.68rem", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                    {JSON.stringify(log.newData, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {log.userAgent && (
                              <div style={{ marginTop: 8, fontSize: "0.64rem", color: "var(--tm)" }}>
                                <strong>User Agent:</strong> {log.userAgent}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 12 }}>
              <button onClick={() => loadLogs(page - 1)} disabled={page <= 1}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", cursor: page > 1 ? "pointer" : "not-allowed", color: "var(--ts)", fontWeight: 600, fontSize: "0.72rem" }}>
                ← Trước
              </button>
              <span style={{ fontSize: "0.74rem", color: "var(--ts)", fontWeight: 600 }}>
                Trang {page}/{totalPages}
              </span>
              <button onClick={() => loadLogs(page + 1)} disabled={page >= totalPages}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", cursor: page < totalPages ? "pointer" : "not-allowed", color: "var(--ts)", fontWeight: 600, fontSize: "0.72rem" }}>
                Sau →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(PgAuditLog);
