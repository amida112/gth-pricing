import React, { useState, useRef } from 'react';
import Dialog from './Dialog';

async function captureTable(ref, onDone) {
  if (!ref?.current) return;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { onDone?.(false); return; }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    onDone?.(true);
  } catch {
    onDone?.(false);
  }
}

/**
 * BoardDetailDialog — Hiển thị chi tiết danh sách tấm gỗ.
 * 2 layout: "packing" (mẫu nhập khẩu, mặc định) và "matrix" (bảng dọc cũ).
 *
 * Props:
 *   data: object — measurement hoặc bundle có boards data
 *   onClose: () => void
 *   title: string (optional)
 *   defaultLayout: 'packing' | 'matrix' (default: 'packing')
 */

const MAX_WIDTHS_PER_ROW = 20;

const btnCapture = { padding: '3px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'var(--bgs)', color: 'var(--ts)', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer' };

export default function BoardDetailDialog({ data, onClose, title, defaultLayout, wts, notify, editable, onSaved, user }) {
  // Auto-detect default layout: kiln bundle (packingSessionId) → matrix, edging/NK → packing
  const autoLayout = defaultLayout || (data?.packingSessionId ? 'matrix' : 'packing');
  const [layout, setLayout] = useState(autoLayout);
  const [editing, setEditing] = useState(false);
  const tableRef = useRef(null);
  if (!data) return null;

  const boards = data.boards || data.rawMeasurements?.boards || [];
  const bundleCode = data.bundle_code || data.bundleCode || '';
  const woodType = data.wood_type || data.woodType || '';
  // Lookup tên tiếng Anh từ wts (nếu có)
  const woodId = data.wood_id || data.woodId || '';
  const wtMatch = wts?.find(w => w.id === woodId || w.name === woodType);
  const woodTypeEn = wtMatch?.nameEn || '';
  const thickness = data.thickness || data.attributes?.thickness || 0;
  const quality = data.quality || data.attributes?.quality || '';
  const boardCount = data.board_count || data.boardCount || boards.length;
  const volume = data.volume || 0;
  const measuredBy = data.measured_by || data.measuredBy || '';
  const createdAt = data.created_at || data.createdAt || '';

  const thickMm = Math.round(parseFloat(thickness) * 10);

  // ── Switcher style ──
  const swS = { display: 'flex', gap: 2, background: '#f0f0f0', borderRadius: 5, padding: 2 };
  const swBtn = (active) => ({ padding: '3px 10px', border: 'none', borderRadius: 3, fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--tp)' : 'var(--tm)', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' });

  return (
    <Dialog open={true} onClose={onClose} title={title || `📐 Chi tiết kiện ${bundleCode}`} width={920} hideFooter>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{bundleCode}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--tm)', marginLeft: 8 }}>{woodType} · {thickMm}mm · {quality}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>{boardCount} pcs · {parseFloat(volume).toFixed(4)} m³</span>
          {!editing && (
            <div style={swS}>
              <button style={swBtn(layout === 'packing')} onClick={() => setLayout('packing')}>Packing</button>
              <button style={swBtn(layout === 'matrix')} onClick={() => setLayout('matrix')}>Matrix</button>
            </div>
          )}
          {!editing && <button onClick={() => captureTable(tableRef, ok => { if (notify) notify(ok ? 'Đã copy ảnh vào clipboard' : 'Không thể copy — thử lại', ok !== false); })} style={btnCapture} title="Chụp ảnh bảng → copy clipboard">📷 Chụp</button>}
          {editable && !editing && <button onClick={() => { setEditing(true); setLayout('matrix'); }} style={{ ...btnCapture, borderColor: 'var(--ac)', color: 'var(--ac)' }}>✏️ Sửa</button>}
        </div>
      </div>
      {measuredBy && (
        <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 12 }}>
          Measured by: {measuredBy}{createdAt ? ` · ${new Date(createdAt).toLocaleString('vi-VN')}` : ''}
        </div>
      )}

      {editing ? (
        <MatrixEditor
          initialBoards={boards}
          thickness={thickness}
          bundle={data}
          user={user}
          notify={notify}
          onCancel={() => setEditing(false)}
          onSaved={(res) => { setEditing(false); onSaved?.(res); }}
        />
      ) : boards.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)' }}>
          Không có dữ liệu tấm
          {editable && <div style={{ marginTop: 10 }}>
            <button onClick={() => { setEditing(true); setLayout('matrix'); }} style={{ padding: '5px 14px', borderRadius: 6, border: '1.5px solid var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontWeight: 600, fontSize: '0.74rem' }}>✏️ Tạo mới list số đo</button>
          </div>}
        </div>
      ) : layout === 'packing' ? (
        <PackingLayout boards={boards} thickness={thickness} bundleCode={bundleCode} tableRef={tableRef} woodType={woodTypeEn || woodType} thickMm={thickMm} quality={quality} />
      ) : (
        <MatrixLayout boards={boards} thickness={thickness} tableRef={tableRef} bundleCode={bundleCode} woodType={woodType} thickMm={thickMm} quality={quality} boardCount={boardCount} volume={volume} />
      )}
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// Matrix Editor — sửa list số đo
// ═══════════════════════════════════════════
function MatrixEditor({ initialBoards, thickness, bundle, user, notify, onCancel, onSaved }) {
  const thickNum = parseFloat(thickness) || 0;
  // Build columns from boards: { length: dm, widths: [w1, w2, ...] }
  const buildCols = (boards) => {
    const groups = {};
    boards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
    return Object.keys(groups).sort((a, b) => parseFloat(a) - parseFloat(b)).map(l => ({ length: parseFloat(l), widths: groups[l] }));
  };
  const [cols, setCols] = useState(() => buildCols(initialBoards || []));
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const totalBoards = cols.reduce((s, c) => s + c.widths.filter(w => w > 0).length, 0);
  const totalVol = cols.reduce((s, c) => s + c.widths.reduce((sw, w) => sw + (w > 0 ? (c.length / 10) * (w / 100) * (thickNum / 100) : 0), 0), 0);

  const updateLength = (ci, val) => setCols(p => p.map((c, i) => i === ci ? { ...c, length: parseFloat(val) || 0 } : c));
  const updateWidth = (ci, ri, val) => setCols(p => p.map((c, i) => i === ci ? { ...c, widths: c.widths.map((w, j) => j === ri ? (parseFloat(val) || 0) : w) } : c));
  const addRow = (ci) => setCols(p => p.map((c, i) => i === ci ? { ...c, widths: [...c.widths, 0] } : c));
  const removeRow = (ci, ri) => setCols(p => p.map((c, i) => i === ci ? { ...c, widths: c.widths.filter((_, j) => j !== ri) } : c));
  const removeCol = (ci) => setCols(p => p.filter((_, i) => i !== ci));
  const addCol = () => {
    const v = window.prompt('Nhập độ dài (dm):');
    const num = parseFloat(v);
    if (!num || num <= 0) return;
    setCols(p => [...p, { length: num, widths: [0] }].sort((a, b) => a.length - b.length));
  };

  const parsePaste = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    // Dòng đầu = lengths
    const headerCells = lines[0].split(/\t|,|;/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (!headerCells.length) return [];
    const newCols = headerCells.map(l => ({ length: l, widths: [] }));
    // Dòng sau = widths
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(/\t|,|;/);
      cells.forEach((cell, ci) => {
        if (ci < newCols.length) {
          const w = parseFloat(cell.trim());
          if (!isNaN(w) && w > 0) newCols[ci].widths.push(w);
        }
      });
    }
    return newCols.filter(c => c.widths.length > 0).sort((a, b) => a.length - b.length);
  };

  const handlePaste = (e) => {
    if (!showImport) {
      const text = e.clipboardData.getData('text');
      if (text.includes('\t') || text.includes('\n')) {
        const newCols = parsePaste(text);
        if (newCols.length) {
          e.preventDefault();
          if (window.confirm(`Paste ${newCols.length} cột × ${newCols.reduce((s, c) => s + c.widths.length, 0)} tấm? Sẽ ghi đè list hiện tại.`)) {
            setCols(newCols);
          }
        }
      }
    }
  };

  const handleImport = () => {
    const newCols = parsePaste(pasteText);
    if (!newCols.length) { notify?.('Không parse được dữ liệu', false); return; }
    setCols(newCols);
    setShowImport(false);
    setPasteText('');
    notify?.(`Đã import ${newCols.reduce((s, c) => s + c.widths.length, 0)} tấm`, true);
  };

  const handleClear = () => {
    if (!window.confirm('Xóa hết list số đo? Sẽ không cập nhật KL/tấm của kiện.')) return;
    setSaving(true);
    (async () => {
      try {
        const { clearBundleBoards } = await import('../api');
        const r = await clearBundleBoards({ bundleId: bundle.id, username: user?.username });
        if (r.error) { notify?.(r.error, false); setSaving(false); return; }
        notify?.('Đã xóa list số đo', true);
        onSaved?.({ cleared: true });
      } catch (err) { notify?.('Lỗi: ' + err.message, false); }
      setSaving(false);
    })();
  };

  const handleSave = async () => {
    const boards = [];
    cols.forEach(c => c.widths.forEach(w => { if (w > 0 && c.length > 0) boards.push({ l: c.length, w }); }));
    if (!boards.length) { notify?.('Chưa có tấm nào', false); return; }
    setSaving(true);
    try {
      const { updateBundleBoards } = await import('../api');
      const r = await updateBundleBoards({ bundleId: bundle.id, boards, thickness: thickNum, username: user?.username, action: 'update' });
      if (r.error) { notify?.(r.error, false); setSaving(false); return; }
      notify?.(`Đã lưu ${r.board_count} tấm / ${r.volume} m³`, true);
      onSaved?.({ board_count: r.board_count, volume: r.volume });
    } catch (err) { notify?.('Lỗi: ' + err.message, false); }
    setSaving(false);
  };

  const maxRows = Math.max(...cols.map(c => c.widths.length), 0);
  const inpS = { width: 50, padding: '3px 4px', borderRadius: 3, border: '1px solid var(--bd)', fontSize: '0.74rem', textAlign: 'center', outline: 'none' };

  return (
    <div onPaste={handlePaste}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={addCol} style={{ padding: '4px 10px', borderRadius: 5, border: '1.5px solid var(--ac)', background: 'transparent', color: 'var(--ac)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>+ Thêm cột dài</button>
        <button onClick={() => setShowImport(true)} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--ts)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>📋 Import từ Excel</button>
        <button onClick={handleClear} disabled={saving || !initialBoards?.length} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--dg)', background: 'transparent', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>🗑 Xóa hết list</button>
        <span style={{ fontSize: '0.66rem', color: 'var(--tm)', alignSelf: 'center' }}>Mẹo: Ctrl+V dán trực tiếp từ Excel (dòng đầu = dài, dòng sau = rộng)</span>
      </div>

      {showImport && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 6, border: '1.5px solid var(--ac)', background: 'rgba(242,101,34,0.04)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--tm)', marginBottom: 4 }}>Paste dữ liệu Excel vào ô bên dưới (dòng đầu = số đo dài, các dòng sau = số đo rộng):</div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.74rem', padding: 6, border: '1px solid var(--bd)', borderRadius: 4, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowImport(false); setPasteText(''); }} style={{ padding: '4px 12px', borderRadius: 5, border: '1px solid var(--bd)', background: 'transparent', cursor: 'pointer', fontSize: '0.7rem' }}>Hủy</button>
            <button onClick={handleImport} style={{ padding: '4px 14px', borderRadius: 5, border: 'none', background: 'var(--ac)', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>Import</button>
          </div>
        </div>
      )}

      {/* Matrix */}
      {cols.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--tm)', border: '1.5px dashed var(--bd)', borderRadius: 7 }}>
          Chưa có cột — bấm "+ Thêm cột dài" hoặc "Import từ Excel"
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.74rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bgh)', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '4px 6px', border: '1px solid var(--bd)', fontSize: '0.62rem', color: '#7A3A10' }}>Dài (dm)</th>
                {cols.map((c, ci) => (
                  <th key={ci} style={{ padding: '3px 4px', border: '1px solid var(--bd)', background: '#FEF0E8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <input value={c.length} onChange={e => updateLength(ci, e.target.value)} type="number" style={{ ...inpS, width: 44, fontWeight: 700, color: '#C24E10', background: '#fff' }} />
                      <button onClick={() => removeCol(ci)} title="Xóa cột" style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', padding: 0, fontSize: '0.7rem' }}>✕</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th style={{ padding: '4px 6px', border: '1px solid var(--bd)', fontSize: '0.62rem', color: '#7A3A10', background: 'var(--bgh)' }} rowSpan={maxRows + 1}>Rộng<br />(cm)</th></tr>
              {Array.from({ length: maxRows }, (_, ri) => (
                <tr key={ri}>
                  {cols.map((c, ci) => {
                    const w = c.widths[ri];
                    return (
                      <td key={ci} style={{ padding: '2px 3px', border: '1px solid var(--bd)', textAlign: 'center', background: ri % 2 ? 'var(--bgs)' : '#fff' }}>
                        {w !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                            <input value={w || ''} onChange={e => updateWidth(ci, ri, e.target.value)} type="number" style={inpS} />
                            <button onClick={() => removeRow(ci, ri)} title="Xóa tấm" style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', padding: 0, fontSize: '0.62rem' }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => addRow(ci)} title="Thêm tấm" style={{ background: 'none', border: '1px dashed var(--bd)', color: 'var(--tm)', cursor: 'pointer', padding: '2px 8px', borderRadius: 3, fontSize: '0.62rem' }}>+</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                {cols.map((c, ci) => (
                  <td key={ci} style={{ padding: '2px 4px', border: '1px solid var(--bd)', textAlign: 'center', background: 'rgba(50,79,39,0.04)' }}>
                    <button onClick={() => addRow(ci)} title="Thêm tấm" style={{ background: 'none', border: 'none', color: 'var(--gn)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.66rem', fontWeight: 700 }}>+ Tấm</button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', background: 'var(--bgs)', borderRadius: 6 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>
          Tổng: <span style={{ color: 'var(--ac)' }}>{totalBoards}</span> tấm · <span style={{ color: 'var(--ac)' }}>{totalVol.toFixed(4)}</span> m³
          <span style={{ marginLeft: 10, fontSize: '0.66rem', fontWeight: 400, color: 'var(--tm)' }}>(Kiện hiện tại: {bundle.boardCount || bundle.board_count} tấm · {parseFloat(bundle.volume || 0).toFixed(4)} m³)</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCancel} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.76rem' }}>Hủy</button>
          <button onClick={handleSave} disabled={saving || totalBoards === 0} style={{ padding: '6px 18px', borderRadius: 6, background: totalBoards ? 'var(--ac)' : 'var(--tm)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' }}>
            {saving ? 'Đang lưu...' : 'Lưu list'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Packing List layout (mẫu nhập khẩu)
// ═══════════════════════════════════════════
function PackingLayout({ boards, thickness, bundleCode, tableRef, woodType, thickMm, quality }) {
  const thickNum = parseFloat(thickness) || 0;

  // Group by length (dm → cm for display)
  const groups = {};
  boards.forEach(b => {
    const cm = Math.round(b.l * 10);
    if (!groups[cm]) groups[cm] = { dm: b.l, widths: [] };
    groups[cm].widths.push(b.w);
  });
  const lengthKeys = Object.keys(groups).sort((a, b) => b - a);

  // Build rows — each chunk = separate row with own Length, PCS, M3
  const allRows = [];
  lengthKeys.forEach(cm => {
    const g = groups[cm];
    const widths = g.widths.sort((a, b) => a - b);
    for (let i = 0; i < widths.length; i += MAX_WIDTHS_PER_ROW) {
      const chunk = widths.slice(i, i + MAX_WIDTHS_PER_ROW);
      const chunkM3 = chunk.reduce((s, w) => s + (g.dm / 10) * (w / 100) * (thickNum / 100), 0);
      allRows.push({ cm, widths: chunk, pcs: chunk.length, m3: chunkM3 });
    }
  });

  const totalPcs = boards.length;
  const totalM3 = boards.reduce((s, b) => s + (b.l / 10) * (b.w / 100) * (thickNum / 100), 0);

  const maxWidthsInRow = Math.max(...allRows.map(r => r.widths.length), 1);
  const widthColW = maxWidthsInRow * 28 + 12; // 28px per value + padding
  const COL_PKG = 100, COL_LEN = 60, COL_PCS = 50, COL_M3 = 70;
  const tableW = COL_PKG + COL_LEN + widthColW + COL_PCS + COL_M3;

  const thS = { fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', textAlign: 'left', padding: '4px 0', borderBottom: '1.5px solid #1a1a1a', whiteSpace: 'nowrap' };

  return (
    <div style={{ overflowX: 'auto' }}>
    <div ref={tableRef} style={{ background: '#fff', padding: '8px 10px', display: 'inline-block', minWidth: '100%' }}>
      {(woodType || thickMm || quality) && (
        <div style={{ fontSize: '0.76rem', color: '#444', marginBottom: 4, lineHeight: 1.4 }}>
          {woodType && <div style={{ fontWeight: 600 }}>{woodType}</div>}
          <div>{thickMm ? `${thickMm}mm` : ''}{thickMm && quality ? ' ' : ''}{quality || ''}</div>
        </div>
      )}
      <table style={{ width: tableW, tableLayout: 'fixed', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <colgroup>
          <col style={{ width: COL_PKG }} />
          <col style={{ width: COL_LEN }} />
          <col style={{ width: widthColW }} />
          <col style={{ width: COL_PCS }} />
          <col style={{ width: COL_M3 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...thS }}>Package</th>
            <th style={{ ...thS }}>Length</th>
            <th style={{ ...thS, textAlign: 'center' }}>Width</th>
            <th style={{ ...thS, textAlign: 'right' }}>PCS</th>
            <th style={{ ...thS, textAlign: 'right' }}>M3</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, ri) => (
            <tr key={ri}>
              {ri === 0 && <td rowSpan={allRows.length} style={{ fontWeight: 700, fontSize: '0.82rem', verticalAlign: 'top', padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden' }}>{bundleCode}</td>}
              <td style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', padding: '2px 0', verticalAlign: 'top' }}>{row.cm}</td>
              <td style={{ fontSize: '0.78rem', lineHeight: 1.5, padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {row.widths.map((w, wi) => <span key={wi} style={{ display: 'inline-block', width: 28, textAlign: 'right' }}>{w}</span>)}
              </td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 0' }}>{row.pcs}</td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 0' }}>{row.m3.toFixed(4)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: '1.5px solid #1a1a1a' }} colSpan={2} />
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>Total:</td>
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalPcs}</td>
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalM3.toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Matrix layout (bảng dọc — giữ nguyên)
// ═══════════════════════════════════════════
function MatrixLayout({ boards, thickness, tableRef, bundleCode, woodType, thickMm, quality, boardCount, volume }) {
  const thickNum = parseFloat(thickness) || 0;
  const groups = {};
  boards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
  const lengths = Object.keys(groups).sort((a, b) => a - b);
  lengths.forEach(l => groups[l].sort((a, b) => a - b));
  const columns = [];
  lengths.forEach(l => { const arr = groups[l]; for (let i = 0; i < arr.length; i += 10) columns.push({ length: l, values: arr.slice(i, i + 10) }); });
  const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;

  const thBase = { padding: '4px 6px', border: '1px solid var(--bd)', fontWeight: 700 };

  const volNum = parseFloat(volume) || 0;
  const thickF = thickness ? `${parseFloat(thickness)}F` : '';

  return (
    <div ref={tableRef} style={{ overflowX: 'auto', background: '#fff', padding: '8px 10px' }}>
      <div style={{ fontSize: '0.78rem', marginBottom: 6 }}>
        <strong>{bundleCode}</strong>{woodType ? `  ${woodType}` : ''}{thickF ? ` · ${thickF}` : ''}{quality ? ` · ${quality}` : ''}
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.74rem' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10' }}>Dài</th>
            {columns.map((c, i) => <th key={i} style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>{c.length}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }, (_, r) => (
            <tr key={r}>
              {r === 0 && <th rowSpan={maxRows} style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10', verticalAlign: 'middle' }}>Rộng</th>}
              {columns.map((c, i) => <td key={i} style={{ padding: '3px 6px', border: '1px solid var(--bd)', textAlign: 'center', background: r % 2 ? 'var(--bgs)' : '#fff' }}>{c.values[r] != null ? c.values[r] : ''}</td>)}
            </tr>
          ))}
          <tr>
            <th style={{ ...thBase, background: '#FEF0E8', fontSize: '0.66rem', color: '#C24E10' }}>Tổng</th>
            {columns.map((c, i) => {
              const sumW = c.values.reduce((s, w) => s + Number(w || 0), 0);
              const total = c.length * sumW * thickNum;
              return <th key={i} style={{ ...thBase, background: '#FEF0E8', fontSize: '0.62rem', color: '#C24E10' }}>{sumW ? total.toFixed(0) : ''}</th>;
            })}
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 6 }}>{boardCount} pcs · {volNum.toFixed(4)} m³</div>
    </div>
  );
}
