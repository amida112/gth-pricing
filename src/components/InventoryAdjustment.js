import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dialog from './Dialog';
import { fmtDate, fmtMoney } from '../utils';

/**
 * InventoryAdjustment — Section cân kho trong PgWarehouse
 *
 * Props:
 *  - bundles: danh sách tất cả bundles
 *  - wts: danh sách loại gỗ
 *  - user: { username, role }
 *  - isAdmin: boolean
 *  - useAPI: boolean
 *  - notify: (msg, ok) => void
 */

const ADJ_STATUS = {
  pending:  { label: 'Chờ duyệt', color: '#D4A017', bg: 'rgba(212,160,23,0.1)' },
  approved: { label: 'Đã duyệt', color: '#324F27', bg: 'rgba(50,79,39,0.1)' },
  rejected: { label: 'Từ chối', color: '#c0392b', bg: 'rgba(192,57,43,0.1)' },
};

export default function InventoryAdjustment({ bundles, wts, user, isAdmin, useAPI, notify, onBundleUpdated }) {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showAdjust, setShowAdjust] = useState(null); // bundle to adjust
  const [adjFm, setAdjFm] = useState({ newBoards: '', newVolume: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [tab, setTab] = useState('anomalies'); // 'anomalies' | 'pending' | 'history' | 'report'

  const loadData = useCallback(async () => {
    if (!useAPI) { setLoading(false); return; }
    try {
      const api = await import('../api.js');
      const [adjs, count] = await Promise.all([
        api.fetchInventoryAdjustments(),
        api.fetchPendingAdjustmentsCount(),
      ]);
      setAdjustments(adjs);
      setPendingCount(count);
    } catch (e) { notify('Lỗi tải dữ liệu cân kho: ' + e.message, false); }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Kiện bất thường
  const anomalies = useMemo(() => {
    return bundles.filter(b => {
      if (b.status === 'Đã bán') return false; // đã đóng, bỏ qua
      if (b.status === 'Chưa xếp') return false;
      const negBoards = b.remainingBoards < 0;
      const negVol = b.remainingVolume < 0;
      const zeroBoards = b.remainingBoards === 0 && b.remainingVolume > 0.01;
      const zeroVol = b.remainingVolume <= 0 && b.remainingBoards > 0;
      const nearEmpty = b.boardCount > 0 && b.remainingBoards > 0 && b.remainingBoards / b.boardCount < 0.1;
      return negBoards || negVol || zeroBoards || zeroVol || nearEmpty;
    }).map(b => {
      const issues = [];
      if (b.remainingBoards < 0) issues.push('Âm tấm');
      if (b.remainingVolume < 0) issues.push('Âm KL');
      if (b.remainingBoards === 0 && b.remainingVolume > 0.01) issues.push('Hết tấm còn KL');
      if (b.remainingVolume <= 0 && b.remainingBoards > 0) issues.push('Hết KL còn tấm');
      if (b.boardCount > 0 && b.remainingBoards > 0 && b.remainingBoards / b.boardCount < 0.1 && !issues.length) issues.push('Gần hết');
      return { ...b, issues };
    });
  }, [bundles]);

  // Load sales history for a bundle
  const loadSalesHistory = async (bundleId) => {
    setLoadingSales(true);
    setSalesHistory([]);
    try {
      const api = await import('../api.js');
      const data = await api.fetchBundleSalesHistory(bundleId);
      setSalesHistory(data);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setLoadingSales(false);
  };

  // Open adjust dialog
  const openAdjust = (bundle) => {
    setShowAdjust(bundle);
    setAdjFm({
      newBoards: String(bundle.remainingBoards),
      newVolume: String((bundle.remainingVolume || 0).toFixed(4)),
      reason: '',
    });
    loadSalesHistory(bundle.id);
  };

  // Submit adjustment request
  const handleRequestAdjust = async () => {
    if (!adjFm.reason.trim()) { notify('Nhập lý do điều chỉnh', false); return; }
    setSaving(true);
    try {
      const api = await import('../api.js');
      const isClose = parseInt(adjFm.newBoards) === 0 && parseFloat(adjFm.newVolume) === 0;
      const result = await api.requestAdjustment({
        bundleId: showAdjust.id,
        type: isClose ? 'close_bundle' : 'adjust',
        newBoards: parseInt(adjFm.newBoards),
        newVolume: parseFloat(adjFm.newVolume),
        reason: adjFm.reason.trim(),
        requestedBy: user?.username || null,
      });
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify('Đã gửi phiếu điều chỉnh — chờ sếp duyệt');
      setShowAdjust(null);
      loadData();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Admin approve
  const handleApprove = async (adjId) => {
    setSaving(true);
    try {
      const api = await import('../api.js');
      const result = await api.approveAdjustment(adjId, user?.username || 'admin');
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify('Đã duyệt phiếu điều chỉnh');
      loadData();
      if (onBundleUpdated) onBundleUpdated();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Admin reject
  const handleReject = async (adjId) => {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    setSaving(true);
    try {
      const api = await import('../api.js');
      const result = await api.rejectAdjustment(adjId, user?.username || 'admin', reason);
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify('Đã từ chối phiếu');
      loadData();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // Weekly report
  const loadWeeklyReport = async () => {
    setLoadingReport(true);
    try {
      const api = await import('../api.js');
      // Tuần hiện tại: thứ 2 → CN
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=CN, 1=T2, ...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const data = await api.fetchWeeklyClosedBundles(monday.toISOString(), sunday.toISOString());
      setReportData(data);
      setShowReport(true);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setLoadingReport(false);
  };

  const getWoodName = (woodId) => {
    const w = wts.find(x => x.id === woodId);
    return w ? `${w.icon || ''} ${w.name}` : woodId;
  };

  const inp = { padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const pendingAdjs = adjustments.filter(a => a.status === 'pending');

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "2px solid var(--bd)" }}>
        {[
          { key: 'anomalies', label: `Bất thường (${anomalies.length})`, icon: '⚠️' },
          { key: 'pending', label: `Chờ duyệt (${pendingAdjs.length})`, icon: '📋' },
          { key: 'history', label: 'Lịch sử', icon: '📜' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "6px 14px", border: "none", borderBottom: tab === t.key ? "2.5px solid var(--ac)" : "2.5px solid transparent", background: "transparent", color: tab === t.key ? "var(--ac)" : "var(--tm)", cursor: "pointer", fontWeight: tab === t.key ? 700 : 500, fontSize: "0.74rem", marginBottom: -2, transition: "all 0.12s" }}>
            {t.icon} {t.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={loadWeeklyReport} disabled={loadingReport}
          style={{ padding: "4px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem", marginBottom: 4 }}>
          {loadingReport ? '...' : 'Báo cáo tuần'}
        </button>
      </div>

      {/* Tab: Bất thường */}
      {tab === 'anomalies' && (
        anomalies.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--gn)", fontSize: "0.76rem", border: "1.5px dashed var(--bd)", borderRadius: 7, background: "rgba(50,79,39,0.03)" }}>
            Không có kiện nào bất thường
          </div>
        ) : (
          <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: 600 }}>
              <thead>
                <tr style={{ background: "var(--bgh)" }}>
                  {['#', 'Mã kiện', 'Loại gỗ', 'Tấm còn', 'KL còn', 'Vấn đề', ''].map((h, i) => (
                    <th key={i} style={{ padding: "5px 6px", textAlign: i === 3 || i === 4 ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalies.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.65rem", color: "var(--tm)", textAlign: "center", width: 30 }}>{i + 1}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>
                      {b.supplierBundleCode || b.bundleCode}
                      {b.supplierBundleCode && <div style={{ fontSize: "0.6rem", color: "var(--tm)" }}>{b.bundleCode}</div>}
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)" }}>{getWoodName(b.woodId)}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingBoards < 0 ? "var(--dg)" : "var(--br)" }}>
                      {b.remainingBoards}<span style={{ color: "var(--tm)", fontSize: "0.62rem" }}>/{b.boardCount}</span>
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingVolume < 0 ? "var(--dg)" : "var(--br)" }}>
                      {(b.remainingVolume || 0).toFixed(4)}<span style={{ color: "var(--tm)", fontSize: "0.62rem" }}>/{(b.volume || 0).toFixed(4)}</span>
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)" }}>
                      {b.issues.map((issue, j) => (
                        <span key={j} style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(231,76,60,0.08)", color: "var(--dg)", fontSize: "0.62rem", fontWeight: 600, marginRight: 3 }}>{issue}</span>
                      ))}
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)" }}>
                      <button onClick={() => openAdjust(b)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--ac)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600 }}>
                        Điều chỉnh
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Chờ duyệt */}
      {tab === 'pending' && (
        pendingAdjs.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.76rem", border: "1.5px dashed var(--bd)", borderRadius: 7 }}>
            Không có phiếu nào chờ duyệt
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingAdjs.map(adj => {
              const b = bundles.find(x => x.id === adj.bundleId);
              const boardDiff = adj.newBoards - adj.oldBoards;
              const volDiff = adj.newVolume - adj.oldVolume;
              return (
                <div key={adj.id} style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #D4A017", background: "rgba(212,160,23,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.82rem" }}>{b?.supplierBundleCode || b?.bundleCode || `Bundle #${adj.bundleId}`}</span>
                      <span style={{ marginLeft: 8, fontSize: "0.68rem", color: "var(--tm)" }}>{getWoodName(b?.woodId)}</span>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{adj.requestedBy} · {fmtDate(adj.requestedAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: "0.76rem", marginBottom: 6 }}>
                    <span>Tấm: {adj.oldBoards} → <b>{adj.newBoards}</b> <span style={{ color: boardDiff < 0 ? "var(--dg)" : "var(--gn)", fontWeight: 600 }}>({boardDiff > 0 ? '+' : ''}{boardDiff})</span></span>
                    <span>KL: {adj.oldVolume?.toFixed(4)} → <b>{adj.newVolume?.toFixed(4)}</b> <span style={{ color: volDiff < 0 ? "var(--dg)" : "var(--gn)", fontWeight: 600 }}>({volDiff > 0 ? '+' : ''}{volDiff.toFixed(4)})</span></span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--ts)", marginBottom: 8, padding: "4px 8px", borderRadius: 4, background: "var(--bgs)" }}>
                    <b>Lý do:</b> {adj.reason}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleApprove(adj.id)} disabled={saving}
                        style={{ padding: "4px 14px", borderRadius: 5, background: "#324F27", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem" }}>
                        Duyệt
                      </button>
                      <button onClick={() => handleReject(adj.id)} disabled={saving}
                        style={{ padding: "4px 14px", borderRadius: 5, background: "transparent", color: "#c0392b", border: "1px solid #c0392b", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tab: Lịch sử */}
      {tab === 'history' && (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", minWidth: 600 }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {['Ngày', 'Kiện', 'Loại', 'Tấm', 'KL', 'Lý do', 'Trạng thái', 'Người duyệt'].map((h, i) => (
                  <th key={i} style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "var(--tm)" }}>Chưa có lịch sử điều chỉnh</td></tr>
              ) : adjustments.map((adj, i) => {
                const b = bundles.find(x => x.id === adj.bundleId);
                const st = ADJ_STATUS[adj.status] || ADJ_STATUS.pending;
                return (
                  <tr key={adj.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{fmtDate(adj.requestedAt)}</td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{b?.supplierBundleCode || b?.bundleCode || `#${adj.bundleId}`}</td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>{adj.type === 'close_bundle' ? 'Đóng kiện' : 'Điều chỉnh'}</td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{adj.oldBoards}→{adj.newBoards}</td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{adj.oldVolume?.toFixed(4)}→{adj.newVolume?.toFixed(4)}</td>
                    <td title={adj.reason} style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.reason}</td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 3, background: st.bg, color: st.color, fontSize: "0.62rem", fontWeight: 700 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid var(--bd)", color: "var(--tm)" }}>{adj.approvedBy || adj.requestedBy || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog điều chỉnh kiện ── */}
      <Dialog open={!!showAdjust} onClose={() => setShowAdjust(null)} title="Điều chỉnh tồn kho" width={560} noEnter>
        {showAdjust && (() => {
          const b = showAdjust;
          const newBoardsNum = parseInt(adjFm.newBoards) || 0;
          const newVolNum = parseFloat(adjFm.newVolume) || 0;
          const boardDiff = newBoardsNum - b.remainingBoards;
          const volDiff = newVolNum - (b.remainingVolume || 0);
          const boardPct = b.boardCount > 0 ? (Math.abs(boardDiff) / b.boardCount * 100).toFixed(1) : '0';
          const volPct = b.volume > 0 ? (Math.abs(volDiff) / b.volume * 100).toFixed(1) : '0';
          const boardOver = parseFloat(boardPct) > 2;
          const volOver = parseFloat(volPct) > 5;
          const totalSoldBoards = salesHistory.reduce((s, x) => s + x.boardCount, 0);
          const totalSoldVol = salesHistory.reduce((s, x) => s + x.volume, 0);

          return (
            <div>
              {/* Bundle info */}
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bgs)", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--br)", marginBottom: 4 }}>{b.supplierBundleCode || b.bundleCode}</div>
                <div style={{ display: "flex", gap: 16, fontSize: "0.76rem", flexWrap: "wrap" }}>
                  <span><b>Loại gỗ:</b> {getWoodName(b.woodId)}</span>
                  {b.supplierBoards != null && <span><b>Tấm NCC:</b> {b.supplierBoards}</span>}
                  <span><b>Tấm NT:</b> {b.boardCount}</span>
                  <span><b>Còn lại:</b> {b.remainingBoards} tấm / {(b.remainingVolume || 0).toFixed(4)} m³</span>
                </div>
              </div>

              {/* Sales history */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Lịch sử bán lẻ</div>
                {loadingSales ? (
                  <div style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Đang tải...</div>
                ) : salesHistory.length === 0 ? (
                  <div style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Chưa có đơn bán lẻ</div>
                ) : (
                  <div style={{ maxHeight: 150, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 5 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" }}>
                      <thead>
                        <tr style={{ background: "var(--bgh)" }}>
                          <th style={{ padding: "3px 6px", textAlign: "left", fontSize: "0.58rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)" }}>Đơn hàng</th>
                          <th style={{ padding: "3px 6px", textAlign: "right", fontSize: "0.58rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)" }}>Tấm</th>
                          <th style={{ padding: "3px 6px", textAlign: "right", fontSize: "0.58rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)" }}>KL (m³)</th>
                          <th style={{ padding: "3px 6px", textAlign: "left", fontSize: "0.58rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)" }}>Ngày</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesHistory.map((s, i) => (
                          <tr key={s.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                            <td style={{ padding: "2px 6px", borderBottom: "1px solid var(--bd)" }}>#{s.orderId}</td>
                            <td style={{ padding: "2px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{s.boardCount}</td>
                            <td style={{ padding: "2px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{s.volume.toFixed(4)}</td>
                            <td style={{ padding: "2px 6px", borderBottom: "1px solid var(--bd)" }}>{fmtDate(s.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "var(--bgh)" }}>
                          <td style={{ padding: "3px 6px", fontWeight: 700, fontSize: "0.62rem", borderTop: "1.5px solid var(--bds)" }}>Tổng bán:</td>
                          <td style={{ padding: "3px 6px", textAlign: "right", fontWeight: 700, borderTop: "1.5px solid var(--bds)" }}>{totalSoldBoards}</td>
                          <td style={{ padding: "3px 6px", textAlign: "right", fontWeight: 700, borderTop: "1.5px solid var(--bds)" }}>{totalSoldVol.toFixed(4)}</td>
                          <td style={{ borderTop: "1.5px solid var(--bds)" }} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Adjust form */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={lbl}>Tấm mới</label>
                  <input type="number" value={adjFm.newBoards} onChange={e => setAdjFm(p => ({ ...p, newBoards: e.target.value }))}
                    style={{ ...inp, width: "100%", textAlign: "right", borderColor: boardOver ? "var(--dg)" : "var(--bd)" }} />
                  <div style={{ fontSize: "0.65rem", marginTop: 2, color: boardOver ? "var(--dg)" : "var(--tm)", fontWeight: boardOver ? 700 : 400 }}>
                    Lệch: {boardDiff > 0 ? '+' : ''}{boardDiff} ({boardPct}%){boardOver ? ' — vượt 2%!' : ''}
                  </div>
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={lbl}>KL mới (m³)</label>
                  <input type="number" step="0.0001" value={adjFm.newVolume} onChange={e => setAdjFm(p => ({ ...p, newVolume: e.target.value }))}
                    style={{ ...inp, width: "100%", textAlign: "right", borderColor: volOver ? "var(--dg)" : "var(--bd)" }} />
                  <div style={{ fontSize: "0.65rem", marginTop: 2, color: volOver ? "var(--dg)" : "var(--tm)", fontWeight: volOver ? 700 : 400 }}>
                    Lệch: {volDiff > 0 ? '+' : ''}{volDiff.toFixed(4)} ({volPct}%){volOver ? ' — vượt 5%!' : ''}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button onClick={() => setAdjFm(p => ({ ...p, newBoards: '0', newVolume: '0' }))}
                    style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "var(--bgs)", color: "var(--ts)", cursor: "pointer", fontSize: "0.65rem" }}>
                    Đóng kiện (về 0)
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Lý do điều chỉnh *</label>
                <textarea value={adjFm.reason} onChange={e => setAdjFm(p => ({ ...p, reason: e.target.value }))} rows={3}
                  placeholder="Mô tả chi tiết: kiểm tra các đơn bán lẻ, nguyên nhân chênh lệch..."
                  style={{ ...inp, width: "100%", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAdjust(null)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
                <button onClick={handleRequestAdjust} disabled={saving || boardOver || volOver}
                  style={{ padding: "6px 18px", borderRadius: 6, background: (boardOver || volOver) ? "var(--tm)" : "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
                  {saving ? 'Đang gửi...' : 'Gửi phiếu điều chỉnh'}
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* ── Dialog báo cáo tuần ── */}
      <Dialog open={showReport} onClose={() => setShowReport(false)} title="Báo cáo kiện bán lẻ hết trong tuần" width={780} noEnter>
        {reportData.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.76rem" }}>Không có kiện nào bán lẻ hết trong tuần này</div>
        ) : (
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 8 }}>{reportData.length} kiện bán lẻ hết</div>
            <div style={{ maxHeight: 500, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "var(--bgh)", position: "sticky", top: 0 }}>
                    {['#', 'Mã kiện', 'Loại gỗ', 'Tấm NCC', 'Tấm NT', 'Tấm còn', 'KL NCC', 'KL ban đầu', 'KL còn', 'Lệch tấm', 'Lệch KL'].map((h, i) => (
                      <th key={i} style={{ padding: "4px 6px", textAlign: i >= 3 ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((b, i) => {
                    const soldBoards = b.boardCount - b.remainingBoards;
                    const soldVol = b.volume - b.remainingVolume;
                    const boardDiffNcc = b.supplierBoards != null ? soldBoards - b.supplierBoards : null;
                    const volDiffNcc = b.supplierVolume != null ? soldVol - b.supplierVolume : null;
                    return (
                      <tr key={b.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.62rem", color: "var(--tm)", textAlign: "center" }}>{i + 1}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{b.supplierBundleCode || b.bundleCode}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{getWoodName(b.woodId)}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{b.supplierBoards ?? '—'}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{b.boardCount}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingBoards < 0 ? "var(--dg)" : b.remainingBoards > 0 ? "#D4A017" : "var(--gn)" }}>{b.remainingBoards}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{b.supplierVolume != null ? b.supplierVolume.toFixed(4) : '—'}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{b.volume.toFixed(4)}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingVolume < 0 ? "var(--dg)" : b.remainingVolume > 0.01 ? "#D4A017" : "var(--gn)" }}>{b.remainingVolume.toFixed(4)}</td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: boardDiffNcc != null ? (boardDiffNcc > 0 ? "var(--dg)" : "var(--gn)") : "var(--tm)" }}>
                          {boardDiffNcc != null ? `${boardDiffNcc > 0 ? '+' : ''}${boardDiffNcc}` : '—'}
                        </td>
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: volDiffNcc != null ? (volDiffNcc > 0 ? "var(--dg)" : "var(--gn)") : "var(--tm)" }}>
                          {volDiffNcc != null ? `${volDiffNcc > 0 ? '+' : ''}${volDiffNcc.toFixed(4)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={5} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.62rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng:</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, borderTop: "2px solid var(--bds)" }}>{reportData.reduce((s, b) => s + b.remainingBoards, 0)}</td>
                    <td style={{ borderTop: "2px solid var(--bds)" }} />
                    <td style={{ borderTop: "2px solid var(--bds)" }} />
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, borderTop: "2px solid var(--bds)" }}>{reportData.reduce((s, b) => s + b.remainingVolume, 0).toFixed(4)}</td>
                    <td colSpan={2} style={{ borderTop: "2px solid var(--bds)" }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
