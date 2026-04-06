import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dialog from './Dialog';

/**
 * SawnInspectionTab — Tab nghiệm thu kiện gỗ xẻ NK trong ContainerDetail
 *
 * Props:
 *  - container: container object
 *  - containerItems: danh sách container_items
 *  - wts: danh sách loại gỗ
 *  - suppliers: danh sách nhà cung cấp
 *  - ce: quyền sửa
 *  - isAdmin: admin role
 *  - user: { username, role }
 *  - useAPI: boolean
 *  - notify: (msg, ok) => void
 */

const INSP_STATUS = {
  pending:   { label: 'Chờ NT', color: '#A89B8E', bg: 'rgba(168,155,142,0.1)' },
  inspected: { label: 'Đã NT', color: '#2980b9', bg: 'rgba(41,128,185,0.1)' },
  approved:  { label: 'Đã duyệt', color: '#324F27', bg: 'rgba(50,79,39,0.1)' },
  hold:      { label: 'Giữ lại', color: '#D4A017', bg: 'rgba(212,160,23,0.1)' },
  imported:  { label: 'Đã nhập kho', color: '#6B4226', bg: 'rgba(107,66,38,0.1)' },
};
const stCfg = (s) => INSP_STATUS[s] || INSP_STATUS.pending;

// Parse CSV/TSV text → rows
function parsePastedData(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  // Detect separator: tab or comma
  const sep = lines[0].includes('\t') ? '\t' : ',';
  return lines.map(line => {
    const cols = line.split(sep).map(c => c.trim());
    // Columns: mã kiện, độ dày, độ rộng, độ dài, chất lượng, khối lượng, nhà cung cấp
    return {
      supplierBundleCode: cols[0] || '',
      supplierThickness: cols[1] || '',
      supplierWidth: cols[2] || '',
      supplierLength: cols[3] || '',
      supplierQuality: cols[4] || '',
      supplierVolume: cols[5] ? parseFloat(cols[5].replace(',', '.')) || null : null,
      supplierNcc: cols[6] || '',
    };
  }).filter(r => r.supplierBundleCode); // bỏ dòng trống
}

export default function SawnInspectionTab({ container, containerItems, wts, suppliers, cfg, ce, isAdmin, user, useAPI, notify, onBundlesImported }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importErr, setImportErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null); // id kiện đang sửa nghiệm thu
  const [inspFm, setInspFm] = useState({ inspectedBoards: '', inspectedLength: '', inspectionNotes: '' });
  const [showApprove, setShowApprove] = useState(false);
  const [holdIds, setHoldIds] = useState(new Set());
  const [addManual, setAddManual] = useState(false);
  const [manualFm, setManualFm] = useState({ supplierBundleCode: '', supplierThickness: '', supplierWidth: '', supplierLength: '', supplierQuality: '', supplierVolume: '', supplierBoards: '', supplierNcc: '', woodId: '' });
  // GĐ2: Nhập kho hàng loạt
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [whSelectedIds, setWhSelectedIds] = useState(new Set());
  const [whCommon, setWhCommon] = useState({ location: '', notes: '' });

  // Load inspections
  const loadData = useCallback(async () => {
    if (!useAPI) { setLoading(false); return; }
    try {
      const api = await import('../api.js');
      const data = await api.fetchSawnInspections(container.id);
      setInspections(data);
    } catch (e) { notify('Lỗi tải nghiệm thu: ' + e.message, false); }
    setLoading(false);
  }, [container.id, useAPI, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Summary stats
  const summary = useMemo(() => {
    const s = { total: 0, pending: 0, inspected: 0, approved: 0, hold: 0, imported: 0, supplierBoards: 0, supplierVolume: 0, inspectedBoards: 0 };
    for (const r of inspections) {
      s.total++;
      s[r.status] = (s[r.status] || 0) + 1;
      s.supplierBoards += r.supplierBoards || 0;
      s.supplierVolume += r.supplierVolume || 0;
      s.inspectedBoards += r.inspectedBoards || 0;
    }
    return s;
  }, [inspections]);

  // ── Import packing list ──
  const handleParse = () => {
    setImportErr('');
    const rows = parsePastedData(pasteText);
    if (!rows.length) { setImportErr('Không tìm thấy dữ liệu. Cần ít nhất cột: Mã kiện'); return; }
    setParsedRows(rows);
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setSaving(true);
    try {
      const api = await import('../api.js');
      // Gán woodId từ container items nếu có
      const defaultWoodId = containerItems?.[0]?.woodId || '';
      const rows = parsedRows.map(r => ({ ...r, woodId: defaultWoodId }));
      const result = await api.importSawnPackingList(container.id, rows);
      if (result.error) { setImportErr(result.error); setSaving(false); return; }
      notify(`Đã import ${result.count} kiện từ packing list`);
      setShowImport(false); setPasteText(''); setParsedRows([]);
      loadData();
    } catch (e) { setImportErr('Lỗi: ' + e.message); }
    setSaving(false);
  };

  // ── Thêm thủ công ──
  const handleAddManual = async () => {
    if (!manualFm.supplierBundleCode.trim()) { notify('Nhập mã kiện NCC', false); return; }
    setSaving(true);
    try {
      const api = await import('../api.js');
      const defaultWoodId = containerItems?.[0]?.woodId || '';
      const result = await api.addSawnInspection(container.id, {
        ...manualFm,
        supplierVolume: manualFm.supplierVolume ? parseFloat(manualFm.supplierVolume) : null,
        supplierBoards: manualFm.supplierBoards ? parseInt(manualFm.supplierBoards) : null,
        woodId: manualFm.woodId || defaultWoodId,
      });
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify('Đã thêm kiện ' + manualFm.supplierBundleCode);
      setAddManual(false);
      setManualFm({ supplierBundleCode: '', supplierThickness: '', supplierWidth: '', supplierLength: '', supplierQuality: '', supplierVolume: '', supplierBoards: '', supplierNcc: '', woodId: '' });
      loadData();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // ── Submit nghiệm thu 1 kiện ──
  const openInspect = (rec) => {
    setEditId(rec.id);
    setInspFm({
      inspectedBoards: rec.inspectedBoards != null ? String(rec.inspectedBoards) : '',
      inspectedLength: rec.inspectedLength || rec.supplierLength || '',
      inspectionNotes: rec.inspectionNotes || '',
    });
  };

  const handleSubmitInspect = async () => {
    if (!inspFm.inspectedBoards) { notify('Nhập số tấm đếm được', false); return; }
    setSaving(true);
    try {
      const api = await import('../api.js');
      const result = await api.submitSawnInspection(editId, {
        inspectedBoards: parseInt(inspFm.inspectedBoards),
        inspectedLength: inspFm.inspectedLength || null,
        inspectionNotes: inspFm.inspectionNotes || null,
        inspectedBy: user?.username || null,
      });
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify('Đã lưu nghiệm thu');
      setEditId(null);
      loadData();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // ── Sếp duyệt ──
  const handleApprove = async () => {
    setSaving(true);
    try {
      const api = await import('../api.js');
      const result = await api.approveSawnInspections(container.id, user?.username || 'admin', [...holdIds]);
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      const holdCount = holdIds.size;
      notify(`Đã duyệt nghiệm thu${holdCount > 0 ? ` (${holdCount} kiện giữ lại)` : ''}`);
      setShowApprove(false); setHoldIds(new Set());
      loadData();
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  // ── Xóa 1 kiện ──
  const handleDelete = async (id) => {
    if (!window.confirm('Xóa kiện nghiệm thu này?')) return;
    try {
      const api = await import('../api.js');
      const r = await api.deleteSawnInspection(id);
      if (r.error) { notify(r.error, false); return; }
      setInspections(p => p.filter(x => x.id !== id));
      notify('Đã xóa');
    } catch (e) { notify('Lỗi: ' + e.message, false); }
  };

  // ── GĐ2: Nhập kho hàng loạt ──
  const approvedInsp = useMemo(() => inspections.filter(r => r.status === 'approved'), [inspections]);
  const canImportWarehouse = ce && approvedInsp.length > 0;

  const openWarehouseImport = () => {
    setWhSelectedIds(new Set(approvedInsp.map(r => r.id)));
    setWhCommon({ location: '', notes: '' });
    setShowWarehouse(true);
  };

  // Build attributes cho 1 kiện từ inspection data + wood config
  const buildBundleAttrs = useCallback((rec) => {
    const woodId = rec.woodId || containerItems?.[0]?.woodId || '';
    const woodCfg = cfg?.[woodId] || { attrs: [], attrValues: {} };
    const attrs = {};
    const rawMeasurements = {};

    for (const atId of (woodCfg.attrs || [])) {
      if (atId === 'thickness' && rec.supplierThickness) {
        // Normalize thickness: "4/4" → match config values
        const raw = rec.supplierThickness.trim();
        const vals = woodCfg.attrValues?.thickness || [];
        const match = vals.find(v => v.toLowerCase() === raw.toLowerCase() || v.replace(/F$/i, '') === raw.replace(/\/4$/i, '').replace(/F$/i, ''));
        attrs.thickness = match || raw;
      } else if (atId === 'quality' && rec.supplierQuality) {
        const raw = rec.supplierQuality.trim();
        const vals = woodCfg.attrValues?.quality || [];
        const match = vals.find(v => v.toLowerCase() === raw.toLowerCase());
        attrs.quality = match || raw;
      } else if (atId === 'length' && rec.supplierLength) {
        const raw = rec.supplierLength.trim();
        // Try match range groups
        const rangeGroups = woodCfg.rangeGroups?.length;
        if (rangeGroups?.length) {
          const match = rangeGroups.find(g => g.label === raw);
          attrs.length = match ? match.label : raw;
        } else {
          const vals = woodCfg.attrValues?.length || [];
          const match = vals.find(v => v === raw);
          attrs.length = match || raw;
        }
        rawMeasurements.length = raw;
      } else if (atId === 'width' && rec.supplierWidth) {
        attrs.width = rec.supplierWidth.trim();
      } else if (atId === 'supplier' && rec.supplierNcc) {
        const raw = rec.supplierNcc.trim();
        const vals = woodCfg.attrValues?.supplier || [];
        const match = vals.find(v => v.toLowerCase() === raw.toLowerCase());
        attrs.supplier = match || raw;
      }
    }
    return { woodId, attrs, rawMeasurements };
  }, [containerItems, cfg]);

  const handleWarehouseImport = async () => {
    const selected = approvedInsp.filter(r => whSelectedIds.has(r.id));
    if (!selected.length) { notify('Chọn ít nhất 1 kiện', false); return; }

    setSaving(true);
    try {
      const api = await import('../api.js');
      const bundles = selected.map(rec => {
        const { woodId, attrs, rawMeasurements } = buildBundleAttrs(rec);
        const skuKey = Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
        return {
          inspectionId: rec.id,
          woodId,
          containerId: container.id,
          attributes: attrs,
          skuKey,
          boardCount: rec.inspectedBoards || rec.supplierBoards || 0,
          volume: rec.supplierVolume || 0,
          supplierBoards: rec.supplierBoards || null,
          supplierVolume: rec.supplierVolume || null,
          supplierBundleCode: rec.supplierBundleCode,
          location: whCommon.location || null,
          notes: whCommon.notes || null,
          rawMeasurements: Object.keys(rawMeasurements).length ? rawMeasurements : undefined,
        };
      });

      const result = await api.batchImportToWarehouse(bundles);
      if (result.error) { notify(result.error, false); setSaving(false); return; }
      notify(`Đã nhập kho ${result.imported} kiện${result.failed ? ` (${result.failed} lỗi)` : ''}`);
      if (result.errors?.length) {
        result.errors.forEach(e => notify(`Lỗi kiện ${e.code}: ${e.error}`, false));
      }
      setShowWarehouse(false);
      loadData();
      if (onBundlesImported) onBundlesImported(result.results);
    } catch (e) { notify('Lỗi: ' + e.message, false); }
    setSaving(false);
  };

  const inp = { padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", outline: "none", background: "var(--bgc)", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--brl)", marginBottom: 3 };

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.76rem" }}>Đang tải nghiệm thu...</div>;

  const canApprove = isAdmin && inspections.some(r => r.status === 'inspected');
  const allPending = inspections.length > 0 && inspections.every(r => r.status === 'pending');

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase" }}>
          Nghiệm thu kiện ({summary.total} kiện)
        </span>
        <span style={{ flex: 1 }} />
        {ce && (
          <>
            <button onClick={() => { setShowImport(true); setPasteText(''); setParsedRows([]); setImportErr(''); }}
              style={{ padding: "4px 12px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>
              Import Packing List
            </button>
            <button onClick={() => setAddManual(true)}
              style={{ padding: "4px 12px", borderRadius: 5, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>
              + Thêm kiện
            </button>
          </>
        )}
        {canApprove && (
          <button onClick={() => { setShowApprove(true); setHoldIds(new Set()); }}
            style={{ padding: "4px 12px", borderRadius: 5, background: "#324F27", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem" }}>
            Duyệt nghiệm thu
          </button>
        )}
        {canImportWarehouse && (
          <button onClick={openWarehouseImport}
            style={{ padding: "4px 12px", borderRadius: 5, background: "#6B4226", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.7rem" }}>
            Nhập kho ({approvedInsp.length})
          </button>
        )}
      </div>

      {/* Summary bar */}
      {inspections.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, padding: "8px 12px", borderRadius: 7, background: "var(--bgs)", border: "1px solid var(--bd)" }}>
          <StatItem label="Tổng kiện" value={summary.total} />
          <StatItem label="Chờ NT" value={summary.pending} color="#A89B8E" />
          <StatItem label="Đã NT" value={summary.inspected} color="#2980b9" />
          <StatItem label="Đã duyệt" value={summary.approved} color="#324F27" />
          {summary.hold > 0 && <StatItem label="Giữ lại" value={summary.hold} color="#D4A017" />}
          {summary.imported > 0 && <StatItem label="Đã nhập kho" value={summary.imported} color="#6B4226" />}
          <div style={{ borderLeft: "1px solid var(--bd)", margin: "0 4px" }} />
          <StatItem label="Tấm NCC" value={summary.supplierBoards.toLocaleString('vi-VN')} />
          {summary.inspectedBoards > 0 && (
            <>
              <StatItem label="Tấm TT" value={summary.inspectedBoards.toLocaleString('vi-VN')} />
              <StatItem
                label="Lệch"
                value={`${summary.inspectedBoards - summary.supplierBoards > 0 ? '+' : ''}${(summary.inspectedBoards - summary.supplierBoards).toLocaleString('vi-VN')} (${summary.supplierBoards ? ((summary.inspectedBoards - summary.supplierBoards) / summary.supplierBoards * 100).toFixed(1) : 0}%)`}
                color={summary.inspectedBoards < summary.supplierBoards ? "var(--dg)" : "var(--gn)"}
              />
            </>
          )}
          <div style={{ borderLeft: "1px solid var(--bd)", margin: "0 4px" }} />
          <StatItem label="KL NCC" value={`${summary.supplierVolume.toFixed(4)} m³`} />
        </div>
      )}

      {/* Inspection table */}
      {inspections.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.76rem", border: "1.5px dashed var(--bd)", borderRadius: 7, background: "var(--bgs)" }}>
          Chưa có kiện nào. Import packing list NCC hoặc thêm thủ công.
        </div>
      ) : (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {['#', 'Mã kiện NCC', 'Dày', 'Rộng', 'Dài NCC', 'CL', 'KL (m³)', 'NCC', 'Tấm NCC', 'Tấm TT', 'Dài TT', 'Lệch', 'Trạng thái', ''].map((h, i) => (
                  <th key={i} style={{ padding: "5px 6px", textAlign: i === 6 || i === 8 || i === 9 || i === 11 ? "right" : "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inspections.map((rec, ri) => {
                const st = stCfg(rec.status);
                const boardDiff = rec.inspectedBoards != null && rec.supplierBoards != null ? rec.inspectedBoards - rec.supplierBoards : null;
                const boardDiffPct = boardDiff != null && rec.supplierBoards ? (boardDiff / rec.supplierBoards * 100).toFixed(1) : null;
                const tdS = { padding: "5px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" };
                return (
                  <tr key={rec.id} style={{ background: ri % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={{ ...tdS, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)", width: 30 }}>{ri + 1}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: "var(--br)" }}>{rec.supplierBundleCode}</td>
                    <td style={tdS}>{rec.supplierThickness || '—'}</td>
                    <td style={tdS}>{rec.supplierWidth || '—'}</td>
                    <td style={tdS}>{rec.supplierLength || '—'}</td>
                    <td style={tdS}>{rec.supplierQuality || '—'}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{rec.supplierVolume != null ? rec.supplierVolume.toFixed(4) : '—'}</td>
                    <td style={tdS}>{rec.supplierNcc || '—'}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{rec.supplierBoards ?? '—'}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: rec.inspectedBoards != null ? "var(--br)" : "var(--tm)" }}>
                      {rec.inspectedBoards != null ? rec.inspectedBoards : '—'}
                    </td>
                    <td style={tdS}>{rec.inspectedLength || '—'}</td>
                    <td style={{ ...tdS, textAlign: "right", color: boardDiff != null ? (boardDiff < 0 ? "var(--dg)" : "var(--gn)") : "var(--tm)", fontWeight: 600 }}>
                      {boardDiff != null ? `${boardDiff > 0 ? '+' : ''}${boardDiff} (${boardDiffPct}%)` : '—'}
                    </td>
                    <td style={tdS}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.color, fontSize: "0.65rem", fontWeight: 700 }}>{st.label}</span>
                      {rec.inspectionNotes && <div title={rec.inspectionNotes} style={{ fontSize: "0.6rem", color: "var(--tm)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{rec.inspectionNotes}</div>}
                    </td>
                    <td style={{ ...tdS, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {ce && (rec.status === 'pending' || rec.status === 'inspected') && (
                          <button onClick={() => openInspect(rec)} title="Nghiệm thu"
                            style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid #2980b9", background: "transparent", color: "#2980b9", cursor: "pointer", fontSize: "0.62rem", fontWeight: 600 }}>
                            {rec.status === 'inspected' ? '✎' : 'NT'}
                          </button>
                        )}
                        {ce && rec.status === 'pending' && (
                          <button onClick={() => handleDelete(rec.id)} title="Xóa"
                            style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bgh)" }}>
                <td colSpan={6} style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>
                  Tổng ({inspections.length} kiện):
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.74rem", borderTop: "2px solid var(--bds)" }}>
                  {summary.supplierVolume.toFixed(4)}
                </td>
                <td style={{ borderTop: "2px solid var(--bds)" }} />
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, borderTop: "2px solid var(--bds)" }}>{summary.supplierBoards}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", borderTop: "2px solid var(--bds)" }}>
                  {summary.inspectedBoards || '—'}
                </td>
                <td colSpan={4} style={{ borderTop: "2px solid var(--bds)" }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Dialog Import Packing List ── */}
      <Dialog open={showImport} onClose={() => setShowImport(false)} title="Import Packing List NCC" width={680} noEnter>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Paste dữ liệu (CSV/Tab) — Cột: Mã kiện, Dày, Rộng, Dài, Chất lượng, Khối lượng, NCC</label>
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setParsedRows([]); setImportErr(''); }}
            placeholder={"OAK-A001\t4/4\t6\"\t2.2-2.5m\tFAS\t1.2500\tMissouri\nOAK-A002\t4/4\t6\"\t2.2-2.5m\tFAS\t0.9800\tMissouri"}
            rows={8}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--bd)", fontSize: "0.78rem", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {pasteText.trim() && !parsedRows.length && (
          <button onClick={handleParse}
            style={{ padding: "6px 16px", borderRadius: 6, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem", marginBottom: 10 }}>
            Phân tích dữ liệu
          </button>
        )}

        {importErr && <div style={{ color: "var(--dg)", fontSize: "0.76rem", marginBottom: 8, padding: "6px 10px", borderRadius: 5, background: "rgba(231,76,60,0.08)" }}>{importErr}</div>}

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--br)", marginBottom: 6 }}>
              Xem trước: {parsedRows.length} kiện
            </div>
            <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 6, marginBottom: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr style={{ background: "var(--bgh)", position: "sticky", top: 0 }}>
                    {['#', 'Mã kiện', 'Dày', 'Rộng', 'Dài', 'CL', 'KL (m³)', 'NCC'].map((h, i) => (
                      <th key={i} style={{ padding: "4px 6px", textAlign: i === 6 ? "right" : "left", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.62rem", color: "var(--tm)", textAlign: "center" }}>{i + 1}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{r.supplierBundleCode}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierThickness}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierWidth}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierLength}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierQuality}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{r.supplierVolume != null ? r.supplierVolume.toFixed(4) : '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierNcc}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={6} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", color: "var(--brl)" }}>Tổng:</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem" }}>
                      {parsedRows.reduce((s, r) => s + (r.supplierVolume || 0), 0).toFixed(4)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setParsedRows([]); setPasteText(''); }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>
                Hủy
              </button>
              <button onClick={handleImport} disabled={saving}
                style={{ padding: "6px 20px", borderRadius: 6, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
                {saving ? 'Đang import...' : `Import ${parsedRows.length} kiện`}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Dialog thêm kiện thủ công ── */}
      <Dialog open={addManual} onClose={() => setAddManual(false)} title="Thêm kiện nghiệm thu" width={520} noEnter>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={lbl}>Mã kiện NCC *</label>
            <input value={manualFm.supplierBundleCode} onChange={e => setManualFm(p => ({ ...p, supplierBundleCode: e.target.value }))} placeholder="VD: OAK-A001" style={{ ...inp, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={lbl}>Số tấm NCC</label>
            <input type="number" value={manualFm.supplierBoards} onChange={e => setManualFm(p => ({ ...p, supplierBoards: e.target.value }))} placeholder="120" style={{ ...inp, width: "100%", textAlign: "right" }} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={lbl}>Khối lượng (m³)</label>
            <input type="number" step="0.0001" value={manualFm.supplierVolume} onChange={e => setManualFm(p => ({ ...p, supplierVolume: e.target.value }))} placeholder="1.2500" style={{ ...inp, width: "100%", textAlign: "right" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 80px" }}>
            <label style={lbl}>Dày</label>
            <input value={manualFm.supplierThickness} onChange={e => setManualFm(p => ({ ...p, supplierThickness: e.target.value }))} placeholder="4/4" style={{ ...inp, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 80px" }}>
            <label style={lbl}>Rộng</label>
            <input value={manualFm.supplierWidth} onChange={e => setManualFm(p => ({ ...p, supplierWidth: e.target.value }))} placeholder='6"' style={{ ...inp, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={lbl}>Dài</label>
            <input value={manualFm.supplierLength} onChange={e => setManualFm(p => ({ ...p, supplierLength: e.target.value }))} placeholder="2.2-2.5m" style={{ ...inp, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 80px" }}>
            <label style={lbl}>Chất lượng</label>
            <input value={manualFm.supplierQuality} onChange={e => setManualFm(p => ({ ...p, supplierQuality: e.target.value }))} placeholder="FAS" style={{ ...inp, width: "100%" }} />
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={lbl}>NCC</label>
            <input value={manualFm.supplierNcc} onChange={e => setManualFm(p => ({ ...p, supplierNcc: e.target.value }))} placeholder="Missouri" style={{ ...inp, width: "100%" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => setAddManual(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
          <button onClick={handleAddManual} disabled={saving}
            style={{ padding: "6px 18px", borderRadius: 6, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
            {saving ? 'Đang lưu...' : 'Thêm'}
          </button>
        </div>
      </Dialog>

      {/* ── Dialog nghiệm thu 1 kiện ── */}
      <Dialog open={!!editId} onClose={() => setEditId(null)} title="Nghiệm thu kiện" width={440} noEnter>
        {editId && (() => {
          const rec = inspections.find(r => r.id === editId);
          if (!rec) return null;
          const boardDiff = inspFm.inspectedBoards && rec.supplierBoards ? parseInt(inspFm.inspectedBoards) - rec.supplierBoards : null;
          const boardDiffPct = boardDiff != null && rec.supplierBoards ? (boardDiff / rec.supplierBoards * 100).toFixed(1) : null;
          return (
            <div>
              {/* Info NCC */}
              <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--bgs)", marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 4, textTransform: "uppercase" }}>Thông tin NCC</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.76rem" }}>
                  <span><b>Mã:</b> {rec.supplierBundleCode}</span>
                  <span><b>Dày:</b> {rec.supplierThickness || '—'}</span>
                  <span><b>Rộng:</b> {rec.supplierWidth || '—'}</span>
                  <span><b>Dài:</b> {rec.supplierLength || '—'}</span>
                  <span><b>CL:</b> {rec.supplierQuality || '—'}</span>
                  <span><b>KL:</b> {rec.supplierVolume != null ? `${rec.supplierVolume.toFixed(4)} m³` : '—'}</span>
                  {rec.supplierBoards != null && <span><b>Tấm NCC:</b> {rec.supplierBoards}</span>}
                </div>
              </div>

              {/* Form nghiệm thu */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={lbl}>Số tấm đếm được *</label>
                  <input type="number" value={inspFm.inspectedBoards} onChange={e => setInspFm(p => ({ ...p, inspectedBoards: e.target.value }))} autoFocus
                    style={{ ...inp, width: "100%", textAlign: "right", fontWeight: 700, fontSize: "0.88rem" }} />
                  {boardDiff != null && (
                    <div style={{ fontSize: "0.7rem", marginTop: 3, color: boardDiff < 0 ? "var(--dg)" : "var(--gn)", fontWeight: 600 }}>
                      Lệch: {boardDiff > 0 ? '+' : ''}{boardDiff} tấm ({boardDiffPct}%)
                    </div>
                  )}
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={lbl}>Chiều dài thực tế</label>
                  <input value={inspFm.inspectedLength} onChange={e => setInspFm(p => ({ ...p, inspectedLength: e.target.value }))} placeholder="2.2-2.5m"
                    style={{ ...inp, width: "100%" }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Ghi chú (tấm vỡ, hư hỏng...)</label>
                <textarea value={inspFm.inspectionNotes} onChange={e => setInspFm(p => ({ ...p, inspectionNotes: e.target.value }))} rows={2} placeholder="VD: 2 tấm vỡ đầu, 1 tấm bị nứt"
                  style={{ ...inp, width: "100%", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setEditId(null)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
                <button onClick={handleSubmitInspect} disabled={saving}
                  style={{ padding: "6px 18px", borderRadius: 6, background: "#2980b9", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
                  {saving ? 'Đang lưu...' : 'Lưu nghiệm thu'}
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* ── Dialog sếp duyệt ── */}
      <Dialog open={showApprove} onClose={() => setShowApprove(false)} title="Duyệt nghiệm thu container" width={620} noEnter>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.76rem", color: "var(--ts)", marginBottom: 8 }}>
            Duyệt tất cả kiện đã nghiệm thu. Tick chọn kiện cần <b>giữ lại (Hold)</b> — không cho bán.
          </div>

          {/* Summary */}
          <div style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 6, background: "var(--bgs)", marginBottom: 10, flexWrap: "wrap", fontSize: "0.76rem" }}>
            <span><b>Tổng kiện:</b> {summary.total}</span>
            <span><b>Đã NT:</b> {summary.inspected}</span>
            <span><b>Chờ NT:</b> {summary.pending}</span>
            {holdIds.size > 0 && <span style={{ color: "#D4A017", fontWeight: 700 }}>Giữ lại: {holdIds.size}</span>}
          </div>

          {/* Danh sách kiện inspected để tick hold */}
          <div style={{ maxHeight: 350, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
              <thead>
                <tr style={{ background: "var(--bgh)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "4px 6px", width: 30, borderBottom: "1px solid var(--bd)" }}>Hold</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Mã kiện</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Tấm NCC</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Tấm TT</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Lệch</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {inspections.filter(r => r.status === 'inspected').map((rec, i) => {
                  const diff = rec.inspectedBoards != null && rec.supplierBoards != null ? rec.inspectedBoards - rec.supplierBoards : null;
                  const isHold = holdIds.has(rec.id);
                  return (
                    <tr key={rec.id} style={{ background: isHold ? "rgba(212,160,23,0.08)" : (i % 2 ? "var(--bgs)" : "#fff") }}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                        <input type="checkbox" checked={isHold} onChange={() => {
                          setHoldIds(p => {
                            const n = new Set(p);
                            if (n.has(rec.id)) n.delete(rec.id); else n.add(rec.id);
                            return n;
                          });
                        }} />
                      </td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{rec.supplierBundleCode}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{rec.supplierBoards ?? '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700 }}>{rec.inspectedBoards ?? '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: diff != null ? (diff < 0 ? "var(--dg)" : "var(--gn)") : "var(--tm)", fontWeight: 600 }}>
                        {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                      </td>
                      <td title={rec.inspectionNotes || ''} style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.inspectionNotes || ''}</td>
                    </tr>
                  );
                })}
                {inspections.filter(r => r.status === 'inspected').length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 12, textAlign: "center", color: "var(--tm)" }}>Không có kiện nào cần duyệt</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Warning nếu còn pending */}
          {summary.pending > 0 && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 5, background: "rgba(212,160,23,0.08)", color: "#D4A017", fontSize: "0.72rem", fontWeight: 600 }}>
              Còn {summary.pending} kiện chưa nghiệm thu — chỉ duyệt các kiện đã NT.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setShowApprove(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
          <button onClick={handleApprove} disabled={saving || !inspections.some(r => r.status === 'inspected')}
            style={{ padding: "6px 18px", borderRadius: 6, background: "#324F27", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
            {saving ? 'Đang duyệt...' : `Duyệt${holdIds.size > 0 ? ` (giữ ${holdIds.size})` : ''}`}
          </button>
        </div>
      </Dialog>

      {/* ── Dialog nhập kho hàng loạt ── */}
      <Dialog open={showWarehouse} onClose={() => setShowWarehouse(false)} title="Nhập kho hàng loạt từ nghiệm thu" width={780} noEnter>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: "0.76rem", color: "var(--ts)", marginBottom: 10 }}>
            Chọn kiện đã duyệt để nhập vào sổ kho. Thuộc tính (dày, CL, dài, NCC) được tự động map từ packing list.
            Có thể sửa vị trí, ghi chú sau khi nhập.
          </div>

          {/* Common fields */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={lbl}>Vị trí kho (gán chung)</label>
              <input value={whCommon.location} onChange={e => setWhCommon(p => ({ ...p, location: e.target.value }))} placeholder="VD: Kho A - Dãy 3"
                style={{ ...inp, width: "100%" }} />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={lbl}>Ghi chú (gán chung)</label>
              <input value={whCommon.notes} onChange={e => setWhCommon(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú cho tất cả kiện"
                style={{ ...inp, width: "100%" }} />
            </div>
          </div>

          {/* Select all / none */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => setWhSelectedIds(new Set(approvedInsp.map(r => r.id)))}
              style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>
              Chọn tất cả
            </button>
            <button onClick={() => setWhSelectedIds(new Set())}
              style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>
              Bỏ chọn
            </button>
            <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>
              {whSelectedIds.size}/{approvedInsp.length} kiện
            </span>
          </div>

          {/* Preview table */}
          <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 6, marginBottom: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", minWidth: 650 }}>
              <thead>
                <tr style={{ background: "var(--bgh)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "4px 6px", width: 30, borderBottom: "1px solid var(--bd)" }}></th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Mã kiện NCC</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Dày</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>CL</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Dài</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>NCC</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Tấm NT</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>Tấm NCC</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--bd)", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)" }}>KL (m³)</th>
                </tr>
              </thead>
              <tbody>
                {approvedInsp.map((rec, i) => {
                  const sel = whSelectedIds.has(rec.id);
                  const { attrs } = buildBundleAttrs(rec);
                  return (
                    <tr key={rec.id} style={{ background: sel ? "rgba(107,66,38,0.05)" : (i % 2 ? "var(--bgs)" : "#fff"), cursor: "pointer" }}
                      onClick={() => setWhSelectedIds(p => { const n = new Set(p); if (n.has(rec.id)) n.delete(rec.id); else n.add(rec.id); return n; })}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "center" }}>
                        <input type="checkbox" checked={sel} readOnly />
                      </td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{rec.supplierBundleCode}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{attrs.thickness || rec.supplierThickness || '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{attrs.quality || rec.supplierQuality || '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{attrs.length || rec.supplierLength || '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{attrs.supplier || rec.supplierNcc || '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700 }}>{rec.inspectedBoards ?? '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", color: "var(--tm)" }}>{rec.supplierBoards ?? '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600 }}>{rec.supplierVolume != null ? rec.supplierVolume.toFixed(4) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bgh)" }}>
                  <td colSpan={6} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>
                    Đã chọn ({whSelectedIds.size}):
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem", borderTop: "2px solid var(--bds)" }}>
                    {approvedInsp.filter(r => whSelectedIds.has(r.id)).reduce((s, r) => s + (r.inspectedBoards || r.supplierBoards || 0), 0).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "right", borderTop: "2px solid var(--bds)", color: "var(--tm)", fontSize: "0.68rem" }}>
                    {approvedInsp.filter(r => whSelectedIds.has(r.id)).reduce((s, r) => s + (r.supplierBoards || 0), 0).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem", borderTop: "2px solid var(--bds)" }}>
                    {approvedInsp.filter(r => whSelectedIds.has(r.id)).reduce((s, r) => s + (r.supplierVolume || 0), 0).toFixed(4)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setShowWarehouse(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
          <button onClick={handleWarehouseImport} disabled={saving || !whSelectedIds.size}
            style={{ padding: "6px 18px", borderRadius: 6, background: "#6B4226", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem" }}>
            {saving ? 'Đang nhập kho...' : `Nhập kho ${whSelectedIds.size} kiện`}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 50 }}>
      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: color || "var(--br)" }}>{value}</span>
      <span style={{ fontSize: "0.58rem", color: "var(--tm)", fontWeight: 600 }}>{label}</span>
    </div>
  );
}
