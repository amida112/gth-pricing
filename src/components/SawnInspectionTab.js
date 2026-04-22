import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dialog from './Dialog';
import BoardsInput from './BoardsInput';
import { resolveRangeGroup } from '../utils';

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
    // Columns: mã kiện, độ dày, độ rộng, độ dài, chất lượng, khối lượng, số tấm, nhà cung cấp
    return {
      supplierBundleCode: cols[0] || '',
      supplierThickness: cols[1] || '',
      supplierWidth: cols[2] || '',
      supplierLength: (cols[3] || '').replace(/\s*-\s*/g, '-'),
      supplierQuality: cols[4] || '',
      supplierVolume: cols[5] ? parseFloat(cols[5].replace(',', '.')) || null : null,
      supplierBoards: cols[6] ? parseInt(cols[6]) || null : null,
      supplierNcc: cols[7] || '',
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
  const [whSource, setWhSource] = useState('inspection'); // 'inspection' | 'supplier'
  const [whEdits, setWhEdits] = useState({}); // {inspId: {thickness, quality, length, boards, volume, notes}}
  const [whBoardsData, setWhBoardsData] = useState({}); // {inspId: [{l,w}]}
  const [whExpandId, setWhExpandId] = useState(null); // expand BoardsInput for 1 row
  const [whDupCodes, setWhDupCodes] = useState(new Set()); // duplicate bundle codes
  const [whDupLoading, setWhDupLoading] = useState(false);

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
        supplierLength: (manualFm.supplierLength || '').replace(/\s*-\s*/g, '-'),
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

  const openWarehouseImport = async () => {
    const codes = approvedInsp.map(r => r.bundleCode).filter(Boolean);
    setWhDupLoading(true);
    setWhSource('inspection');
    setWhEdits({});
    setWhBoardsData({});
    setWhExpandId(null);
    setWhCommon({ location: '', notes: 'Số liệu nghiệm thu thực tế' });
    setShowWarehouse(true);
    try {
      const api = await import('../api.js');
      const dups = await api.checkDuplicateBundleCodes(codes);
      const dupSet = new Set(dups);
      setWhDupCodes(dupSet);
      setWhSelectedIds(new Set(approvedInsp.filter(r => !dupSet.has(r.bundleCode)).map(r => r.id)));
    } catch { setWhDupCodes(new Set()); setWhSelectedIds(new Set(approvedInsp.map(r => r.id))); }
    setWhDupLoading(false);
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
        const raw = rec.supplierLength.trim().replace(/\s*-\s*/g, '-');
        const rangeGrps = woodCfg.rangeGroups?.[atId];
        if (rangeGrps?.length) {
          const resolved = resolveRangeGroup(raw, rangeGrps);
          // resolved = label nhóm hoặc null nếu ngoài khoảng
          // Cho phép cả ngoài khoảng — lưu raw value, PgCFG orphan sẽ hiển thị
          attrs.length = resolved || raw;
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

  // Lấy giá trị hiện tại (edit override hoặc gốc) cho 1 row
  const getWhRowVal = useCallback((rec) => {
    const e = whEdits[rec.id] || {};
    const isInsp = whSource === 'inspection';
    return {
      thickness: e.thickness !== undefined ? e.thickness : rec.supplierThickness || '',
      quality: e.quality !== undefined ? e.quality : rec.supplierQuality || '',
      length: e.length !== undefined ? e.length : (isInsp ? (rec.inspectedLength || rec.supplierLength) : rec.supplierLength) || '',
      boards: e.boards !== undefined ? e.boards : String(isInsp ? (rec.inspectedBoards ?? rec.supplierBoards ?? '') : (rec.supplierBoards ?? '')),
      volume: e.volume !== undefined ? e.volume : String(rec.supplierVolume ?? ''),
      notes: e.notes !== undefined ? e.notes : '',
    };
  }, [whEdits, whSource]);

  const handleWarehouseImport = async () => {
    const selected = approvedInsp.filter(r => whSelectedIds.has(r.id));
    if (!selected.length) { notify('Chọn ít nhất 1 kiện', false); return; }

    setSaving(true);
    try {
      const api = await import('../api.js');
      const bundles = selected.map(rec => {
        const vals = getWhRowVal(rec);
        // Build attrs using overridden values
        const overrideRec = { ...rec, supplierThickness: vals.thickness, supplierQuality: vals.quality, supplierLength: vals.length, supplierWidth: rec.supplierWidth, supplierNcc: rec.supplierNcc };
        const { woodId, attrs, rawMeasurements } = buildBundleAttrs(overrideRec);
        const skuKey = Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('||');
        const boardsArr = whBoardsData[rec.id];
        const finalRaw = { ...rawMeasurements, ...(boardsArr?.length ? { boards: boardsArr } : {}) };
        return {
          inspectionId: rec.id,
          woodId,
          containerId: container.id,
          attributes: attrs,
          skuKey,
          boardCount: parseInt(vals.boards) || 0,
          volume: parseFloat(vals.volume) || 0,
          supplierBoards: rec.supplierBoards || null,
          supplierVolume: rec.supplierVolume || null,
          bundleCode: rec.bundleCode,
          location: whCommon.location || null,
          notes: vals.notes || whCommon.notes || null,
          rawMeasurements: Object.keys(finalRaw).length ? finalRaw : undefined,
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
      ) : (() => {
        const nccBg = 'rgba(168,155,142,0.06)';
        const ntBg = 'rgba(41,128,185,0.06)';
        const thBase = { padding: "4px 6px", fontWeight: 700, fontSize: "0.56rem", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1.5px solid var(--bds)" };
        const thNcc = { ...thBase, background: "rgba(168,155,142,0.15)", color: "#7F6B5E" };
        const thNt = { ...thBase, background: "rgba(41,128,185,0.15)", color: "#2471A3" };
        const thNeutral = { ...thBase, background: "var(--bgh)", color: "var(--brl)" };
        const inpInline = { padding: "3px 5px", borderRadius: 4, border: "1.5px solid #2980b9", fontSize: "0.74rem", outline: "none", background: "#fff", fontWeight: 700 };
        return (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", minWidth: 750 }}>
            <thead>
              {/* Group header row */}
              <tr>
                <th style={{ ...thNeutral, borderBottom: "1px solid var(--bds)" }} />
                <th colSpan={8} style={{ ...thNcc, textAlign: "center", borderBottom: "1px solid var(--bds)", letterSpacing: 1 }}>PACKING LIST NCC</th>
                <th colSpan={4} style={{ ...thNt, textAlign: "center", borderBottom: "1px solid var(--bds)", letterSpacing: 1, borderLeft: "2px solid #2980b9" }}>NGHIỆM THU</th>
                <th colSpan={2} style={{ ...thNeutral, borderBottom: "1px solid var(--bds)" }} />
              </tr>
              {/* Column header row */}
              <tr>
                <th style={{ ...thNeutral, width: 30, textAlign: "center" }}>#</th>
                <th style={thNcc}>Mã kiện</th>
                <th style={thNcc}>Dày</th>
                <th style={thNcc}>Rộng</th>
                <th style={thNcc}>Dài</th>
                <th style={thNcc}>CL</th>
                <th style={{ ...thNcc, textAlign: "right" }}>KL (m³)</th>
                <th style={{ ...thNcc, textAlign: "right" }}>Tấm</th>
                <th style={thNcc}>NCC</th>
                <th style={{ ...thNt, textAlign: "right", borderLeft: "2px solid #2980b9" }}>Tấm TT</th>
                <th style={thNt}>Dài TT</th>
                <th style={{ ...thNt, textAlign: "right" }}>Lệch</th>
                <th style={thNt}>Ghi chú</th>
                <th style={thNeutral}>TT</th>
                <th style={{ ...thNeutral, width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {inspections.map((rec, ri) => {
                const st = stCfg(rec.status);
                const boardDiff = rec.inspectedBoards != null && rec.supplierBoards != null ? rec.inspectedBoards - rec.supplierBoards : null;
                const boardDiffPct = boardDiff != null && rec.supplierBoards ? (boardDiff / rec.supplierBoards * 100).toFixed(1) : null;
                const tdBase = { padding: "5px 6px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" };
                const tdNcc = { ...tdBase, background: ri % 2 ? nccBg : undefined };
                const tdNt = { ...tdBase, background: ri % 2 ? ntBg : 'rgba(41,128,185,0.03)' };
                const isEditing = editId === rec.id;
                return (
                  <tr key={rec.id}>
                    <td style={{ ...tdBase, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)", width: 30 }}>{ri + 1}</td>
                    {/* NCC columns */}
                    <td style={{ ...tdNcc, fontWeight: 700, color: "var(--br)" }}>{rec.bundleCode}</td>
                    <td style={tdNcc}>{rec.supplierThickness || '—'}</td>
                    <td style={tdNcc}>{rec.supplierWidth || '—'}</td>
                    <td style={tdNcc}>{rec.supplierLength || '—'}</td>
                    <td style={tdNcc}>{rec.supplierQuality || '—'}</td>
                    <td style={{ ...tdNcc, textAlign: "right", fontWeight: 600 }}>{rec.supplierVolume != null ? rec.supplierVolume.toFixed(4) : '—'}</td>
                    <td style={{ ...tdNcc, textAlign: "right" }}>{rec.supplierBoards ?? '—'}</td>
                    <td style={tdNcc}>{rec.supplierNcc || '—'}</td>
                    {/* NT columns — inline editing */}
                    {isEditing ? (<>
                      <td style={{ ...tdNt, borderLeft: "2px solid #2980b9" }}>
                        <input type="number" autoFocus value={inspFm.inspectedBoards} onChange={e => setInspFm(p => ({ ...p, inspectedBoards: e.target.value }))}
                          style={{ ...inpInline, width: 55, textAlign: "right" }} />
                      </td>
                      <td style={tdNt}>
                        <input value={inspFm.inspectedLength} onChange={e => setInspFm(p => ({ ...p, inspectedLength: e.target.value }))}
                          placeholder={rec.supplierLength || ''}
                          style={{ ...inpInline, width: 75, fontWeight: 500 }} />
                      </td>
                      <td style={{ ...tdNt, textAlign: "right" }}>
                        {(() => { const d = inspFm.inspectedBoards && rec.supplierBoards ? parseInt(inspFm.inspectedBoards) - rec.supplierBoards : null; return d != null ? <span style={{ color: d < 0 ? "var(--dg)" : "var(--gn)", fontWeight: 600, fontSize: "0.7rem" }}>{d > 0 ? '+' : ''}{d}</span> : '—'; })()}
                      </td>
                      <td style={tdNt}>
                        <input value={inspFm.inspectionNotes} onChange={e => setInspFm(p => ({ ...p, inspectionNotes: e.target.value }))}
                          placeholder="Ghi chú..."
                          style={{ ...inpInline, width: 90, fontWeight: 400, fontSize: "0.7rem" }} />
                      </td>
                    </>) : (<>
                      <td style={{ ...tdNt, textAlign: "right", fontWeight: 700, color: rec.inspectedBoards != null ? "var(--br)" : "var(--tm)", borderLeft: "2px solid #2980b9" }}>
                        {rec.inspectedBoards != null ? rec.inspectedBoards : '—'}
                      </td>
                      <td style={tdNt}>{rec.inspectedLength || '—'}</td>
                      <td style={{ ...tdNt, textAlign: "right", color: boardDiff != null ? (boardDiff < 0 ? "var(--dg)" : "var(--gn)") : "var(--tm)", fontWeight: 600 }}>
                        {boardDiff != null ? `${boardDiff > 0 ? '+' : ''}${boardDiff} (${boardDiffPct}%)` : '—'}
                      </td>
                      <td title={rec.inspectionNotes || ''} style={{ ...tdNt, fontSize: "0.65rem", color: "var(--tm)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{rec.inspectionNotes || ''}</td>
                    </>)}
                    {/* Status */}
                    <td style={tdBase}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.color, fontSize: "0.62rem", fontWeight: 700 }}>{st.label}</span>
                    </td>
                    {/* Actions */}
                    <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {isEditing ? (<>
                          <button onClick={handleSubmitInspect} disabled={saving} title="Lưu"
                            style={{ padding: "2px 8px", borderRadius: 3, border: "none", background: "#2980b9", color: "#fff", cursor: "pointer", fontSize: "0.62rem", fontWeight: 700 }}>
                            {saving ? '...' : 'Lưu'}
                          </button>
                          <button onClick={() => setEditId(null)} title="Hủy"
                            style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem" }}>Hủy</button>
                        </>) : (<>
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
                        </>)}
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
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, borderTop: "2px solid var(--bds)" }}>{summary.supplierBoards}</td>
                <td style={{ borderTop: "2px solid var(--bds)" }} />
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 800, color: "#2471A3", borderTop: "2px solid var(--bds)", borderLeft: "2px solid #2980b9" }}>
                  {summary.inspectedBoards || '—'}
                </td>
                <td colSpan={5} style={{ borderTop: "2px solid var(--bds)" }} />
              </tr>
            </tfoot>
          </table>
        </div>
        );
      })()}

      {/* ── Dialog Import Packing List ── */}
      <Dialog open={showImport} onClose={() => setShowImport(false)} title="Import Packing List NCC" width={680} noEnter>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Paste dữ liệu (CSV/Tab) — Cột: Mã kiện, Dày (cm), Rộng (cm), Dài (m), Chất lượng, KL (m³), Số tấm, NCC</label>
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setParsedRows([]); setImportErr(''); }}
            placeholder={"OAK-A001\t2.5\t15\t2.2-2.5\tFAS\t1.2500\t120\tMissouri\nOAK-A002\t2.5\t15\t2.2-2.5\tFAS\t0.9800\t98\tMissouri"}
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
                    {['#', 'Mã kiện', 'Dày (cm)', 'Rộng (cm)', 'Dài (m)', 'CL', 'KL (m³)', 'Số tấm', 'NCC'].map((h, i) => (
                      <th key={i} style={{ padding: "4px 6px", textAlign: (i === 6 || i === 7) ? "right" : "left", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontSize: "0.62rem", color: "var(--tm)", textAlign: "center" }}>{i + 1}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{r.bundleCode}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierThickness}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierWidth}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierLength}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)" }}>{r.supplierQuality}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{r.supplierVolume != null ? r.supplierVolume.toFixed(4) : '—'}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", textAlign: "right" }}>{r.supplierBoards ?? '—'}</td>
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
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem" }}>
                      {parsedRows.reduce((s, r) => s + (r.supplierBoards || 0), 0).toLocaleString('vi-VN')}
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
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid var(--bd)", fontWeight: 600 }}>{rec.bundleCode}</td>
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
      <Dialog open={showWarehouse} onClose={() => setShowWarehouse(false)} title="Nhập kho hàng loạt từ nghiệm thu" width={920} noEnter>
        {(() => {
          const isInsp = whSource === 'inspection';
          const editable = isInsp;
          const selList = approvedInsp.filter(r => whSelectedIds.has(r.id));
          const totalBoards = selList.reduce((s, r) => s + (parseInt(getWhRowVal(r).boards) || 0), 0);
          const totalVol = selList.reduce((s, r) => s + (parseFloat(getWhRowVal(r).volume) || 0), 0);
          const totalBoardsNcc = selList.reduce((s, r) => s + (r.supplierBoards || 0), 0);
          const totalVolNcc = selList.reduce((s, r) => s + (r.supplierVolume || 0), 0);
          const dupCount = approvedInsp.filter(r => whDupCodes.has(r.bundleCode)).length;
          const setEdit = (id, key, val) => setWhEdits(p => ({ ...p, [id]: { ...p[id], [key]: val } }));
          const thS = { padding: "4px 5px", textAlign: "left", borderBottom: "1px solid var(--bd)", fontSize: "0.58rem", fontWeight: 700, color: "var(--brl)", whiteSpace: "nowrap" };
          const tdS = { padding: "3px 5px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" };
          const eInp = { padding: "3px 5px", borderRadius: 4, border: "1.5px solid var(--bd)", fontSize: "0.72rem", outline: "none", boxSizing: "border-box" };

          return (<div>
            {/* ── Nguồn số liệu ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "stretch" }}>
              {[{ key: 'inspection', label: 'Nghiệm thu', sub: 'Có thể chỉnh sửa', color: '#2980b9' },
                { key: 'supplier', label: 'Nhà cung cấp', sub: 'Theo packing list', color: '#6B4226' }].map(s => (
                <button key={s.key} onClick={() => { setWhSource(s.key); setWhEdits({}); setWhCommon(p => ({ ...p, notes: s.key === 'inspection' ? 'Số liệu nghiệm thu thực tế' : 'Theo packing list NCC' })); }}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 7, border: `2px solid ${whSource === s.key ? s.color : "var(--bd)"}`, background: whSource === s.key ? `${s.color}08` : "transparent", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: whSource === s.key ? s.color : "var(--ts)" }}>{s.label}</div>
                  <div style={{ fontSize: "0.64rem", color: "var(--tm)", marginTop: 2 }}>{s.sub}</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, marginTop: 4, color: whSource === s.key ? s.color : "var(--tm)" }}>
                    {s.key === 'inspection' ? `${totalBoards} tấm · ${totalVol.toFixed(3)} m³` : `${totalBoardsNcc} tấm · ${totalVolNcc.toFixed(3)} m³`}
                  </div>
                </button>
              ))}
            </div>

            {/* ── Common fields ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Vị trí kho</label>
                <input value={whCommon.location} onChange={e => setWhCommon(p => ({ ...p, location: e.target.value }))} placeholder="VD: Kho A - Dãy 3" style={{ ...inp, width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Ghi chú chung</label>
                <input value={whCommon.notes} onChange={e => setWhCommon(p => ({ ...p, notes: e.target.value }))} style={{ ...inp, width: "100%" }} />
              </div>
            </div>

            {/* ── Check trùng + select ── */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <button onClick={() => setWhSelectedIds(new Set(approvedInsp.filter(r => !whDupCodes.has(r.bundleCode)).map(r => r.id)))}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>Chọn tất cả</button>
              <button onClick={() => setWhSelectedIds(new Set())}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>Bỏ chọn</button>
              <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>{whSelectedIds.size}/{approvedInsp.length} kiện</span>
              {whDupLoading && <span style={{ fontSize: "0.68rem", color: "var(--tm)" }}>Đang kiểm tra trùng...</span>}
              {!whDupLoading && dupCount > 0 && <span style={{ fontSize: "0.68rem", color: "var(--dg)", fontWeight: 700 }}>⚠ {dupCount} mã kiện đã tồn tại trong kho</span>}
            </div>

            {/* ── Bảng kiện ── */}
            <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--bd)", borderRadius: 6, marginBottom: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", minWidth: 750 }}>
                <thead><tr style={{ background: "var(--bgh)", position: "sticky", top: 0, zIndex: 2 }}>
                  <th style={{ ...thS, width: 28 }}></th>
                  <th style={thS}>Mã kiện</th>
                  <th style={thS}>Dày</th>
                  <th style={thS}>CL</th>
                  <th style={thS}>Dài</th>
                  <th style={{ ...thS, textAlign: "right" }}>Tấm</th>
                  <th style={{ ...thS, textAlign: "right" }}>KL (m³)</th>
                  <th style={thS}>Ghi chú</th>
                  <th style={{ ...thS, width: 50, textAlign: "center" }}>Chi tiết</th>
                </tr></thead>
                <tbody>
                  {approvedInsp.map((rec, i) => {
                    const isDup = whDupCodes.has(rec.bundleCode);
                    const sel = whSelectedIds.has(rec.id);
                    const vals = getWhRowVal(rec);
                    const isExp = whExpandId === rec.id;
                    const boardsArr = whBoardsData[rec.id] || [];
                    const toggleSel = () => { if (isDup) return; setWhSelectedIds(p => { const n = new Set(p); if (n.has(rec.id)) n.delete(rec.id); else n.add(rec.id); return n; }); };
                    return (
                      <React.Fragment key={rec.id}>
                        <tr style={{ background: isDup ? "rgba(231,76,60,0.06)" : sel ? "rgba(107,66,38,0.05)" : (i % 2 ? "var(--bgs)" : "#fff"), opacity: isDup ? 0.5 : 1 }}>
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <input type="checkbox" checked={sel} disabled={isDup} onChange={toggleSel} style={{ cursor: isDup ? "not-allowed" : "pointer" }} />
                          </td>
                          <td style={{ ...tdS, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {rec.bundleCode}{isDup && <span style={{ color: "var(--dg)", fontSize: "0.6rem", marginLeft: 4 }}>trùng</span>}
                          </td>
                          {editable ? (<>
                            <td style={tdS}><input value={vals.thickness} onChange={e => setEdit(rec.id, 'thickness', e.target.value)} style={{ ...eInp, width: 50 }} /></td>
                            <td style={tdS}><input value={vals.quality} onChange={e => setEdit(rec.id, 'quality', e.target.value)} style={{ ...eInp, width: 45 }} /></td>
                            <td style={tdS}><input value={vals.length} onChange={e => setEdit(rec.id, 'length', e.target.value)} style={{ ...eInp, width: 65 }} /></td>
                            <td style={tdS}><input type="number" value={vals.boards} onChange={e => setEdit(rec.id, 'boards', e.target.value)} style={{ ...eInp, width: 50, textAlign: "right" }} /></td>
                            <td style={tdS}><input type="number" step="0.001" value={vals.volume} onChange={e => setEdit(rec.id, 'volume', e.target.value)} style={{ ...eInp, width: 70, textAlign: "right" }} /></td>
                            <td style={tdS}><input value={vals.notes} onChange={e => setEdit(rec.id, 'notes', e.target.value)} placeholder="—" style={{ ...eInp, width: "100%" }} /></td>
                          </>) : (<>
                            <td style={tdS}>{rec.supplierThickness || '—'}</td>
                            <td style={tdS}>{rec.supplierQuality || '—'}</td>
                            <td style={tdS}>{rec.supplierLength || '—'}</td>
                            <td style={{ ...tdS, textAlign: "right" }}>{rec.supplierBoards ?? '—'}</td>
                            <td style={{ ...tdS, textAlign: "right" }}>{rec.supplierVolume?.toFixed(4) ?? '—'}</td>
                            <td style={{ ...tdS, color: "var(--tm)" }}>—</td>
                          </>)}
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <button onClick={() => setWhExpandId(isExp ? null : rec.id)} title="Chi tiết tấm"
                              style={{ padding: "1px 6px", borderRadius: 4, border: `1px solid ${isExp ? "var(--ac)" : "var(--bd)"}`, background: isExp ? "var(--acbg)" : "transparent", color: isExp ? "var(--ac)" : "var(--ts)", cursor: "pointer", fontSize: "0.6rem", fontWeight: 600 }}>
                              📐{boardsArr.length > 0 && <span style={{ marginLeft: 2, color: "var(--gn)" }}>{boardsArr.length}</span>}
                            </button>
                          </td>
                        </tr>
                        {/* Expand: BoardsInput */}
                        {isExp && (
                          <tr><td colSpan={9} style={{ padding: "8px 10px", background: "var(--bgs)", borderBottom: "2px solid var(--ac)" }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--brl)", marginBottom: 6 }}>Chi tiết tấm — {rec.bundleCode}</div>
                            <BoardsInput
                              thickness={parseFloat(vals.thickness) || 0}
                              boards={boardsArr}
                              onBoardsChange={(boards, stats) => {
                                setWhBoardsData(p => ({ ...p, [rec.id]: boards }));
                                if (editable && stats) {
                                  setEdit(rec.id, 'boards', String(stats.count || ''));
                                  if (stats.volume > 0) setEdit(rec.id, 'volume', stats.volume.toFixed(4));
                                }
                              }}
                            />
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot><tr style={{ background: "var(--bgh)" }}>
                  <td colSpan={5} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Đã chọn ({whSelectedIds.size}):</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem", borderTop: "2px solid var(--bds)" }}>{totalBoards.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.72rem", borderTop: "2px solid var(--bds)" }}>{totalVol.toFixed(4)}</td>
                  <td colSpan={2} style={{ borderTop: "2px solid var(--bds)" }}></td>
                </tr></tfoot>
              </table>
            </div>
          </div>);
        })()}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setShowWarehouse(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.76rem" }}>Hủy</button>
          <button onClick={handleWarehouseImport} disabled={saving || !whSelectedIds.size}
            style={{ padding: "6px 18px", borderRadius: 6, background: "#6B4226", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.76rem", opacity: saving ? 0.6 : 1 }}>
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
