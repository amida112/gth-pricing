import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dialog from './Dialog';
import useTableSort from '../useTableSort';
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
  const [bundleCheckMap, setBundleCheckMap] = useState({}); // bundleId → { check, measuredBy, updatedAt }
  const [showAdjust, setShowAdjust] = useState(null); // bundle to adjust
  const [fSearch, setFSearch] = useState(''); // filter search mã kiện
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
      const sb = (await import('../api/client.js')).default;
      const [adjs, count] = await Promise.all([
        api.fetchInventoryAdjustments(),
        api.fetchPendingAdjustmentsCount(),
      ]);
      setAdjustments(adjs);
      setPendingCount(count);
      // Load bundle_check map: lấy bundle_check mới nhất per bundle_id
      const { data: checks } = await sb.from('bundle_measurements')
        .select('bundle_id, bundle_check, measured_by, updated_at')
        .eq('deleted', false)
        .not('bundle_id', 'is', null)
        .in('bundle_check', ['Kiện lẻ', 'Lẻ hết'])
        .order('updated_at', { ascending: false });
      const map = {};
      (checks || []).forEach(r => {
        if (!map[r.bundle_id] || r.bundle_check === 'Lẻ hết') {
          map[r.bundle_id] = { check: r.bundle_check, measuredBy: r.measured_by, updatedAt: r.updated_at };
        }
      });
      setBundleCheckMap(map);
    } catch (e) { notify('Lỗi tải dữ liệu cân kho: ' + e.message, false); }
    setLoading(false);
  }, [useAPI, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Kiện bất thường
  const anomalies = useMemo(() => {
    return bundles.filter(b => {
      if (b.status === 'Đã bán') return false;
      if (b.status === 'Chưa xếp') return false;
      const negBoards = b.remainingBoards < 0;
      const negVol = b.remainingVolume < 0;
      const zeroBoards = b.remainingBoards === 0 && b.remainingVolume > 0.01;
      const zeroVol = b.remainingVolume <= 0 && b.remainingBoards > 0;
      const nearEmpty = b.boardCount > 0 && b.remainingBoards > 0 && b.remainingBoards / b.boardCount < 0.1;
      const reportedEmpty = bundleCheckMap[b.id]?.check === 'Lẻ hết';
      return negBoards || negVol || zeroBoards || zeroVol || nearEmpty || reportedEmpty;
    }).map(b => {
      const issues = [];
      if (b.remainingBoards < 0) issues.push('Âm tấm');
      if (b.remainingVolume < 0) issues.push('Âm KL');
      if (b.remainingBoards === 0 && b.remainingVolume > 0.01) issues.push('Hết tấm còn KL');
      if (b.remainingVolume <= 0 && b.remainingBoards > 0) issues.push('Hết KL còn tấm');
      if (b.boardCount > 0 && b.remainingBoards > 0 && b.remainingBoards / b.boardCount < 0.1 && !issues.length) issues.push('Gần hết');
      if (bundleCheckMap[b.id]?.check === 'Lẻ hết') issues.push('Báo lẻ hết');
      return { ...b, issues, bundleCheck: bundleCheckMap[b.id] || null };
    });
  }, [bundles, bundleCheckMap]);

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
  const getAttr = (b, key) => b?.attributes?.[key] || '—';

  // Sort hooks
  const anomalySort = useTableSort('bundleCode', 'asc');
  const historySort = useTableSort('requestedAt', 'desc');

  // Sorted anomalies
  const sortedAnomalies = useMemo(() => {
    let arr = anomalies;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      arr = arr.filter(b => (b.bundleCode || '').toLowerCase().includes(q) || (b.supplierBundleCode || '').toLowerCase().includes(q));
    }
    return anomalySort.applySort(arr, (a, b) => {
      const f = anomalySort.sortField;
      if (f === 'woodId') return getWoodName(a.woodId).localeCompare(getWoodName(b.woodId));
      if (f === 'thickness') return (parseFloat(a.attributes?.thickness) || 0) - (parseFloat(b.attributes?.thickness) || 0);
      if (f === 'quality') return (a.attributes?.quality || '').localeCompare(b.attributes?.quality || '');
      if (f === 'remainingBoards') return a.remainingBoards - b.remainingBoards;
      if (f === 'remainingVolume') return (a.remainingVolume || 0) - (b.remainingVolume || 0);
      return (a.bundleCode || '').localeCompare(b.bundleCode || '');
    });
  }, [anomalies, fSearch, anomalySort.sortField, anomalySort.sortDir]); // eslint-disable-line

  // Sorted history
  const sortedHistory = useMemo(() => {
    return historySort.applySort(adjustments, (a, b) => {
      const f = historySort.sortField;
      const ba = bundles.find(x => x.id === a.bundleId);
      const bb = bundles.find(x => x.id === b.bundleId);
      if (f === 'woodId') return getWoodName(ba?.woodId).localeCompare(getWoodName(bb?.woodId));
      if (f === 'thickness') return (parseFloat(ba?.attributes?.thickness) || 0) - (parseFloat(bb?.attributes?.thickness) || 0);
      if (f === 'quality') return (ba?.attributes?.quality || '').localeCompare(bb?.attributes?.quality || '');
      if (f === 'bundleCode') return (ba?.bundleCode || '').localeCompare(bb?.bundleCode || '');
      if (f === 'status') return (a.status || '').localeCompare(b.status || '');
      return new Date(b.requestedAt) - new Date(a.requestedAt); // default: newest first
    });
  }, [adjustments, bundles, historySort.sortField, historySort.sortDir]); // eslint-disable-line

  const [expandedAdj, setExpandedAdj] = useState(null);

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
          <div>
          <div style={{ marginBottom: 8 }}>
            <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Tìm mã kiện / mã NCC..." style={{ padding: '5px 10px', borderRadius: 5, border: '1.5px solid var(--bd)', fontSize: '0.74rem', outline: 'none', width: 220, background: 'var(--bgc)' }} />
            {fSearch && <button onClick={() => setFSearch('')} style={{ marginLeft: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '0.68rem' }}>✕</button>}
          </div>
          <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: 800 }}>
              <thead>
                <tr style={{ background: "var(--bgh)" }}>
                  <th style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", width: 30 }}>#</th>
                  <th onClick={() => anomalySort.toggleSort('bundleCode')} style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>Mã kiện{anomalySort.sortIcon('bundleCode')}</th>
                  <th onClick={() => anomalySort.toggleSort('woodId')} style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>Loại gỗ{anomalySort.sortIcon('woodId')}</th>
                  <th onClick={() => anomalySort.toggleSort('thickness')} style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>Dày{anomalySort.sortIcon('thickness')}</th>
                  <th onClick={() => anomalySort.toggleSort('quality')} style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>CL{anomalySort.sortIcon('quality')}</th>
                  <th onClick={() => anomalySort.toggleSort('remainingBoards')} style={{ padding: "5px 6px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>Tấm còn{anomalySort.sortIcon('remainingBoards')}</th>
                  <th onClick={() => anomalySort.toggleSort('remainingVolume')} style={{ padding: "5px 6px", textAlign: "right", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: "pointer" }}>KL còn{anomalySort.sortIcon('remainingVolume')}</th>
                  <th style={{ padding: "5px 6px", textAlign: "center", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>TT thực tế</th>
                  <th style={{ padding: "5px 6px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>Vấn đề</th>
                  <th style={{ padding: "5px 6px", borderBottom: "1.5px solid var(--bds)", width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {sortedAnomalies.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.65rem", color: "var(--tm)", textAlign: "center", width: 30 }}>{i + 1}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 700, color: "var(--br)", whiteSpace: "nowrap" }}>
                      {b.bundleCode}
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{getWoodName(b.woodId)}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{getAttr(b, 'thickness')}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{getAttr(b, 'quality')}</td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingBoards < 0 ? "var(--dg)" : "var(--br)" }}>
                      {b.remainingBoards}<span style={{ color: "var(--tm)", fontSize: "0.62rem" }}>/{b.boardCount}</span>
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: b.remainingVolume < 0 ? "var(--dg)" : "var(--br)" }}>
                      {(b.remainingVolume || 0).toFixed(4)}<span style={{ color: "var(--tm)", fontSize: "0.62rem" }}>/{(b.volume || 0).toFixed(4)}</span>
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                      {b.bundleCheck ? (
                        <span title={b.bundleCheck.measuredBy ? `${b.bundleCheck.measuredBy} · ${fmtDate(b.bundleCheck.updatedAt)}` : ''} style={{ padding: "1px 6px", borderRadius: 3, fontSize: "0.62rem", fontWeight: 700, background: b.bundleCheck.check === 'Lẻ hết' ? 'rgba(192,57,43,0.12)' : 'rgba(212,160,23,0.12)', color: b.bundleCheck.check === 'Lẻ hết' ? '#c0392b' : '#B8860B' }}>{b.bundleCheck.check}</span>
                      ) : <span style={{ fontSize: "0.62rem", color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ padding: "5px 6px", borderBottom: "1px solid var(--bd)" }}>
                      {b.issues.map((issue, j) => (
                        <span key={j} style={{ padding: "1px 5px", borderRadius: 3, background: issue === 'Báo lẻ hết' ? "rgba(192,57,43,0.08)" : "rgba(231,76,60,0.08)", color: issue === 'Báo lẻ hết' ? "#c0392b" : "var(--dg)", fontSize: "0.62rem", fontWeight: 600, marginRight: 3 }}>{issue}</span>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "var(--br)", fontSize: "0.82rem" }}>{b?.bundleCode || `Bundle #${adj.bundleId}`}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--tm)" }}>{getWoodName(b?.woodId)}</span>
                      {b?.attributes?.thickness && <span style={{ padding: "1px 6px", borderRadius: 3, background: "rgba(50,79,39,0.08)", color: "var(--br)", fontSize: "0.62rem", fontWeight: 600 }}>{b.attributes.thickness}</span>}
                      {b?.attributes?.quality && <span style={{ padding: "1px 6px", borderRadius: 3, background: "rgba(124,92,191,0.08)", color: "#7C5CBF", fontSize: "0.62rem", fontWeight: 600 }}>{b.attributes.quality}</span>}
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", minWidth: 750 }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {[
                  { key: 'requestedAt', label: 'Ngày', align: 'left' },
                  { key: 'bundleCode', label: 'Kiện', align: 'left' },
                  { key: 'woodId', label: 'Loại gỗ', align: 'left' },
                  { key: 'thickness', label: 'Dày', align: 'left' },
                  { key: 'quality', label: 'CL', align: 'left' },
                  { key: null, label: 'Loại', align: 'left' },
                  { key: null, label: 'Tấm', align: 'left' },
                  { key: null, label: 'KL', align: 'left' },
                  { key: null, label: 'Lý do', align: 'left' },
                  { key: 'status', label: 'Trạng thái', align: 'left' },
                  { key: null, label: 'Người duyệt', align: 'left' },
                ].map((col, i) => (
                  <th key={i} onClick={col.key ? () => historySort.toggleSort(col.key) : undefined}
                    style={{ padding: "5px 6px", textAlign: col.align, color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", cursor: col.key ? "pointer" : "default" }}>
                    {col.label}{col.key ? historySort.sortIcon(col.key) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedHistory.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 16, textAlign: "center", color: "var(--tm)" }}>Chưa có lịch sử điều chỉnh</td></tr>
              ) : sortedHistory.map((adj, i) => {
                const b = bundles.find(x => x.id === adj.bundleId);
                const st = ADJ_STATUS[adj.status] || ADJ_STATUS.pending;
                const isExpanded = expandedAdj === adj.id;
                const bd = { padding: "4px 6px", borderBottom: isExpanded ? "none" : "1px solid var(--bd)" };
                return (
                  <React.Fragment key={adj.id}>
                    <tr onClick={() => setExpandedAdj(isExpanded ? null : adj.id)} data-clickable="true"
                      style={{ background: i % 2 ? "var(--bgs)" : "#fff", cursor: "pointer" }}>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{fmtDate(adj.requestedAt)}</td>
                      <td style={{ ...bd, fontWeight: 600 }}>{b?.bundleCode || `#${adj.bundleId}`}</td>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{getWoodName(b?.woodId)}</td>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{getAttr(b, 'thickness')}</td>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{getAttr(b, 'quality')}</td>
                      <td style={bd}>{adj.type === 'close_bundle' ? 'Đóng kiện' : 'Điều chỉnh'}</td>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{adj.oldBoards}→{adj.newBoards}</td>
                      <td style={{ ...bd, whiteSpace: "nowrap" }}>{adj.oldVolume?.toFixed(4)}→{adj.newVolume?.toFixed(4)}</td>
                      <td title={adj.reason} style={{ ...bd, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.reason}</td>
                      <td style={bd}>
                        <span style={{ padding: "1px 5px", borderRadius: 3, background: st.bg, color: st.color, fontSize: "0.62rem", fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={{ ...bd, color: "var(--tm)" }}>{adj.approvedBy || adj.requestedBy || '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                        <td colSpan={11} style={{ padding: "6px 12px 10px", borderBottom: "1px solid var(--bd)" }}>
                          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(50,79,39,0.04)", border: "1px solid var(--bd)" }}>
                            <div style={{ fontSize: "0.7rem", marginBottom: 4 }}><b>Lý do điều chỉnh:</b> {adj.reason}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--tm)" }}>
                              <b>Người yêu cầu:</b> {adj.requestedBy || '—'} · <b>Ngày:</b> {fmtDate(adj.requestedAt)}
                              {adj.approvedBy && <> · <b>Người duyệt:</b> {adj.approvedBy} · <b>Ngày duyệt:</b> {fmtDate(adj.approvedAt)}</>}
                            </div>
                            {adj.status === 'rejected' && adj.rejectionReason && (
                              <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 5, background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.15)" }}>
                                <span style={{ fontSize: "0.68rem", color: "#c0392b", fontWeight: 700 }}>Lý do từ chối:</span>
                                <span style={{ fontSize: "0.7rem", color: "#c0392b", marginLeft: 6 }}>{adj.rejectionReason}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
                <div style={{ fontWeight: 700, color: "var(--br)", marginBottom: 4 }}>{b.bundleCode}</div>
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
                        <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{b.bundleCode}</td>
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
