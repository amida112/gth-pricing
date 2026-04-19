import React, { useState, useMemo, useRef } from 'react';
import Dialog from './Dialog';
import { parseExcelFile, calcVolume } from './BoardsInput';

/**
 * ImportBoardsDialog — Import bulk list chi tiết tấm từ nhiều file Excel
 * cho kiện chưa có rawMeasurements.boards.
 *
 * Props:
 *   bundles: array — tất cả bundles từ DB
 *   wts: array — loại gỗ
 *   onImported: (count) => void — callback sau khi import xong
 *   onClose: () => void
 *   notify: (msg, ok) => void
 */

const btnS = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnSec = { ...btnS, background: 'var(--bgs)', color: 'var(--ts)', border: '1px solid var(--bd)' };
const thS = { padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' };
const tdS = { padding: '3px 8px', fontSize: '0.74rem', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' };

function fmtNum(n, dec = 4) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ImportBoardsDialog({ bundles, wts, onImported, onClose, notify }) {
  const wtMap = useMemo(() => Object.fromEntries(wts.map(w => [w.id, w])), [wts]);

  // Kiện XS nguyên kiện chưa có boards
  const eligibleBundles = useMemo(() => {
    const xsIds = new Set(wts.filter(w => w.thicknessMode === 'auto').map(w => w.id));
    return bundles.filter(b =>
      xsIds.has(b.woodId) && b.status === 'Kiện nguyên'
      && (!b.rawMeasurements?.boards?.length)
    );
  }, [bundles, wts]);

  const bundleMap = useMemo(() => {
    const m = {};
    eligibleBundles.forEach(b => { m[b.bundleCode] = b; });
    return m;
  }, [eligibleBundles]);

  // Kiện đã có boards (để phân biệt "đã import" vs "không tìm thấy")
  const alreadyImportedCodes = useMemo(() => {
    const xsIds = new Set(wts.filter(w => w.thicknessMode === 'auto').map(w => w.id));
    const s = new Set();
    bundles.forEach(b => { if (xsIds.has(b.woodId) && b.rawMeasurements?.boards?.length) s.add(b.bundleCode); });
    return s;
  }, [bundles, wts]);

  // State
  const [parsing, setParsing] = useState(false);
  const [parsedSheets, setParsedSheets] = useState([]); // array of { ...sheetData, matchBundle, status, checked }
  const [parseErrors, setParseErrors] = useState([]); // array of { fileName, sheetName, error }
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setParsing(true);
    setParsedSheets([]);
    setParseErrors([]);
    setImported(false);

    const allSheets = [];
    const allErrors = [];

    for (const file of files) {
      const r = await parseExcelFile(file, file.name);
      allSheets.push(...r.sheets);
      allErrors.push(...r.errors);
    }

    // Match với DB
    const matched = allSheets.map(s => {
      const code = String(s.bundleCode).trim();
      // Thử match bằng bundleCode (header hoặc sheet name), fallback thử sheetCode nếu codeMismatch
      let bundle = bundleMap[code];
      let usedCode = code;
      if (!bundle && s.codeMismatch && s.sheetCode) {
        bundle = bundleMap[s.sheetCode];
        if (bundle) usedCode = s.sheetCode;
      }
      if (!bundle && s.codeMismatch && s.headerCode) {
        bundle = bundleMap[s.headerCode];
        if (bundle) usedCode = s.headerCode;
      }
      if (!bundle) {
        const checkCode = usedCode || s.sheetCode || s.headerCode || '';
        const isAlready = alreadyImportedCodes.has(checkCode) || (s.sheetCode && alreadyImportedCodes.has(s.sheetCode)) || (s.headerCode && alreadyImportedCodes.has(s.headerCode));
        return { ...s, matchBundle: null, status: isAlready ? 'already_imported' : 'not_found', checked: false };
      }

      // So sánh số tấm
      const dbCount = bundle.boardCount || 0;
      const exCount = s.boards.length;
      const countDiff = dbCount > 0 ? Math.abs(dbCount - exCount) / dbCount * 100 : 0;

      // So sánh m³
      const thick = parseFloat(bundle.attributes?.thickness?.replace('F', '')) || 0;
      const exVol = calcVolume(s.boards, thick);
      const dbVol = bundle.volume || 0;
      const volDiff = dbVol > 0 ? Math.abs(dbVol - exVol) / dbVol * 100 : 0;

      let status = 'ok';
      if (s.codeMismatch) status = 'code_mismatch';
      else if (countDiff > 5 || volDiff > 10) status = 'warn';

      return { ...s, matchBundle: bundle, matchedCode: usedCode, status, checked: status === 'ok', exVol: +exVol.toFixed(4), countDiff, volDiff, thick };
    });

    setParsedSheets(matched);
    setParseErrors(allErrors);
    setParsing(false);
  };

  const matchedSheets = parsedSheets.filter(s => s.matchBundle);
  const alreadySheets = parsedSheets.filter(s => s.status === 'already_imported');
  const notFoundSheets = parsedSheets.filter(s => s.status === 'not_found');
  const checkedCount = matchedSheets.filter(s => s.checked).length;

  const toggleCheck = (idx) => {
    setParsedSheets(prev => prev.map((s, i) => i === idx ? { ...s, checked: !s.checked } : s));
  };
  const toggleAll = (val) => {
    setParsedSheets(prev => prev.map(s => s.matchBundle ? { ...s, checked: val } : s));
  };

  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  const handleImport = async () => {
    const toImport = parsedSheets.filter(s => s.matchBundle && s.checked);
    if (!toImport.length) return;
    setImporting(true);
    setImportProgress({ done: 0, total: toImport.length });
    let ok = 0, fail = 0;
    const api = await import('../api.js');
    for (let i = 0; i < toImport.length; i++) {
      const s = toImport[i];
      const existing = s.matchBundle.rawMeasurements || {};
      const r = await api.updateBundle(s.matchBundle.id, { raw_measurements: { ...existing, boards: s.boards } });
      if (r?.error) fail++; else ok++;
      setImportProgress({ done: i + 1, total: toImport.length });
    }
    setImporting(false);
    setImported(true);
    notify(`Đã import ${ok} kiện${fail ? ` (${fail} lỗi)` : ''}`, !fail);
    if (ok > 0) onImported(ok);
  };

  return (
    <Dialog open={true} onClose={onClose} title="Import list chi tiết cho các kiện gỗ xẻ sấy" width={900} noEnter>
      {/* Header stats */}
      <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginBottom: 10 }}>
        {eligibleBundles.length} kiện nguyên kiện chưa có list chi tiết
      </div>

      {/* File input */}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => fileRef.current?.click()} style={btnP} disabled={parsing || importing}>
          {parsing ? 'Đang đọc file...' : 'Chọn file Excel'}
        </button>
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls" onChange={handleFiles} style={{ display: 'none' }} />
        <span style={{ fontSize: '0.68rem', color: 'var(--tm)', marginLeft: 8 }}>Chọn nhiều file cùng lúc</span>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--dg)', marginBottom: 4 }}>Lỗi ({parseErrors.length})</div>
          <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thS}>File</th>
                <th style={thS}>Sheet</th>
                <th style={thS}>Lỗi</th>
              </tr></thead>
              <tbody>
                {parseErrors.map((e, i) => (
                  <tr key={i}>
                    <td style={{ ...tdS, fontSize: '0.66rem' }}>{e.fileName}</td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{e.sheetName}</td>
                    <td style={{ ...tdS, color: 'var(--dg)', fontSize: '0.68rem' }}>{e.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Already imported */}
      {alreadySheets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn)', marginBottom: 4 }}>Đã import list chi tiết rồi ({alreadySheets.length})</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--tm)', maxHeight: 60, overflowY: 'auto' }}>
            {alreadySheets.map((s, i) => <span key={i} style={{ marginRight: 8 }}>{s.bundleCode}</span>)}
          </div>
        </div>
      )}

      {/* Not found */}
      {notFoundSheets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tm)', marginBottom: 4 }}>Không tìm thấy hoặc không còn nguyên kiện ({notFoundSheets.length})</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--tm)', maxHeight: 60, overflowY: 'auto' }}>
            {notFoundSheets.map((s, i) => <span key={i} style={{ marginRight: 8 }}>{s.bundleCode}</span>)}
          </div>
        </div>
      )}

      {/* Matched — ready to import */}
      {matchedSheets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn)' }}>Sẵn sàng import ({checkedCount}/{matchedSheets.length})</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleAll(true)} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.62rem' }}>Chọn tất cả</button>
              <button onClick={() => toggleAll(false)} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.62rem' }}>Bỏ tất cả</button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ position: 'sticky', top: 0, background: 'var(--bgc)', zIndex: 1 }}>
                <th style={{ ...thS, width: 26 }} />
                <th style={thS}>Mã kiện</th>
                <th style={thS}>Loại gỗ</th>
                <th style={{ ...thS, textAlign: 'right' }}>DB tấm</th>
                <th style={{ ...thS, textAlign: 'right' }}>Excel tấm</th>
                <th style={{ ...thS, textAlign: 'right' }}>DB m³</th>
                <th style={{ ...thS, textAlign: 'right' }}>Excel m³</th>
                <th style={thS}>File</th>
                <th style={{ ...thS, textAlign: 'center' }}>TT</th>
              </tr></thead>
              <tbody>
                {parsedSheets.map((s, i) => {
                  if (!s.matchBundle) return null;
                  const b = s.matchBundle;
                  const wt = wtMap[b.woodId];
                  return (
                    <tr key={i} style={{ background: s.status === 'code_mismatch' ? 'rgba(242,101,34,0.06)' : s.status === 'warn' ? 'rgba(212,160,23,0.06)' : undefined }}>
                      <td style={{ ...tdS, padding: '3px 4px' }}><input type="checkbox" checked={s.checked} onChange={() => toggleCheck(i)} /></td>
                      <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 600 }}>
                        {s.matchedCode || s.bundleCode}
                        {s.codeMismatch && <div style={{ fontSize: '0.56rem', color: 'var(--ac)', fontFamily: 'inherit' }}>header: {s.headerCode} / sheet: {s.sheetCode}</div>}
                      </td>
                      <td style={{ ...tdS, fontSize: '0.68rem' }}>{wt?.name || b.woodId}</td>
                      <td style={{ ...tdS, textAlign: 'right' }}>{b.boardCount}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, color: s.countDiff > 5 ? 'var(--dg)' : undefined }}>{s.boards.length}</td>
                      <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(b.volume, 4)}</td>
                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, color: s.volDiff > 10 ? 'var(--dg)' : undefined }}>{fmtNum(s.exVol, 4)}</td>
                      <td style={{ ...tdS, fontSize: '0.64rem', color: 'var(--tm)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.fileName}>{s.fileName}</td>
                      <td style={{ ...tdS, textAlign: 'center', fontSize: '0.64rem' }}>
                        {s.status === 'ok' && <span style={{ color: 'var(--gn)' }}>✓</span>}
                        {s.status === 'warn' && <span style={{ color: '#D4A017' }} title={`Tấm lệch ${fmtNum(s.countDiff, 1)}%, m³ lệch ${fmtNum(s.volDiff, 1)}%`}>⚠ Lệch</span>}
                        {s.status === 'code_mismatch' && <span style={{ color: 'var(--ac)' }} title={`Mã header "${s.headerCode}" ≠ sheet "${s.sheetCode}"`}>⚠ Mã lệch</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {parsedSheets.length > 0 && !imported && (
        <div style={{ fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 8 }}>
          Tổng: {parsedSheets.length} sheet đọc được · {matchedSheets.length} khớp DB · {checkedCount} đã chọn
          {alreadySheets.length > 0 && ` · ${alreadySheets.length} đã import`}
          {notFoundSheets.length > 0 && ` · ${notFoundSheets.length} không tìm thấy`}
          {parseErrors.length > 0 && ` · ${parseErrors.length} lỗi`}
        </div>
      )}

      {/* Progress bar */}
      {importing && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ts)', marginBottom: 4 }}>
            <span>Đang import... {importProgress.done}/{importProgress.total}</span>
            <span>{importProgress.total > 0 ? Math.round(importProgress.done / importProgress.total * 100) : 0}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${importProgress.total > 0 ? importProgress.done / importProgress.total * 100 : 0}%`, background: 'var(--gn)', borderRadius: 3, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSec}>{imported ? 'Đóng' : 'Hủy'}</button>
        {!imported && <button onClick={handleImport} disabled={!checkedCount || importing} style={{ ...btnP, opacity: checkedCount && !importing ? 1 : 0.4 }}>
          {importing ? `${importProgress.done}/${importProgress.total}...` : `Import ${checkedCount} kiện`}
        </button>}
      </div>
    </Dialog>
  );
}
